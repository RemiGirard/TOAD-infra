/** Minimal Infomaniak DNS v2 client for the parent-zone records owned by TOAD. */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { Resolver, resolve4 } from 'node:dns/promises';
import { INFOMANIAK_DNS_TOKEN_PATH } from './paths.js';

const API_BASE = 'https://api.infomaniak.com/2';
const MANAGED_TTL = 300;

interface DnsRecord {
  id: number;
  source?: string;
  target: string;
  ttl: number;
  type: string;
}

interface ApiEnvelope<T> {
  result?: string;
  data?: T;
  error?: unknown;
}

export interface DnsChange {
  name: string;
  action: 'created' | 'updated' | 'unchanged' | 'removed-duplicate';
  target: string;
}

export function infomaniakDnsTokenReady(): boolean {
  return existsSync(INFOMANIAK_DNS_TOKEN_PATH)
    && readFileSync(INFOMANIAK_DNS_TOKEN_PATH, 'utf8').trim().length > 0;
}

export function requireInfomaniakDnsToken(): string {
  if (!infomaniakDnsTokenReady()) {
    throw new Error(
      `Missing ${INFOMANIAK_DNS_TOKEN_PATH}. Create an Infomaniak token with dns:read and dns:write scopes, save only the token in that file, and chmod 600 it.`,
    );
  }
  const mode = statSync(INFOMANIAK_DNS_TOKEN_PATH).mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(`${INFOMANIAK_DNS_TOKEN_PATH} must have mode 0600 (currently ${mode.toString(8)}).`);
  }
  return readFileSync(INFOMANIAK_DNS_TOKEN_PATH, 'utf8').trim();
}

async function api<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Infomaniak DNS API returned HTTP ${response.status} with an invalid JSON response.`);
  }
  if (!response.ok || !['success', 'asynchronous'].includes(envelope.result ?? '')) {
    throw new Error(`Infomaniak DNS API ${method} ${path} failed (HTTP ${response.status}, result ${envelope.result ?? 'unknown'}).`);
  }
  return envelope.data as T;
}

function normalizedSource(record: DnsRecord, zone: string): string {
  const source = (record.source ?? '').replace(/\.$/, '');
  if (source === '' || source === '@' || source === zone) return '@';
  if (source === `*.${zone}`) return '*';
  return source;
}

async function setAddressRecord(
  token: string,
  zone: string,
  source: '@' | '*',
  target: string,
  records: DnsRecord[],
): Promise<DnsChange[]> {
  const matches = records.filter((record) => record.type === 'A' && normalizedSource(record, zone) === source);
  const body = {
    source: source === '@' ? '' : source,
    target,
    ttl: MANAGED_TTL,
    type: 'A',
  };
  const changes: DnsChange[] = [];

  if (matches.length === 0) {
    await api<DnsRecord>(token, 'POST', `/zones/${encodeURIComponent(zone)}/records?with=label`, body);
    changes.push({ name: source, action: 'created', target });
    return changes;
  }

  const primary = matches[0]!;
  const duplicates = matches.slice(1);
  if (primary.target === target && primary.ttl === MANAGED_TTL) {
    changes.push({ name: source, action: 'unchanged', target });
  } else {
    await api<DnsRecord>(
      token,
      'PUT',
      `/zones/${encodeURIComponent(zone)}/records/${primary.id}?with=label`,
      body,
    );
    changes.push({ name: source, action: 'updated', target });
  }

  for (const duplicate of duplicates) {
    await api<unknown>(token, 'DELETE', `/zones/${encodeURIComponent(zone)}/records/${duplicate.id}`);
    changes.push({ name: source, action: 'removed-duplicate', target: duplicate.target });
  }
  return changes;
}

/** Own only the parent apex and wildcard A RRsets. Mail and child-zone NS records are untouched. */
export async function syncParentDns(zone: string, ipv4: string): Promise<DnsChange[]> {
  const token = requireInfomaniakDnsToken();
  const records = await api<DnsRecord[]>(
    token,
    'GET',
    `/zones/${encodeURIComponent(zone)}/records?with=records_description`,
  );
  return [
    ...await setAddressRecord(token, zone, '@', ipv4, records),
    ...await setAddressRecord(token, zone, '*', ipv4, records),
  ];
}

export async function waitForParentDns(zone: string, ipv4: string): Promise<void> {
  const nameserverNames = ['ns11.infomaniak.ch', 'ns12.infomaniak.ch'];
  const nameserverAddresses = await Promise.all(nameserverNames.map(async (name) => (await resolve4(name))[0]!));
  let last: string[] = [];
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const names = [zone, `toad-dns-check-${Date.now()}.${zone}`];
    const answers = await Promise.all(nameserverAddresses.flatMap((nameserver) => names.map(async (name) => {
      const resolver = new Resolver();
      resolver.setServers([nameserver]);
      try { return await resolver.resolve4(name); } catch { return []; }
    })));
    last = [...new Set(answers.flat())];
    if (answers.every((addresses) => addresses.includes(ipv4))) return;
    if (attempt < 60) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Parent DNS did not converge to ${ipv4}; last answers: ${last.join(', ') || 'none'}.`);
}
