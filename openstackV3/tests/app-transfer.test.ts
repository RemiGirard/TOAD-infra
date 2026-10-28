import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stageAppFiles } from '../scripts/infrastructure/app-transfer.js';

test('transfer snapshots only reviewed files and rejects symlink ancestors, escapes, and credential aliases', () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-transfer-fixture-'));
  try {
    mkdirSync(join(directory, 'public'));
    writeFileSync(join(directory, 'public', 'index.html'), 'reviewed fixture');
    writeFileSync(join(directory, 'unlisted.txt'), 'not included');
    const stage = stageAppFiles(directory, ['public/index.html']);
    try {
      writeFileSync(join(directory, 'public', 'index.html'), 'later change');
      assert.equal(readFileSync(join(stage.directory, 'public', 'index.html'), 'utf8'), 'reviewed fixture');
      assert.equal(existsSync(join(stage.directory, 'unlisted.txt')), false);
    } finally { stage.cleanup(); }
    mkdirSync(join(directory, 'credentials'));
    writeFileSync(join(directory, 'credentials', 'fixture.txt'), 'opaque test fixture');
    symlinkSync(join(directory, 'credentials'), join(directory, 'alias'));
    assert.throws(() => stageAppFiles(directory, ['alias/fixture.txt']), /without symlinks/);
    assert.throws(() => stageAppFiles(directory, ['credentials/fixture.txt']), /without credentials/);
    assert.throws(() => stageAppFiles(directory, ['../outside']), /safe relative paths/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
