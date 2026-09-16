import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBackupIndex } from '../scripts/infrastructure/backup-index.js';

const hash = 'a'.repeat(64);

describe('platform backup index', () => {
  it('resolves archives stored beside the index', () => {
    const parsed = parseBackupIndex(JSON.stringify({
      version: 1,
      createdAt: '2026-09-16T00:00:00.000Z',
      archives: [{ dataset: 'loki-data', file: 'loki-data.tar.age', sha256: hash }],
    }), '/safe/backup/index.json');
    assert.equal(parsed.archives[0]?.path, '/safe/backup/loki-data.tar.age');
    const legacy = parseBackupIndex(JSON.stringify({
      version: 1,
      createdAt: '2026-09-16T00:00:00.000Z',
      archives: [{ dataset: 'loki-data', file: '/old/machine/loki-data.tar.age', sha256: hash }],
    }), '/safe/backup/index.json');
    assert.equal(legacy.archives[0]?.path, '/safe/backup/loki-data.tar.age');
  });

  it('rejects traversal, empty indexes, and invalid hashes', () => {
    for (const archives of [
      [],
      [{ dataset: 'loki-data', file: '../other.tar.age', sha256: hash }],
      [{ dataset: 'loki-data', file: 'loki-data.tar.age', sha256: 'short' }],
    ]) {
      assert.throws(() => parseBackupIndex(JSON.stringify({
        version: 1,
        createdAt: '2026-09-16T00:00:00.000Z',
        archives,
      }), '/safe/backup/index.json'));
    }
  });
});
