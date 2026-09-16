/** age-encrypted application secrets deployed to Swarm without remote plaintext files. */

import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { AppManifest, APPS_DIR } from './app-manifest.js';
import { APP_AGE_IDENTITY_PATH, INVENTORY_PATH, SSH_KEY_PATH } from './paths.js';
import { programExists, runProgram, runProgramInput } from './shell.js';

interface InventoryHost {
  ansible_host?: string;
}

interface SecretSpec {
  name: string;
  source: string;
  environment: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function requireAge(): void {
  if (!programExists('age') || !programExists('age-keygen')) {
    throw new Error('age and age-keygen are required for app secrets. Install the open-source age package first.');
  }
}

export function ensureAgeIdentity(): string {
  requireAge();
  if (!existsSync(APP_AGE_IDENTITY_PATH)) {
    mkdirSync(dirname(APP_AGE_IDENTITY_PATH), { recursive: true, mode: 0o700 });
    runProgram('age-keygen', ['-o', APP_AGE_IDENTITY_PATH], {
      showOutput: false,
      displayCommand: 'age-keygen -o <ignored-credentials-path>',
    });
    chmodSync(APP_AGE_IDENTITY_PATH, 0o600);
  }
  return runProgram('age-keygen', ['-y', APP_AGE_IDENTITY_PATH], {
    showCommand: false,
    showOutput: false,
  }).trim();
}

export function encryptAppSecret(appName: string, secret: SecretSpec, source: string): string {
  const recipient = ensureAgeIdentity();
  if (!existsSync(source)) throw new Error(`Secret input file does not exist: ${source}`);
  const destination = resolve(APPS_DIR, appName, secret.source);
  mkdirSync(dirname(destination), { recursive: true, mode: 0o750 });
  runProgram('age', ['--encrypt', '--recipient', recipient, '--output', destination, source], {
    showOutput: false,
    displayCommand: `age --encrypt --recipient <TOAD-recipient> --output ${secret.source} <secret-input>`,
  });
  chmodSync(destination, 0o640);
  return destination;
}

export function managerSshArgs(): string[] {
  const inventoryPath = INVENTORY_PATH;
  if (!existsSync(inventoryPath)) throw new Error('inventory.yaml is missing.');
  const inventory = record(parseYaml(readFileSync(inventoryPath, 'utf8')));
  const all = record(inventory?.all);
  const children = record(all?.children);
  const managers = record(record(children?.managers)?.hosts);
  const first = managers ? Object.values(managers)[0] as InventoryHost | undefined : undefined;
  if (!first?.ansible_host) throw new Error('No manager SSH endpoint exists in inventory.yaml.');
  const vars = record(all?.vars);
  const user = typeof vars?.ansible_user === 'string' ? vars.ansible_user : 'ubuntu';
  return [
    '-i', SSH_KEY_PATH,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    `${user}@${first.ansible_host}`,
  ];
}

function secretExists(name: string): boolean {
  try {
    runProgram('ssh', [...managerSshArgs(), 'sudo', 'docker', 'secret', 'inspect', name], {
      showCommand: false,
      showOutput: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function deployAppSecrets(manifest: AppManifest): Record<string, string> {
  if (manifest.secrets.length === 0) return {};
  requireAge();
  if (!existsSync(APP_AGE_IDENTITY_PATH)) {
    throw new Error(`The age identity is missing: ${APP_AGE_IDENTITY_PATH}. Restore it from the operator secret backup.`);
  }

  const environment: Record<string, string> = {};
  for (const secret of manifest.secrets) {
    const encryptedPath = resolve(APPS_DIR, manifest.name, secret.source);
    const plaintext = runProgram('age', ['--decrypt', '--identity', APP_AGE_IDENTITY_PATH, encryptedPath], {
      showCommand: false,
      showOutput: false,
    });
    const hash = createHash('sha256').update(plaintext).digest('hex').slice(0, 12);
    const swarmName = `${manifest.stack}-${secret.name}-${hash}`;
    if (!secretExists(swarmName)) {
      runProgramInput(
        'ssh',
        [...managerSshArgs(), 'sudo', 'docker', 'secret', 'create', swarmName, '-'],
        plaintext,
        {
          showOutput: false,
          displayCommand: `ssh <manager> sudo docker secret create ${swarmName} -`,
        },
      );
    }
    environment[secret.environment] = swarmName;
  }
  return environment;
}

export type { SecretSpec };
