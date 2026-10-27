import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePolicy } from '../scripts/presentation/pages/backup-job.js';

test('backup policy requires explicit client context and rejects remote argument/path injection', () => {
  const policy = { version: 1, operatorDirectory: '/opt/toad/openstackV3', outputDirectory: '/var/lib/toad/backups', rcloneConfig: '/etc/toad/rclone.conf', notificationFile: '/etc/toad/webhook', context: 'client-prod', remote: 'offsite:toad/client-prod' };
  assert.equal(parsePolicy(JSON.stringify(policy)).context, 'client-prod');
  for (const remote of ['--config=/tmp/other', 'offsite:../another-client', 'offsite:path;command', 'https://fixture@example.test']) {
    assert.throws(() => parsePolicy(JSON.stringify({ ...policy, remote })));
  }
  assert.throws(() => parsePolicy(JSON.stringify({ ...policy, context: '../client' })));
});
