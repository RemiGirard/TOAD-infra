import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ensureCloudKeypair } from '../scripts/infrastructure/cloud-keypair.js';

const publicKey = 'ssh-ed25519 AAAATESTPUBLICKEY operator';
test('existing matching keypairs tolerate comments and never create a replacement', () => {
  const calls: string[][] = [];
  const result = ensureCloudKeypair('toad-key', '/public/key.pub', publicKey, (args) => {
    calls.push(args);
    return args[1] === 'list' ? '[{"Name":"toad-key"}]' : 'ssh-ed25519 AAAATESTPUBLICKEY another-comment\n';
  });
  assert.equal(result, 'existing');
  assert.equal(calls.some((args) => args[1] === 'create'), false);
  assert.deepEqual(calls[1], ['keypair', 'show', 'toad-key', '--public-key']);
});
test('a different cloud public key stops setup without replacing it', () => {
  const calls: string[][] = [];
  assert.throws(() => ensureCloudKeypair('toad-key', '/public/key.pub', publicKey, (args) => {
    calls.push(args);
    return args[1] === 'list' ? '[{"Name":"toad-key"}]' : 'ssh-ed25519 DIFFERENTPUBLICKEY';
  }), /does not match/);
  assert.equal(calls.some((args) => args[1] === 'create'), false);
});
test('failed key uploads propagate instead of reporting successful setup', () => {
  assert.throws(() => ensureCloudKeypair('toad-key', '/public/key.pub', publicKey, (args) => {
    if (args[1] === 'list') return '[]';
    throw new Error('Keypair upload failed');
  }), /Keypair upload failed/);
});
test('a newly uploaded key must be readable and match the local key', () => {
  const calls: string[][] = [];
  assert.equal(ensureCloudKeypair('toad-key', '/public/key.pub', publicKey, (args) => {
    calls.push(args);
    if (args[1] === 'list') return '[]';
    if (args[1] === 'create') return '';
    return publicKey;
  }), 'created');
  assert.deepEqual(calls[1], ['keypair', 'create', '--public-key', '/public/key.pub', 'toad-key']);
  assert.deepEqual(calls[2], ['keypair', 'show', 'toad-key', '--public-key']);
});
