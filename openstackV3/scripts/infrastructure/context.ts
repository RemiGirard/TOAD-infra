/** Local client-context scaffolding and selection. */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ACTIVE_CONTEXT, ACTIVE_CONTEXT_FILE, CONTEXTS_DIR, ROOT_DIR } from './paths.js';

export interface ContextMetadata {
  version: 1;
  name: string;
  createdAt: string;
}

export function validateContextName(name: string): void {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(name)) {
    throw new Error('Context names must be 2-32 lowercase letters, digits, or hyphens and start with a letter.');
  }
}

export function contextDirectory(name: string, contextsDirectory = CONTEXTS_DIR): string {
  validateContextName(name);
  return resolve(contextsDirectory, name);
}

export function contextExists(name: string, contextsDirectory = CONTEXTS_DIR): boolean {
  return existsSync(join(contextDirectory(name, contextsDirectory), 'context.json'));
}

export function createContext(name: string, contextsDirectory = CONTEXTS_DIR): string {
  const directory = contextDirectory(name, contextsDirectory);
  if (existsSync(directory)) throw new Error(`Context "${name}" already exists.`);
  mkdirSync(join(directory, 'credentials'), { recursive: true, mode: 0o700 });
  mkdirSync(join(directory, 'router'), { recursive: true, mode: 0o700 });
  mkdirSync(join(directory, 'heat'), { recursive: true, mode: 0o700 });
  mkdirSync(join(directory, 'backups'), { recursive: true, mode: 0o700 });
  copyFileSync(resolve(ROOT_DIR, '..', 'router', 'config.example.yaml'), join(directory, 'router', 'config.yaml'));
  copyFileSync(join(ROOT_DIR, 'heat', 'env', 'example.yaml'), join(directory, 'heat', 'production.yaml'));
  const metadata: ContextMetadata = { version: 1, name, createdAt: new Date().toISOString() };
  writeFileSync(join(directory, 'context.json'), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
  return directory;
}

export function listContexts(contextsDirectory = CONTEXTS_DIR): string[] {
  if (!existsSync(contextsDirectory)) return [];
  return readdirSync(contextsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && contextExists(entry.name, contextsDirectory))
    .map((entry) => entry.name)
    .sort();
}

export function useContext(name: string): void {
  if (!contextExists(name)) throw new Error(`Context "${name}" does not exist.`);
  mkdirSync(dirname(ACTIVE_CONTEXT_FILE), { recursive: true });
  writeFileSync(ACTIVE_CONTEXT_FILE, `${name}\n`, { mode: 0o600 });
}

export function clearContext(): void {
  if (existsSync(ACTIVE_CONTEXT_FILE)) unlinkSync(ACTIVE_CONTEXT_FILE);
}

export function currentContext(): string {
  return ACTIVE_CONTEXT ?? 'legacy';
}

export function readContext(name: string, contextsDirectory = CONTEXTS_DIR): ContextMetadata {
  if (!contextExists(name, contextsDirectory)) throw new Error(`Context "${name}" does not exist.`);
  return JSON.parse(readFileSync(join(contextDirectory(name, contextsDirectory), 'context.json'), 'utf8')) as ContextMetadata;
}
