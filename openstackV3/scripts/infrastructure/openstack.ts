/**
 * OpenStack CLI execution.
 *
 * Wraps the OpenStack CLI installed in Python venv.
 * Automatically injects credentials from clouds.yaml and password file.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { ROOT_DIR, VENV_DIR, SSH_KEY_PATH, SSH_KEY_PUB_PATH } from './paths.js';
import { findCloudsYaml, getDefaultCloud, loadPassword } from './credentials.js';
import { runProgram, runProgramAsync, runProgramStream } from './shell.js';

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
    ...(password ? { OS_PASSWORD: password } : {}),
  };
}

function getOpenstackBin(): string {
  return join(VENV_DIR, 'bin', 'openstack');
}

export function openstack(
  args: string[],
  options: { showOutput?: boolean; showCommand?: boolean } = {},
): string {
  const bin = getOpenstackBin();

  if (!existsSync(bin)) {
    throw new Error('OpenStack CLI not installed. Run: pnpm run setup');
  }

  const env = getOpenStackEnv();

  const result = runProgram(bin, args, {
    showOutput: options.showOutput,
    showCommand: options.showCommand,
    cwd: ROOT_DIR,
    env,
    displayCommand: `openstack ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
  });
  return result;
}

export function openstackStream(args: string[]): Promise<number> {
  const bin = getOpenstackBin();
  const env = getOpenStackEnv();
  return runProgramStream(bin, args, {
    env,
    cwd: ROOT_DIR,
    displayCommand: `openstack ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
  });
}

export function venvExists(): boolean {
  const bin = join(VENV_DIR, 'bin', 'openstack');
  return existsSync(bin);
}

export function sshKeyExists(): boolean {
  return existsSync(SSH_KEY_PATH);
}

export function testConnection(): boolean {
  try {
    openstack(['token', 'issue'], { showOutput: false, showCommand: false });
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

  const result = await runProgramAsync(bin, args, {
    showOutput: options.showOutput,
    cwd: ROOT_DIR,
    env,
    displayCommand: `openstack ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    spinner: options.spinner,
  });

  return result;
}
