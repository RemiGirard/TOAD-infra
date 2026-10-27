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
import { run as backupJob } from './presentation/pages/backup-job.js';
import { withOperationLock } from './infrastructure/operation-lock.js';

interface Command {
  description: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: Record<string, Command> = {
  setup:     { description: 'Initial setup (venv, credentials, SSH key)', handler: setup },
  discover:  { description: 'Show available OpenStack resources',         handler: discover },
  deploy:    { description: 'Advanced: Heat resources only (no platform configuration)', handler: deploy },
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
  app:          { description: 'Publish and deploy apps to an existing platform', handler: app },
  maintenance:  { description: 'Quorum-aware Swarm node maintenance',       handler: maintenance },
  probe:        { description: 'Credential-free external HTTPS checks',     handler: probe },
  platform:     { description: 'Encrypted platform backup and restore',     handler: platform },
  context:      { description: 'Manage isolated client operator contexts',  handler: context },
  'backup-job': { description: 'Verify and send encrypted platform backups offsite', handler: backupJob },
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

const usage: Record<string, string> = {
  setup: 'pnpm run setup\n  Prepare the selected operator context; then configure its Heat/router files, store the DNS token, and run apply.',
  apply: 'pnpm run apply -- STACK [ENV]\n  Provision and configure the production cloud, then verify it.\n  Omit ENV to use the selected context\'s production configuration. Creates billable resources and updates platform DNS.',
  deploy: 'pnpm run deploy -- [1|5] [STACK] [ENV]\n  Advanced Heat-only command; does not configure Docker, Swarm, or HTTPS.\n  For a usable app platform, follow ../docs/QUICKSTART.md and run apply.',
  app: 'pnpm run app -- <command> NAME [options]\n\n  After cloud apply and verification:\n  pnpm run app -- create my-app --template node-web\n  pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1\n  pnpm run app -- validate my-app\n  pnpm run app -- deploy my-app\n  pnpm run app -- diagnose my-app --json\n\n  Also: status, verify, logs, rollback, backup, restore, remove, secret.\n  Complete app workflow: ../docs/FIRST-APP.md',
  context: 'pnpm run context -- create NAME --use\n  Scaffold and select isolated cloud configuration and operator state.\n  Also: current [--json], list [--json], use NAME, clear.',
};

function showHelp(name?: string): void {
  if (name && commands[name]) {
    console.log(`TOAD / ${name}: ${commands[name].description}\n`);
    console.log(usage[name] ?? `pnpm run ${name} -- <arguments>\nSee README.md and ../docs/AGENT-RUNBOOK.md for command details.`);
    return;
  }
  console.log('TOAD - OpenStack Infrastructure CLI\n');
  console.log('Usage: pnpm run cli <command> [args...]\n');
  console.log('Start here: cloud first, then applications.');
  console.log('  1. context create NAME --use; add that cloud\'s credentials');
  console.log('  2. setup; discover; configure the context; dns-token');
  console.log('  3. check; apply STACK; complete DNS delegation; verify STACK --json');
  console.log('  4. app create / publish / validate / deploy / diagnose');
  console.log('  Guided commands: ../docs/QUICKSTART.md\n');
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
    showHelp(input === 'help' ? args[0] : undefined);
    process.exit(0);
  }

  const command = commands[input];

  if (!command) {
    console.error(`Unknown command: ${input}`);
    console.error('Run with --help to see available commands');
    process.exit(1);
  }

  // Help must never enter a mutating handler or acquire an operator lock.
  if (args.includes('--help') || args.includes('-h')) {
    showHelp(input);
    return;
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
