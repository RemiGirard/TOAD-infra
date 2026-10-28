import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppArguments } from '../scripts/infrastructure/app-arguments.js';

test('app mutations reject unsupported safety flags and excess targets before execution', () => {
  for (const command of ['deploy', 'rollback', 'remove', 'restore', 'release']) {
    assert.throws(() => parseAppArguments([command, 'demo', '--dry-run']), /Unknown option/);
  }
  assert.throws(() => parseAppArguments(['deploy', 'demo', 'other']), /positional argument/);
  assert.throws(() => parseAppArguments(['publish', 'demo', '--image']), /requires a value/);
  assert.throws(() => parseAppArguments(['deploy', 'demo', '--json', '--json']), /Duplicate option/);
});

test('log options cannot inject remote shell arguments and command help stays non-mutating', () => {
  const parsed = parseAppArguments(['logs', 'demo', '--follow', '--tail', '200', '--since', '15m']);
  assert.equal(parsed.options['--follow'], true);
  assert.equal(parsed.options['--tail'], '200');
  assert.throws(() => parseAppArguments(['logs', 'demo', '--since', '15m;id']), /duration or timestamp/);
  assert.throws(() => parseAppArguments(['logs', 'demo', '--tail', '-1']), /requires a value/);
  assert.equal(parseAppArguments(['deploy', 'demo', '--help']).help, true);
});
