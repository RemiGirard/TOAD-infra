/** Guided configuration and an honest, read-only deployment review. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseDocument, parse, stringify } from 'yaml';
import { ACTIVE_CONTEXT, PRODUCTION_ENV_PATH, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import { createContext, useContext } from '../../infrastructure/context.js';
import { ask, closeReadline } from '../../infrastructure/cli.js';
import { run as apply, completeDnsAndVerify } from './apply.js';
import { operationHistory } from '../../infrastructure/operation-lock.js';
import { run as doctor } from './doctor.js';
export async function run(args: string[]): Promise<void> {
  const command = args[0];
  if (command === 'init') {
    const name = args[1]; if (!name) throw new Error('cloud init requires a context name.');
    const directory = createContext(name); useContext(name);
    const nextAction = `Save the service-user clouds.yaml in ${directory}/credentials/, run setup, then cloud configure.`;
    console.log(args.includes('--json') ? JSON.stringify({ version: 1, ok: true, context: name, outcome: 'created_and_selected', directory, nextAction }, null, 2) : `Created and selected ${name}. ${nextAction}`); return;
  }
  if (command === 'configure') {
    if (!ACTIVE_CONTEXT) throw new Error('Select a named context with --context NAME.');
    if (!process.stdin.isTTY) throw new Error('cloud configure requires an interactive terminal. Agents can edit the generated context templates, then run cloud plan --json.');
    const environment = parseDocument(readFileSync(PRODUCTION_ENV_PATH, 'utf8'));
    const router = parseDocument(readFileSync(ROUTER_CONFIG_PATH, 'utf8'));
    try {
      for (const [label, key] of [['Flavor (from discover)', 'flavor'], ['Immutable image UUID (from discover)', 'image'], ['Public network (from discover)', 'public_network'], ['Manager 1 availability zone', 'manager1_availability_zone'], ['Manager 2 availability zone', 'manager2_availability_zone'], ['Manager 3 availability zone', 'manager3_availability_zone']] as const) {
        const answer = await ask(label); if (!answer) throw new Error(`${label} is required.`); environment.setIn(['parameters', key], answer);
      }
      const domain = await ask('Platform child domain'); const root = await ask('Parent domain (TOAD manages its apex and wildcard A records)'); const email = await ask('Certificate and DNS email');
      if (![domain, root].every(value => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(value)) || !domain.endsWith(`.${root}`) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Use valid domains with the platform below its parent, and a valid email.');
      environment.setIn(['parameters', 'dns_zone_name'], `${domain}.`); environment.setIn(['parameters', 'dns_email'], email);
      router.set('base_domain', domain); router.set('root_domain', root); router.set('letsencrypt_email', email);
      writeFileSync(PRODUCTION_ENV_PATH, environment.toString(), { mode: 0o600 }); writeFileSync(ROUTER_CONFIG_PATH, router.toString(), { mode: 0o600 });
      console.log('Configuration saved privately. Store the DNS token, then run doctor --for cloud-apply and cloud plan.');
    } finally { closeReadline(); }
    return;
  }
  if (command === 'plan') {
    const missing = [PRODUCTION_ENV_PATH, ROUTER_CONFIG_PATH].filter(path => !existsSync(path));
    let configured = false;
    if (missing.length === 0) {
      const environment = parse(readFileSync(PRODUCTION_ENV_PATH, 'utf8')) as { parameters?: { image?: string } };
      const router = parse(readFileSync(ROUTER_CONFIG_PATH, 'utf8')) as { base_domain?: string; root_domain?: string };
      configured = /^[a-f0-9-]{36}$/i.test(environment.parameters?.image ?? '') && Boolean(router.base_domain && router.root_domain && !router.base_domain.endsWith('example.com'));
    }
    const result = { version: 1, ok: configured, context: ACTIVE_CONTEXT ?? 'legacy', stack: args.find((value, index) => index > 0 && !value.startsWith('-')) ?? ACTIVE_CONTEXT ?? 'toad-prod', changes: false, scope: 'configuration review; not a provider-side Heat change-set or price quote', resources: { managers: 3, loadBalancers: 1, childDnsZones: 1 }, dnsOwnership: ['parent apex A', 'parent wildcard A', 'child zone records'], configuration: configured ? 'ready-for-preflight' : 'needs-configuration', nextActions: ['doctor --for cloud-apply --cloud --json', 'Review provider quota, cost worksheet, domains and existing DNS ownership.', 'cloud apply STACK creates billable resources and changes DNS.'], missingFiles: missing };
    console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : stringify(result)); if (!configured) process.exitCode = 1; return;
  }
  if (command === 'apply') { await doctor(['--for', 'cloud-apply', '--cloud', ...(args.includes('--json') ? ['--json'] : [])]); if (!process.exitCode) await apply(args.slice(1).filter(value => !value.startsWith('--'))); return; }
  if (command === 'resume') {
    const stack = args.slice(1).find(value => !value.startsWith('--')) ?? ACTIVE_CONTEXT ?? 'toad-prod';
    const previous = operationHistory().find(item => item.phase === 'waiting-for-dns' && item.operation.split(' ').includes(stack));
    if (!previous) throw new Error('No DNS-waiting operation for this stack in the selected context. Run cloud apply STACK first.');
    await completeDnsAndVerify(stack, true); return;
  }
  throw new Error('Use cloud init NAME, configure, plan [STACK], apply STACK, or resume STACK.');
}
