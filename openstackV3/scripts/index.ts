#!/usr/bin/env npx tsx
/**
 * TOAD CLI entry point.
 *
 * Usage:
 *   pnpm run cli <command> [args...]
 */

import { run as setup } from './presentation/pages/setup.js';
import { run as discover } from './presentation/pages/discover.js';
import { run as deploy } from './presentation/pages/deploy.js';
import { run as destroy } from './presentation/pages/cleanup.js';
import { run as status } from './presentation/pages/status.js';
import { run as ssh } from './presentation/pages/ssh.js';
import { run as inventory } from './presentation/pages/inventory.js';
import { run as os } from './presentation/pages/os.js';
import { run as doctor } from './presentation/pages/doctor.js';
import { run as apply } from './presentation/pages/apply.js';
import { run as verify } from './presentation/pages/verify.js';
import { run as adminPki } from './presentation/pages/admin-pki.js';
import { run as dns } from './presentation/pages/dns.js';
import { run as dnsToken } from './presentation/pages/dns-token.js';
import { run as app } from './presentation/pages/app.js';
import { run as maintenance } from './presentation/pages/maintenance.js';
import { run as probe } from './presentation/pages/probe.js';
import { run as platform } from './presentation/pages/platform.js';
import { run as context } from './presentation/pages/context.js';
import { withOperationLock } from './infrastructure/operation-lock.js';

interface Command {
  description: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: Record<string, Command> = {
  setup:     { description: 'Initial setup (venv, credentials, SSH key)', handler: setup },
  discover:  { description: 'Show available OpenStack resources',         handler: discover },
  deploy:    { description: 'Deploy a Heat stack',                        handler: deploy },
  destroy:   { description: 'Delete a Heat stack',                        handler: destroy },
  status:    { description: 'Show infrastructure status',                 handler: status },
  ssh:       { description: 'SSH to a stack node',                        handler: ssh },
  inventory: { description: 'Generate Ansible inventory',                 handler: inventory },
  os:        { description: 'OpenStack CLI passthrough',                  handler: os },
  doctor:    { description: 'Diagnose local setup (supports --json)',     handler: doctor },
  apply:     { description: 'Apply and verify the complete production stack', handler: apply },
  verify:    { description: 'Run read-only production checks (--json)',   handler: verify },
  'admin-pki': { description: 'Issue an admin mTLS client certificate',   handler: adminPki },
  dns:        { description: 'Synchronize Infomaniak parent DNS',         handler: dns },
  'dns-token': { description: 'Securely store the Infomaniak DNS token',  handler: dnsToken },
  app:          { description: 'Create, deploy, inspect, and roll back apps', handler: app },
  maintenance:  { description: 'Quorum-aware Swarm node maintenance',       handler: maintenance },
  probe:        { description: 'Credential-free external HTTPS checks',     handler: probe },
  platform:     { description: 'Encrypted platform backup and restore',     handler: platform },
  context:      { description: 'Manage isolated client operator contexts',  handler: context },
};

function mutatesState(command: string, args: string[]): boolean {
  if (['apply', 'deploy', 'destroy', 'setup', 'inventory', 'admin-pki', 'dns', 'dns-token', 'os'].includes(command)) return true;
  if (command === 'maintenance') return args[0] !== 'status';
  if (command === 'platform') return !['list', 'verify'].includes(args[0] ?? '');
  if (command === 'app') {
    return !['validate', 'status', 'diagnose', 'verify', 'logs'].includes(args[0] ?? '');
  }
  return false;
}

function showHelp(): void {
  console.log('TOAD - OpenStack Infrastructure CLI\n');
  console.log('Usage: pnpm run cli <command> [args...]\n');
  console.log('Commands:');

  const maxLen = Math.max(...Object.keys(commands).map(k => k.length));
  for (const [name, cmd] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${cmd.description}`);
  }
}

async function main(): Promise<void> {
  const input = process.argv[2];
  const args = process.argv.slice(3).filter(arg => arg !== '--');

  if (!input || input === 'help' || input === '--help' || input === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = commands[input];

  if (!command) {
    console.error(`Unknown command: ${input}`);
    console.error('Run with --help to see available commands');
    process.exit(1);
  }

  if (mutatesState(input, args)) {
    await withOperationLock(`${input}${args[0] ? ` ${args[0]}` : ''}`, () => command.handler(args));
  } else {
    await command.handler(args);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
