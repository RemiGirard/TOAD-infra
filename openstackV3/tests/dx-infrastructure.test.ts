import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validateCommandArguments } from '../scripts/infrastructure/command-arguments.js';
import { acknowledgeInterruptedOperation, withOperationLock, operationHistory } from '../scripts/infrastructure/operation-lock.js';
import { renderObservation, type Observation } from '../scripts/infrastructure/observation.js';
import { appSecretPath } from '../scripts/infrastructure/app-manifest.js';

test('unsupported safety flags fail before any command handler', () => {
  assert.throws(() => validateCommandArguments('cloud', ['apply', 'demo', '--dry-run']), /Unsupported/);
  assert.throws(() => validateCommandArguments('cloud', ['apply', '--json']), /explicit STACK/);
  assert.throws(() => validateCommandArguments('doctor', ['--for']), /requires a value/);
});
test('dead coordinator locks remain until explicit local acknowledgement', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-interrupted-'));
  const path = join(directory, '.operation.lock');
  try {
    writeFileSync(path, JSON.stringify({ version: 1, id: '00000000-0000-4000-8000-000000000000', pid: 2147483647, host: hostname(), workers: [], operation: 'app deploy example', phase: 'rollout', state: 'running', createdAt: new Date().toISOString(), events: [] }));
    await assert.rejects(withOperationLock('next', async () => undefined, path), /holds the context lock/);
    assert.equal(existsSync(path), true);
    acknowledgeInterruptedOperation(path);
    assert.equal(existsSync(path), false);
    assert.equal(operationHistory(path)[0]?.state, 'acknowledged');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('private operation view escapes observed names and embeds explicit expiry', () => {
  const observation = { version: 1, ok: false, context: '<script>unsafe</script>', generatedAt: '2026-10-28T09:00:00Z', expiresAt: '2026-10-28T09:01:00Z', nodes: [], apps: [{ app: '<img src=x onerror=unsafe()>', ok: false, outcome: 'failed', services: [{ name: '<svg onload=unsafe()>', running: 0, desired: 2, expectedImage: '', image: '', updateState: '' }], checks: [], hints: [] }], quorum: { state: 'unknown', healthy: 0, managers: 0, required: 1 }, monitoring: { state: 'unknown' }, operation: null, history: [], gaps: ['Metrics unavailable'], notifications: 'Not verified' } as Observation;
  const html = renderObservation(observation);
  assert.equal(html.includes('<script>unsafe</script>'), false);
  assert.equal(html.includes('<img src=x onerror=unsafe()>'), false);
  assert.equal(html.includes('<svg onload=unsafe()>'), false);
  assert.match(html, /data-expiry="2026-10-28T09:01:00Z"/);
  assert.match(html, /Stale evidence/);
  assert.match(html, /Metrics unavailable/);
});
test('ciphertext paths cannot follow a secret-directory alias into another project', () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-secret-boundary-'));
  try {
    mkdirSync(join(directory, 'app')); mkdirSync(join(directory, 'other'));
    writeFileSync(join(directory, 'other', 'token.age'), 'ciphertext fixture');
    symlinkSync(join(directory, 'other'), join(directory, 'app', 'secrets'));
    assert.throws(() => appSecretPath(join(directory, 'app'), 'secrets/token.age'), /symlink/);
    assert.throws(() => appSecretPath(join(directory, 'app'), 'secrets/new.age', true), /symlink/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
