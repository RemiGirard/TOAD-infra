/** Apply the complete production stack: Heat, inventory, Docker, Swarm, and ingress. */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { banner, error, success } from '../../infrastructure/cli.js';
import { CREDENTIALS_DIR, INVENTORY_PATH, PRODUCTION_ENV_PATH, ROOT_DIR, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import { credentialsExist } from '../../infrastructure/credentials.js';
import { openstack, openstackStream } from '../../infrastructure/openstack.js';
import { runProgram, runProgramStream } from '../../infrastructure/shell.js';
import { ensureAdminPki } from '../../infrastructure/admin-pki.js';
import { discoverOperatorCidr } from '../../infrastructure/operator-access.js';
import { run as generateInventory } from './inventory.js';
import { run as verify } from './verify.js';
import { run as syncDns } from './dns.js';

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
    requireFile(envPath, 'Copy heat/env/example.yaml and customize it first.');
    if (!credentialsExist()) throw new Error('OpenStack credentials are incomplete. Run pnpm run setup first.');
    requireFile(ROUTER_CONFIG_PATH, 'Create a context or copy router/config.example.yaml and set your domain/email.');
    ensureAdminPki();

    openstack(['orchestration', 'template', 'validate', '-t', templatePath, '-e', envPath], {
      showOutput: false,
    });

    const operation = stackExists(stackName) ? 'update' : 'create';
    const operatorCidr = await discoverOperatorCidr();
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
    setupAnsible();
    for (const playbook of [
      'installDocker.yaml',
      'hardenHosts.yaml',
      'initJoinSwarm.yaml',
      'deployTraefik.yaml',
      'deployRoot.yaml',
      'deployMonitoring.yaml',
      'deployHello.yaml',
    ]) {
      await runPlaybook(playbook);
    }

    // Cut parent DNS over only after Traefik and the landing service are ready.
    await syncDns([stackName]);
    await verify([stackName]);
    if (process.exitCode && process.exitCode !== 0) {
      throw new Error('Production verification failed.');
    }
    success('Production stack applied and verified.');
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
