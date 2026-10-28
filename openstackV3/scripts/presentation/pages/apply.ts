/** Apply the complete production stack: Heat, inventory, Docker, Swarm, and ingress. */

import { existsSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { banner, error, success } from '../../infrastructure/cli.js';
import { CREDENTIALS_DIR, INFOMANIAK_DNS_TOKEN_PATH, INVENTORY_PATH, PRODUCTION_ENV_PATH, ROOT_DIR, ROUTER_CONFIG_PATH, SSH_KEY_PATH, STATE_DIR } from '../../infrastructure/paths.js';
import { credentialsExist } from '../../infrastructure/credentials.js';
import { openstack, openstackStream } from '../../infrastructure/openstack.js';
import { runProgram, runProgramStream } from '../../infrastructure/shell.js';
import { assertAdminCaForApply, ensureAdminPki } from '../../infrastructure/admin-pki.js';
import { discoverOperatorCidr } from '../../infrastructure/operator-access.js';
import { run as generateInventory } from './inventory.js';
import { run as verify } from './verify.js';
import { run as syncDns } from './dns.js';
import { resolveNs } from 'node:dns/promises';
import { readRouterConfig } from '../../infrastructure/app-manifest.js';
import { setOperationPhase } from '../../infrastructure/operation-lock.js';

const ANSIBLE_DIR = resolve(ROOT_DIR, '..', 'ansible');
const ANSIBLE_VENV = join(ANSIBLE_DIR, 'venv');
const TEMPLATE = 'heat/level5-production.yaml';

function requireFile(path: string, hint: string): void {
  if (!existsSync(path)) throw new Error(`${path} is missing. ${hint}`);
}

function stackExists(stackName: string): boolean {
  const output = openstack(['stack', 'list', '-f', 'value', '-c', 'Stack Name'], { showOutput: false });
  return output.split('\n').some((name) => name.trim() === stackName);
}

function setupAnsible(): void {
  const playbook = join(ANSIBLE_VENV, 'bin', 'ansible-playbook');
  if (existsSync(playbook)) return;

  runProgram('python3', ['-m', 'venv', ANSIBLE_VENV], { cwd: ANSIBLE_DIR });
  runProgram(join(ANSIBLE_VENV, 'bin', 'pip'), ['install', '-r', 'requirements.lock.txt'], {
    cwd: ANSIBLE_DIR,
  });
}

async function runPlaybook(name: string): Promise<void> {
  const exitCode = await runProgramStream(
    join(ANSIBLE_VENV, 'bin', 'ansible-playbook'),
    [
      '-i', INVENTORY_PATH,
      `playbooks/${name}`,
      '--extra-vars', JSON.stringify({
        toad_router_config_path: ROUTER_CONFIG_PATH,
        toad_credentials_dir: CREDENTIALS_DIR,
      }),
    ],
    { cwd: ANSIBLE_DIR },
  );
  if (exitCode !== 0) throw new Error(`${name} failed with exit code ${exitCode}`);
}

export async function run(args: string[]): Promise<void> {
  banner('TOAD Production Apply');
  const stackName = args[0] ?? 'toad-prod';
  const envFile = args[1];
  const envPath = envFile ? resolve(ROOT_DIR, envFile) : PRODUCTION_ENV_PATH;
  const templatePath = join(ROOT_DIR, TEMPLATE);

  try {
    setOperationPhase('preflight');
    requireFile(envPath, 'Create an operator context and customize its generated production environment first. See ../docs/QUICKSTART.md.');
    if (!credentialsExist()) throw new Error('OpenStack credentials are incomplete. Run pnpm run setup first.');
    requireFile(ROUTER_CONFIG_PATH, 'Create a context or copy router/config.example.yaml and set your domain/email.');
    requireFile(SSH_KEY_PATH, 'Run pnpm run setup in the selected context before provisioning.');
    requireFile(INFOMANIAK_DNS_TOKEN_PATH, 'Run pnpm run dns-token before provisioning.');
    const dnsToken = statSync(INFOMANIAK_DNS_TOKEN_PATH);
    if (!dnsToken.isFile() || dnsToken.size === 0 || (dnsToken.mode & 0o077)) throw new Error('The DNS token must be a nonempty private file (mode 0600). Run pnpm run dns-token.');

    openstack(['orchestration', 'template', 'validate', '-t', templatePath, '-e', envPath], {
      showOutput: false,
    });

    const operation = stackExists(stackName) ? 'update' : 'create';
    assertAdminCaForApply(operation === 'update');
    ensureAdminPki();
    const operatorCidr = await discoverOperatorCidr();
    setupAnsible();
    const code = await openstackStream([
      'stack', operation,
      '-t', templatePath,
      '-e', envPath,
      '--parameter', `ssh_allowed_cidr=${operatorCidr}`,
      stackName,
      '--wait',
    ]);
    if (code !== 0) throw new Error(`Heat stack ${operation} failed with exit code ${code}`);

    await generateInventory([stackName]);
    for (const playbook of [
      'installDocker.yaml',
      'hardenHosts.yaml',
      'initJoinSwarm.yaml',
      'deployTraefik.yaml',
      'deployRoot.yaml',
      'deployMonitoring.yaml',
      'deployHello.yaml',
    ]) {
      setOperationPhase(playbook.replace('.yaml', '').replace(/[A-Z]/g, char => `-${char.toLowerCase()}`));
      await runPlaybook(playbook);
    }

    if (!await completeDnsAndVerify(stackName)) return;
    success('Production stack applied and verified.');
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}

export async function completeDnsAndVerify(stackName: string, resume = false): Promise<boolean> {
    setOperationPhase('dns-delegation');
    const config = readRouterConfig();
    const domain = config.base_domain;
    const stackId = openstack(['stack', 'show', stackName, '-f', 'value', '-c', 'id'], { showOutput: false, showCommand: false }).trim();
    if (!/^[a-f0-9-]{36}$/i.test(stackId)) throw new Error('Could not resolve the exact Heat stack identity. No DNS changes were made.');
    const checkpoint = join(STATE_DIR, '.cloud-dns-wait.json');
    const binding = { stackName, stackId, baseDomain: domain, rootDomain: config.root_domain };
    if (resume) {
      if (!existsSync(checkpoint)) throw new Error('No DNS resume checkpoint exists in this context. Run cloud apply first.');
      const previous = JSON.parse(readFileSync(checkpoint, 'utf8')) as typeof binding;
      if (Object.entries(binding).some(([key, value]) => previous[key as keyof typeof binding] !== value)) throw new Error('Stack identity or DNS configuration changed since the waiting operation. Review cloud plan and run a full cloud apply; resume was refused before DNS changes.');
    } else writeFileSync(checkpoint, JSON.stringify(binding), { mode: 0o600 });
    const zoneId = openstack(['stack', 'output', 'show', stackName, 'dns_zone_id', '-f', 'value', '-c', 'output_value'], { showOutput: false, showCommand: false }).trim().replace(/^"|"$/g, '');
    const records = JSON.parse(openstack(['recordset', 'list', zoneId, '-f', 'json'], { showOutput: false, showCommand: false })) as Array<{ type?: string; records?: string[] }>;
    const expected = records.filter(record => record.type === 'NS').flatMap(record => record.records ?? []).map(value => value.replace(/\.$/, '').toLowerCase());
    const actual = await resolveNs(domain).catch(() => [] as string[]);
    if (expected.length < 2 || !expected.every(value => actual.map(item => item.replace(/\.$/, '').toLowerCase()).includes(value))) {
      setOperationPhase('waiting-for-dns');
      console.log(JSON.stringify({ version: 1, ok: false, outcome: 'waiting_for_dns', stack: stackName, records: expected.map(value => ({ name: domain, type: 'NS', target: `${value}.` })), nextAction: `Create the matching child NS delegation in your parent DNS zone. Then run cloud resume ${stackName} in the same context to finish parent DNS synchronization and verification. Existing resources are retained.` }, null, 2));
      process.exitCode = 2; return false;
    }
    // Cut parent DNS over only after Traefik and the landing service are ready.
    setOperationPhase('parent-dns');
    await syncDns([stackName]);
    setOperationPhase('verification');
    await verify([stackName]);
    if (process.exitCode && process.exitCode !== 0) {
      throw new Error('Production verification failed.');
    }
    if (existsSync(checkpoint)) unlinkSync(checkpoint);
    return true;
}
