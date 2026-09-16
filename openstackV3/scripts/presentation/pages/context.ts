/** Manage isolated local state for multiple client deployments. */

import { createContext, clearContext, currentContext, listContexts, readContext, useContext } from '../../infrastructure/context.js';
import { banner, error, success } from '../../infrastructure/cli.js';

function help(): void {
  console.log(`Usage: pnpm run context -- <command>

Commands:
  create NAME [--use]   Scaffold isolated config, credentials, state, and backups
  list [--json]         List contexts without reading credentials
  current [--json]      Show the selected context (legacy means existing paths)
  use NAME              Select a named context for future CLI invocations
  clear                 Return to the backward-compatible legacy context`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const json = args.includes('--json');
  if (!json) banner('TOAD Client Contexts');
  try {
    if (command === 'create') {
      const name = args.find((arg, index) => index > 0 && !arg.startsWith('--'));
      if (!name) throw new Error('create requires a context name.');
      const directory = createContext(name);
      if (args.includes('--use')) useContext(name);
      success(`Created context ${name} at ${directory}. Add credentials and customize its generated files.`);
      return;
    }
    if (command === 'list') {
      const contexts = listContexts();
      if (json) console.log(JSON.stringify({ ok: true, active: currentContext(), contexts }, null, 2));
      else for (const name of contexts) console.log(`${name === currentContext() ? '*' : ' '} ${name}`);
      return;
    }
    if (command === 'current') {
      const active = currentContext();
      const metadata = active === 'legacy' ? undefined : readContext(active);
      if (json) console.log(JSON.stringify({ ok: true, active, metadata }, null, 2));
      else console.log(active);
      return;
    }
    if (command === 'use') {
      const name = args[1];
      if (!name) throw new Error('use requires a context name.');
      useContext(name);
      success(`Selected context ${name}.`);
      return;
    }
    if (command === 'clear') {
      clearContext();
      success('Selected the legacy context.');
      return;
    }
    help();
    if (command) process.exitCode = 1;
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
