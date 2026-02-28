#!/usr/bin/env npx tsx
/**
 * Initial setup script for TOAD infrastructure.
 *
 * Run this once before deploying any stacks. It:
 * 1. Creates Python venv and installs openstack CLI
 * 2. Checks for clouds.yaml (from Infomaniak dashboard)
 * 3. Prompts for password and saves to credentials/password
 * 4. Tests the OpenStack connection
 * 5. Generates SSH keypair and uploads to OpenStack
 * 6. Updates heat/env/example.yaml with keypair name
 *
 * Usage: pnpm run setup
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { banner, ask, success, error, info, closeReadline } from '../../infrastructure/cli.js';
import { run } from '../../infrastructure/shell.js';
import {
  ROOT_DIR,
  CREDENTIALS_DIR,
  PASSWORD_FILE,
  VENV_DIR,
  SSH_KEY_PATH,
  SSH_KEY_PUB_PATH,
} from '../../infrastructure/paths.js';
import {
  cloudsYamlExists,
  passwordExists,
  findCloudsYaml,
  getDefaultCloud,
} from '../../infrastructure/credentials.js';
import {
  venvExists,
  sshKeyExists,
  openstack,
  testConnection,
} from '../../infrastructure/openstack.js';

async function setupVenv(): Promise<void> {
  console.log('\nSetting up Python virtual environment...');

  if (venvExists()) {
    info('Virtual environment already exists');
    return;
  }

  run(`python3 -m venv ${VENV_DIR}`, { cwd: ROOT_DIR });

  const pip = join(VENV_DIR, 'bin', 'pip');
  const requirements = join(ROOT_DIR, 'requirements.txt');

  info('Installing dependencies...');
  run(`${pip} install -q -r ${requirements}`, { cwd: ROOT_DIR });
  run(`${pip} install -q python-octaviaclient`, { cwd: ROOT_DIR });

  info('Virtual environment ready');
}

async function setupCredentials(): Promise<void> {
  console.log('\nConfiguring OpenStack credentials...');

  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  // Check for clouds.yaml
  if (!cloudsYamlExists()) {
    error('No clouds.yaml found in credentials/');
    console.log('\n   Download it from Infomaniak dashboard:');
    console.log('   Public Cloud > Users > Download OpenStack RC file (clouds.yaml)');
    console.log('   Then copy it to: credentials/\n');
    closeReadline();
    process.exit(1);
  }
  info('Found clouds.yaml');

  // Check for password
  if (passwordExists()) {
    const overwrite = await ask('   Password file exists. Overwrite? (y/N)', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      info('Using existing password');
      return;
    }
  }

  const password = await ask('   Enter your OpenStack password');
  writeFileSync(PASSWORD_FILE, password + '\n', { mode: 0o600 });
  info('Password saved to credentials/password');
}

async function setupSSHKey(): Promise<void> {
  console.log('\nSetting up SSH keypair...');

  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  if (!sshKeyExists()) {
    info('Generating new SSH keypair in credentials/...');
    run(`ssh-keygen -t ed25519 -f ${SSH_KEY_PATH} -N "" -C "toad-infra"`, { showOutput: false });
    info('SSH keypair generated');
  } else {
    info('SSH keypair already exists');
  }

  try {
    openstack(['keypair', 'show', 'toad-key'], { showOutput: false });
    info('Keypair "toad-key" exists in OpenStack');
  } catch {
    info('Uploading keypair to OpenStack...');
    try {
      openstack(['keypair', 'create', '--public-key', SSH_KEY_PUB_PATH, 'toad-key']);
      info('Keypair uploaded to OpenStack');
    } catch (e: unknown) {
      error(`Failed to upload keypair: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function updateEnvFile(): Promise<void> {
  console.log('\nUpdating environment file...');

  const envPath = join(ROOT_DIR, 'heat', 'env', 'example.yaml');
  let content = readFileSync(envPath, 'utf-8');

  if (!content.includes('keypair_name: "toad-key"')) {
    content = content.replace(/keypair_name: "[^"]*"/, 'keypair_name: "toad-key"');
    writeFileSync(envPath, content);
    info('Updated heat/env/example.yaml with keypair_name');
  } else {
    info('heat/env/example.yaml already configured');
  }
}

export async function run(_args: string[]): Promise<void> {
  banner('TOAD OpenStack Setup');

  await setupVenv();
  await setupCredentials();

  console.log('\nTesting OpenStack connection...');
  if (!testConnection()) {
    error('Connection failed. Check your credentials.');
    closeReadline();
    process.exit(1);
  }
  info('Connection successful');

  await setupSSHKey();
  await updateEnvFile();

  success('Setup complete!\n');
  console.log('Next steps:');
  console.log('  pnpm run discover   # See available resources');
  console.log('  pnpm run deploy     # Deploy infrastructure');
  console.log('  pnpm run status     # Check stack status');
  console.log('  pnpm run ssh        # SSH to nodes');
  console.log('  pnpm run destroy    # Delete stack\n');

  const cloudsFile = findCloudsYaml()!;
  const cloudName = getDefaultCloud()!;
  console.log('Run OpenStack CLI directly:');
  console.log('  source openstack_cli/bin/activate');
  console.log(`  export OS_CLIENT_CONFIG_FILE=${cloudsFile}`);
  console.log(`  export OS_CLOUD=${cloudName}`);
  console.log('  export OS_PASSWORD=$(cat credentials/password)');
  console.log('  openstack stack list\n');

  closeReadline();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((e) => {
    error(`Setup failed: ${e instanceof Error ? e.message : e}`);
    closeReadline();
    process.exit(1);
  });
}
