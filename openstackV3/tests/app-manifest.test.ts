import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { loadApp } from '../scripts/infrastructure/app-manifest.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function validService(): Record<string, unknown> {
  return {
    image: 'traefik/whoami:v1.11.0@sha256:200689790a0a0ea48ca45992e0450bc26ccab5307375b41c84dfc4f2475937ab',
    security_opt: ['no-new-privileges:true'],
    networks: ['traefik-public'],
    deploy: {
      replicas: 2,
      resources: { limits: { memory: '64M' } },
      update_config: { failure_action: 'rollback' },
    },
  };
}

function fixture(
  mutate?: (manifest: Record<string, unknown>, compose: Record<string, unknown>) => void,
): { appsDirectory: string; appDirectory: string } {
  const appsDirectory = mkdtempSync(join(tmpdir(), 'toad-apps-'));
  temporaryDirectories.push(appsDirectory);
  const appDirectory = join(appsDirectory, 'demo');
  mkdirSync(appDirectory);
  const manifest: Record<string, unknown> = {
    apiVersion: 'toad.dev/v1',
    name: 'demo',
    description: 'Test application',
    stack: 'demo',
    compose: 'docker-compose.yaml',
    files: ['docker-compose.yaml'],
    services: ['web'],
    checks: [{ name: 'web', url: 'https://demo.example.test/', status: 200 }],
    secrets: [],
    volumes: [],
  };
  const compose: Record<string, unknown> = {
    services: { web: validService() },
    networks: { 'traefik-public': { external: true } },
  };
  mutate?.(manifest, compose);
  writeFileSync(join(appDirectory, 'toad.yaml'), stringify(manifest));
  writeFileSync(join(appDirectory, 'docker-compose.yaml'), stringify(compose));
  return { appsDirectory, appDirectory };
}

describe('application manifest policy', () => {
  test('accepts a pinned, bounded, rollback-enabled service', () => {
    const { appsDirectory } = fixture();
    const app = loadApp('demo', appsDirectory);
    assert.equal(app.manifest.name, 'demo');
    assert.deepEqual(app.manifest.services, ['web']);
  });

  const forbidden: Array<[string, (service: Record<string, any>) => void, RegExp]> = [
    ['images without a digest', (service) => { service.image = 'nginx:1.29.1-alpine'; }, /immutable sha256 digest/],
    ['published ports', (service) => { service.ports = ['8080:80']; }, /published ports are forbidden/],
    ['privileged containers', (service) => { service.privileged = true; }, /privileged containers are forbidden/],
    ['host networking', (service) => { service.network_mode = 'host'; }, /host namespace sharing/],
    ['added capabilities', (service) => { service.cap_add = ['SYS_ADMIN']; }, /added Linux capabilities/],
    ['missing no-new-privileges', (service) => { service.security_opt = []; }, /no-new-privileges/],
    ['missing memory limits', (service) => { service.deploy.resources = {}; }, /limits.memory is required/],
    ['Docker socket mounts', (service) => { service.volumes = ['/var/run/docker.sock:/var/run/docker.sock']; }, /Docker socket is forbidden/],
  ];

  for (const [label, mutate, expected] of forbidden) {
    test(`rejects ${label}`, () => {
      const { appsDirectory } = fixture((_manifest, compose) => {
        mutate((compose.services as Record<string, Record<string, any>>).web!);
      });
      assert.throws(() => loadApp('demo', appsDirectory), expected);
    });
  }

  test('rejects deployment files outside the application directory', () => {
    const { appsDirectory } = fixture((manifest) => {
      manifest.files = ['docker-compose.yaml', '../credentials'];
    });
    assert.throws(() => loadApp('demo', appsDirectory), /unsafe path/);
  });

  test('accepts a declared encrypted secret contract', () => {
    const { appsDirectory, appDirectory } = fixture((manifest, compose) => {
      manifest.secrets = [{ name: 'api-token', source: 'secrets/api-token.age', environment: 'API_TOKEN_SECRET' }];
      (compose.services as Record<string, Record<string, unknown>>).web!.secrets = ['api-token'];
      compose.secrets = { 'api-token': { external: true, name: '${API_TOKEN_SECRET}' } };
    });
    mkdirSync(join(appDirectory, 'secrets'));
    writeFileSync(join(appDirectory, 'secrets', 'api-token.age'), 'age-encrypted-test-fixture');
    assert.equal(loadApp('demo', appsDirectory).manifest.secrets.length, 1);
  });

  test('requires local state to be single-replica, pinned, and declared', () => {
    const { appsDirectory } = fixture((manifest, compose) => {
      manifest.volumes = [{ name: 'data', backup: 'required', description: 'Test data' }];
      compose.volumes = { data: {} };
      const web = (compose.services as Record<string, Record<string, any>>).web!;
      web.volumes = ['data:/data'];
    });
    assert.throws(() => loadApp('demo', appsDirectory), /exactly one replica.*stateful-primary/s);
  });

  test('accepts the constrained single-node state contract', () => {
    const { appsDirectory } = fixture((manifest, compose) => {
      manifest.volumes = [{ name: 'data', backup: 'required', description: 'Test data' }];
      compose.volumes = { data: {} };
      const web = (compose.services as Record<string, Record<string, any>>).web!;
      web.volumes = ['data:/data'];
      web.deploy.replicas = 1;
      web.deploy.placement = { constraints: ['node.labels.toad.stateful-primary == true'] };
    });
    assert.equal(loadApp('demo', appsDirectory).manifest.volumes[0]?.backup, 'required');
  });
});
