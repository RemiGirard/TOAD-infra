/**
 * OpenStack CLI execution.
 *
 * Wraps the OpenStack CLI installed in Python venv.
 * Automatically injects credentials from clouds.yaml and password file.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { ROOT_DIR, VENV_DIR, SSH_KEY_PATH, SSH_KEY_PUB_PATH } from './paths.js';
import { findCloudsYaml, getDefaultCloud, loadPassword } from './credentials.js';
import { run, runCheck, runAsync } from './shell.js';

function getOpenStackEnv(): Record<string, string> {
  const cloudsFile = findCloudsYaml();
  if (!cloudsFile) {
    throw new Error('No clouds.yaml found in credentials/. Run: pnpm run setup');
  }

  const cloudName = getDefaultCloud();
  if (!cloudName) {
    throw new Error('No cloud defined in clouds.yaml');
  }

  const password = loadPassword();

  return {
    ...process.env,
    OS_CLIENT_CONFIG_FILE: cloudsFile,
    OS_CLOUD: cloudName,
    OS_PASSWORD: password,
  } as Record<string, string>;
}

function getOpenstackBin(): string {
  return join(VENV_DIR, 'bin', 'openstack');
}

export function openstack(args: string[], options: { showOutput?: boolean } = {}): string {
  const bin = getOpenstackBin();

  if (!existsSync(bin)) {
    throw new Error('OpenStack CLI not installed. Run: pnpm run setup');
  }

  const env = getOpenStackEnv();

  const result = run(`openstack ${args.join(' ')}`, {
    showOutput: options.showOutput,
    cwd: ROOT_DIR,
    env,
    actualCmd: `${bin} ${args.join(' ')}`,
  });
  return result;
}

export function openstackStream(args: string[]): Promise<number> {
  const bin = getOpenstackBin();
  const env = getOpenStackEnv();

  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';
  console.log(`${DIM}$ openstack ${args.join(' ')}${RESET}`);

  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      env,
      stdio: 'inherit',
      cwd: ROOT_DIR,
    });

    proc.on('close', (code) => {
      resolve(code || 0);
    });
  });
}

export function venvExists(): boolean {
  const bin = join(VENV_DIR, 'bin', 'openstack');
  return runCheck(`test -f openstack_cli/bin/openstack && echo "ok"`, { actualCmd: `test -f ${bin} && echo "ok"` });
}

export function sshKeyExists(): boolean {
  return runCheck(`test -f credentials/toad-key && echo "ok"`, { actualCmd: `test -f ${SSH_KEY_PATH} && echo "ok"` });
}

export function testConnection(): boolean {
  try {
    openstack(['token', 'issue'], { showOutput: false });
    return true;
  } catch {
    return false;
  }
}

export async function openstackAsync(
  args: string[],
  options: { showOutput?: boolean; spinner?: string } = {}
): Promise<string> {
  const bin = getOpenstackBin();

  if (!existsSync(bin)) {
    throw new Error('OpenStack CLI not installed. Run: pnpm run setup');
  }

  const env = getOpenStackEnv();

  const result = await runAsync(`openstack ${args.join(' ')}`, {
    showOutput: options.showOutput,
    cwd: ROOT_DIR,
    env,
    actualCmd: `${bin} ${args.join(' ')}`,
    spinner: options.spinner,
  });

  return result;
}
