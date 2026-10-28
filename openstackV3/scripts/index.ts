#!/usr/bin/env npx tsx
/** Resolve explicit targets before importing context-dependent paths. */
import { resolve } from 'node:path';
try {
  const input = process.argv.slice(2).filter(arg => arg !== '--');
  const args: string[] = [];
  const globals = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const arg = input[index]!;
    if (arg === '--context' || arg === '--project') {
      if (globals.has(arg)) throw new Error(`Duplicate target option: ${arg}.`); globals.add(arg);
      const value = input[++index];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value.`);
      if (arg === '--context') {
        if (!/^[a-z][a-z0-9-]{1,31}$/.test(value)) throw new Error('Invalid context name.');
        process.env.TOAD_CONTEXT = value;
      } else process.env.TOAD_PROJECT_DIR = resolve(value);
    } else args.push(arg);
  }
  if (args.includes('--json')) process.env.TOAD_JSON = '1';
  process.argv = [...process.argv.slice(0, 2), ...args];
  await import('./cli-main.js');
} catch (cause) {
  const message = cause instanceof Error ? cause.message : 'TOAD could not start.';
  if (process.argv.includes('--json')) console.log(JSON.stringify({ version: 1, ok: false, error: { code: 'INVALID_TARGET', message } }));
  else console.error(message);
  process.exitCode = 1;
}
