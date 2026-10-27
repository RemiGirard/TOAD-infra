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
 * 6. Shows the selected context's configuration and production apply steps
 *
 * Usage: pnpm run setup
 */

import { chmodSync, existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { banner, ask, askSecret, success, error, info, closeReadline } from '../../infrastructure/cli.js';
import { runProgram } from '../../infrastructure/shell.js';
import {
  ROOT_DIR,
  CREDENTIALS_DIR,
  PASSWORD_FILE,
  VENV_DIR,
  SSH_KEY_PATH,
  SSH_KEY_PUB_PATH,
  PRODUCTION_ENV_PATH,
  ROUTER_CONFIG_PATH,
} from '../../infrastructure/paths.js';
import { ensureCloudKeypair } from '../../infrastructure/cloud-keypair.js';
import {
  cloudsYamlExists,
  passwordExists,
  findCloudsYaml,
  usesApplicationCredential,
  usesInlinePassword,
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

  runProgram('python3', ['-m', 'venv', VENV_DIR], { cwd: ROOT_DIR });

  const pip = join(VENV_DIR, 'bin', 'pip');
  const requirements = join(ROOT_DIR, 'requirements.lock.txt');

  info('Installing dependencies...');
  runProgram(pip, ['install', '-q', '-r', requirements], { cwd: ROOT_DIR });

  info('Virtual environment ready');
}

async function setupCredentials(): Promise<void> {
  console.log('\nConfiguring OpenStack credentials...');

  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  // Check for clouds.yaml
  if (!cloudsYamlExists()) {
    error(`No clouds.yaml found in ${relative(ROOT_DIR, CREDENTIALS_DIR)}/`);
    console.log('\n   Download it from Infomaniak dashboard:');
    console.log('   Public Cloud > Users > Download OpenStack RC file (clouds.yaml)');
    console.log(`   Then save it to: ${relative(ROOT_DIR, CREDENTIALS_DIR)}/clouds.yaml\n`);
    closeReadline();
    process.exit(1);
  }
  info('Found clouds.yaml');
  chmodSync(findCloudsYaml()!, 0o600);

  if (usesApplicationCredential()) {
    info('Using application credential from clouds.yaml');
    return;
  }

  if (usesInlinePassword()) {
    info('Using password credential from clouds.yaml');
    return;
  }

  // Check for password
  if (passwordExists()) {
    const overwrite = await ask('   Password file exists. Overwrite? (y/N)', 'n');
    if (overwrite.toLowerCase() !== 'y') {
      info('Using existing password');
      return;
    }
  }

  const password = await askSecret('   Enter the dedicated OpenStack service-user password');
  if (!password) throw new Error('Password cannot be empty.');
  writeFileSync(PASSWORD_FILE, password + '\n', { mode: 0o600 });
  info('Password saved privately in the selected operator context');
}

async function setupSSHKey(): Promise<void> {
  console.log('\nSetting up SSH keypair...');

  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  if (!sshKeyExists()) {
    info('Generating a new SSH keypair in the selected operator context...');
    runProgram('ssh-keygen', ['-t', 'ed25519', '-f', SSH_KEY_PATH, '-N', '', '-C', 'toad-infra'], { showOutput: false });
    info('SSH keypair generated');
  } else {
    info('SSH keypair already exists');
  }

  const result = ensureCloudKeypair('toad-key', SSH_KEY_PUB_PATH, readFileSync(SSH_KEY_PUB_PATH, 'utf8'),
    (args) => openstack(args, { showCommand: false, showOutput: false }));
  info(result === 'created' ? 'Uploaded and verified the SSH keypair' : 'Verified the existing cloud keypair matches this context');
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

  success('Setup complete!\n');
  console.log('Next steps:');
  console.log('  pnpm run discover   # Choose cloud resources');
  console.log(`  Configure ${relative(ROOT_DIR, PRODUCTION_ENV_PATH)} and ${relative(ROOT_DIR, ROUTER_CONFIG_PATH)}`);
  console.log('  pnpm run dns-token  # Store the restricted DNS token');
  console.log('  pnpm run check');
  console.log('  pnpm run apply -- YOUR-STACK  # Provision and configure the platform');
  console.log('  pnpm run verify -- YOUR-STACK --json');
  console.log('  Then follow ../docs/FIRST-APP.md to publish and deploy your app.');
  console.log('  First deployment and DNS delegation: ../docs/QUICKSTART.md\n');
  console.log('  Inspect cloud resources through: pnpm run os -- stack list\n');

  closeReadline();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((e) => {
    error(`Setup failed: ${e instanceof Error ? e.message : e}`);
    closeReadline();
    process.exit(1);
  });
}
