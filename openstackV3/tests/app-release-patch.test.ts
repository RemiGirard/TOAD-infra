import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeRollbackPatch } from '../scripts/infrastructure/app-release-patch.js';

test('rollback writes a private reviewable patch without replacing Compose or an existing output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-rollback-'));
  try {
    const compose = join(directory, 'compose.yaml');
    const original = `services:\n  web:\n    image: registry.example.test/web:v2@sha256:${'a'.repeat(64)}\n    environment:\n      NODE_ENV: production\n`;
    writeFileSync(compose, original);
    const recovered = { web: `registry.example.test/web:v1@sha256:${'b'.repeat(64)}` };
    const output = join(directory, 'review.patch');
    assert.equal(writeRollbackPatch(compose, recovered, output), output);
    assert.equal(readFileSync(compose, 'utf8'), original);
    const patch = readFileSync(output, 'utf8');
    assert.match(patch, /--- a\/compose.yaml/);
    assert.match(patch, /\+    image:.*:v1@sha256/);
    assert.match(patch, /     NODE_ENV: production/);
    assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.throws(() => writeRollbackPatch(compose, recovered, output), /EEXIST/);
    assert.equal(writeRollbackPatch(compose, { web: `registry.example.test/web:v2@sha256:${'a'.repeat(64)}` }), undefined);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
