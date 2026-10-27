/** Credential-free public health probe suitable for a separate failure domain. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { banner, error, success } from '../../infrastructure/cli.js';
import { expandAppValue, readRouterConfig } from '../../infrastructure/app-manifest.js';
import { EXTERNAL_MONITORING_WEBHOOK_PATH, ROOT_DIR } from '../../infrastructure/paths.js';

interface Endpoint {
  name: string;
  url: string;
  status: number;
  bodyIncludes?: string;
}

interface ProbeResult extends Endpoint {
  ok: boolean;
  actualStatus?: number;
  durationMs: number;
  detail: string;
}

function endpoints(): Endpoint[] {
  const path = resolve(ROOT_DIR, '..', 'monitoring', 'external-endpoints.yaml');
  const parsed = parseYaml(readFileSync(path, 'utf8')) as { version?: unknown; endpoints?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.endpoints)) throw new Error(`${path} must be a version 1 endpoint list.`);
  return parsed.endpoints.map((value, index) => {
    const item = value as Partial<Endpoint>;
    if (typeof item.name !== 'string' || typeof item.url !== 'string' || typeof item.status !== 'number') {
      throw new Error(`external-endpoints.yaml entry ${index} is invalid.`);
    }
    if (!item.url.startsWith('https://')) throw new Error(`${item.name} must use HTTPS.`);
    return { name: item.name, url: item.url, status: item.status };
  });
}

async function check(endpoint: Endpoint): Promise<ProbeResult> {
  const needsDomains = /\$\{(?:TOAD_DOMAIN|ROOT_DOMAIN)\}/.test(endpoint.url);
  const config = needsDomains ? {
    base_domain: process.env.TOAD_DOMAIN ?? '',
    root_domain: process.env.ROOT_DOMAIN ?? '',
  } : { base_domain: '', root_domain: '' };
  if (needsDomains && ((endpoint.url.includes('${TOAD_DOMAIN}') && !config.base_domain)
    || (endpoint.url.includes('${ROOT_DOMAIN}') && !config.root_domain))) {
    Object.assign(config, readRouterConfig());
  }
  const url = expandAppValue(endpoint.url, config);
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    const secure = !response.url || new URL(response.url).protocol === 'https:';
    const bodyMatches = !endpoint.bodyIncludes || (await response.text()).includes(endpoint.bodyIncludes);
    const durationMs = Math.round(performance.now() - started);
    return {
      ...endpoint,
      url,
      ok: response.status === endpoint.status && secure && bodyMatches,
      actualStatus: response.status,
      durationMs,
      detail: `HTTP ${response.status}${!secure ? '; final URL is not HTTPS' : ''}${!bodyMatches ? '; expected body marker missing' : ''}`,
    };
  } catch (cause) {
    return {
      ...endpoint,
      url,
      ok: false,
      durationMs: Math.round(performance.now() - started),
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

async function notify(payload: object): Promise<void> {
  if (!existsSync(EXTERNAL_MONITORING_WEBHOOK_PATH)) {
    throw new Error(`Webhook URL is missing: ${EXTERNAL_MONITORING_WEBHOOK_PATH}`);
  }
  const url = readFileSync(EXTERNAL_MONITORING_WEBHOOK_PATH, 'utf8').trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TOAD-external-probe/1' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Monitoring webhook returned HTTP ${response.status}.`);
}

export async function run(args: string[]): Promise<void> {
  const json = args.includes('--json');
  if (!json) banner('TOAD External Public Probe');
  try {
    const urlIndex = args.indexOf('--url');
    const explicitUrl = urlIndex === -1 ? undefined : args[urlIndex + 1];
    if (urlIndex !== -1 && (!explicitUrl || explicitUrl.startsWith('--'))) throw new Error('--url requires an absolute HTTPS URL.');
    const expectIndex = args.indexOf('--expect');
    const expected = expectIndex === -1 ? undefined : args[expectIndex + 1];
    if (expectIndex !== -1 && (!expected || expected.startsWith('--'))) throw new Error('--expect requires a public response marker.');
    if (explicitUrl) {
      const parsed = new URL(explicitUrl);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new Error('--url requires an HTTPS URL without embedded credentials.');
      }
    }
    const selected = (explicitUrl ? [{ name: 'public-site', url: explicitUrl, status: 200 }] : endpoints())
      .map((endpoint) => ({ ...endpoint, ...(expected ? { bodyIncludes: expected } : {}) }));
    const results = await Promise.all(selected.map(check));
    const output = {
      version: 1,
      ok: results.every((result) => result.ok),
      checkedAt: new Date().toISOString(),
      source: 'toad-external-probe',
      results,
    };
    const shouldNotify = args.includes('--notify') && (!output.ok || args.includes('--notify-always'));
    if (shouldNotify) await notify(output);
    if (json) console.log(JSON.stringify(output, null, 2));
    else {
      for (const result of results) {
        console.log(`${result.ok ? '✓' : '✗'} ${result.name}: ${result.url} — ${result.detail} in ${result.durationMs}ms`);
      }
      if (shouldNotify) success('Monitoring webhook notified.');
    }
    if (!output.ok) process.exitCode = 1;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (json) console.log(JSON.stringify({ version: 1, ok: false, error: message, results: [] }, null, 2));
    else error(message);
    process.exitCode = 1;
  }
}
