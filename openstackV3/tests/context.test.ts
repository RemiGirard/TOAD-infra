import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { contextDirectory, createContext, listContexts, validateContextName } from '../scripts/infrastructure/context.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'toad-context-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('client contexts', () => {
  it('accepts safe context names and rejects traversal', () => {
    assert.doesNotThrow(() => validateContextName('acme-prod'));
    for (const name of ['a', 'Acme', '../acme', 'acme_client', 'acme/other']) {
      assert.throws(() => validateContextName(name));
    }
  });

  it('scaffolds isolated config, credentials, backups, and metadata', () => {
    const base = temporaryDirectory();
    const directory = createContext('acme-prod', base);
    assert.equal(directory, contextDirectory('acme-prod', base));
    assert.ok(existsSync(join(directory, 'credentials')));
    assert.ok(existsSync(join(directory, 'backups')));
    assert.ok(existsSync(join(directory, 'router', 'config.yaml')));
    assert.ok(existsSync(join(directory, 'heat', 'production.yaml')));
    assert.equal(JSON.parse(readFileSync(join(directory, 'context.json'), 'utf8')).name, 'acme-prod');
    assert.deepEqual(listContexts(base), ['acme-prod']);
    assert.throws(() => createContext('acme-prod', base));
  });
});
