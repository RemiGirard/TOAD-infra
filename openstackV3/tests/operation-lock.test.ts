import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { withOperationLock } from '../scripts/infrastructure/operation-lock.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('operation locking', () => {
  it('refuses a concurrent mutation and releases after completion', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'toad-lock-test-'));
    temporaryDirectories.push(directory);
    const lock = join(directory, 'operation.lock');
    await withOperationLock('outer', async () => {
      await assert.rejects(withOperationLock('inner', async () => undefined, lock), /holds the context lock/);
    }, lock);
    await assert.doesNotReject(withOperationLock('next', async () => undefined, lock));
  });
});
