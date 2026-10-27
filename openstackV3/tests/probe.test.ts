import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../scripts/presentation/pages/probe.js';

test('explicit HTTPS probe works without private router configuration', async (t) => {
  const messages: string[] = [];
  t.mock.method(console, 'log', (message: string) => messages.push(message));
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://public.example.test/');
    return new Response('ok', { status: 200 });
  });
  await run(['--url', 'https://public.example.test/', '--json']);
  const result = JSON.parse(messages.join(''));
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 1);
});

test('probe rejects credentials in a URL and returns parseable JSON errors', async (t) => {
  const messages: string[] = [];
  const previous = process.exitCode;
  t.mock.method(console, 'log', (message: string) => messages.push(message));
  try {
    await run(['--url', 'https://user:fixture@example.test/', '--json']);
    assert.equal(JSON.parse(messages.join('')).ok, false);
    assert.ok(!messages.join('').includes('fixture'));
    assert.equal(process.exitCode, 1);
  } finally { process.exitCode = previous; }
});
