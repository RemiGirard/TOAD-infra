import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { conventionalCommitError } from '../scripts/conventional-commit.js';

describe('Conventional Commit policy', () => {
  for (const subject of [
    'feat(app): add guarded deployment plans',
    'fix!: refuse an unsafe restore',
    'docs(recovery): explain volume choices',
    'chore(main): release 1.1.0',
  ]) {
    it(`accepts ${subject}`, () => assert.equal(conventionalCommitError(subject), undefined));
  }

  for (const subject of [
    'added a feature',
    'feature(app): unsupported type',
    'fix(App): scopes must be machine-friendly',
    'fix: ',
    `fix: ${'x'.repeat(96)}`,
  ]) {
    it(`rejects ${subject}`, () => assert.ok(conventionalCommitError(subject)));
  }
});
