import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { publishAppImage, sourceFile } from '../scripts/infrastructure/app-image.js';

test('build context rejects private paths and symlink escapes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-source-test-'));
  try {
    mkdirSync(join(directory, 'source'));
    writeFileSync(join(directory, 'outside'), 'outside');
    symlinkSync(join(directory, 'outside'), join(directory, 'source', 'escape'));
    mkdirSync(join(directory, 'source', 'secrets'));
    writeFileSync(join(directory, 'source', 'secrets', 'fixture'), 'private-test-fixture');
    symlinkSync(join(directory, 'source', 'secrets', 'fixture'), join(directory, 'source', 'alias'));
    for (const path of ['../outside', '.env.production', 'credentials/clouds.yaml', 'secrets/api.age', 'escape', 'alias']) {
      assert.throws(() => sourceFile(join(directory, 'source'), path));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('publish sends only allow-listed source and pins the builder digest', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'toad-publish-test-'));
  try {
    const app = join(directory, 'demo');
    mkdirSync(join(app, 'source'), { recursive: true });
    writeFileSync(join(app, 'source', 'Dockerfile'), 'FROM scratch\n');
    writeFileSync(join(app, 'source', '.env'), 'excluded-test-fixture');
    writeFileSync(join(app, 'build.yaml'), stringify({ version: 1, port: 3000, files: ['Dockerfile'] }));
    writeFileSync(join(app, 'toad.yaml'), stringify({ apiVersion: 'toad.dev/v1', name: 'demo', description: 'fixture', stack: 'demo', compose: 'docker-compose.yaml', files: ['docker-compose.yaml'], services: ['web'], checks: [], secrets: [], volumes: [] }));
    writeFileSync(join(app, 'docker-compose.yaml'), stringify({ services: { web: {
      image: `example.test/app:v0@sha256:${'0'.repeat(64)}`, security_opt: ['no-new-privileges:true'],
      deploy: { replicas: 2, resources: { limits: { memory: '64M' } }, update_config: { failure_action: 'rollback' }, labels: ['traefik.http.services.web.loadbalancer.server.port=80'] },
    } } }));
    const image = await publishAppImage('demo', 'ghcr.io/owner/demo:v1', { appsDirectory: directory, builder: {
      async publish(context) {
        assert.equal(readFileSync(join(context, 'Dockerfile'), 'utf8'), 'FROM scratch\n');
        assert.throws(() => readFileSync(join(context, '.env')));
        return `sha256:${'a'.repeat(64)}`;
      },
    } });
    const compose = readFileSync(join(app, 'docker-compose.yaml'), 'utf8');
    assert.ok(compose.includes(image));
    assert.ok(compose.includes('.loadbalancer.server.port=3000'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
