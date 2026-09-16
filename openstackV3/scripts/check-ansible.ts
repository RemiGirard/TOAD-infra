/** Run Ansible syntax validation without relying on a shell loop. */

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT_DIR } from './infrastructure/paths.js';

const ansibleDirectory = resolve(ROOT_DIR, '..', 'ansible');
const executable = resolve(ansibleDirectory, 'venv', 'bin', 'ansible-playbook');
const inventory = resolve(ansibleDirectory, 'inventory.example.yaml');
const playbookDirectory = resolve(ansibleDirectory, 'playbooks');
const playbooks = readdirSync(playbookDirectory)
  .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
  .sort();

for (const playbook of playbooks) {
  console.log(`\nChecking ${playbook}`);
  const result = spawnSync(executable, [
    '--syntax-check',
    '-i', inventory,
    resolve(playbookDirectory, playbook),
  ], { cwd: ansibleDirectory, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nValidated ${playbooks.length} Ansible playbooks.`);
