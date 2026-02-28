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
};

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

  await command.handler(args);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
