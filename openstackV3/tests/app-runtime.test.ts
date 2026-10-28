import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LoadedApp } from '../scripts/infrastructure/app-manifest.js';
import { evaluateRelease, type ServiceRuntime } from '../scripts/infrastructure/app-runtime.js';

const desired = `registry.example.test/app:v2@sha256:${'a'.repeat(64)}`;
const previous = `registry.example.test/app:v1@sha256:${'b'.repeat(64)}`;
const app: LoadedApp = {
  directory: '/unused', manifestPath: '/unused/toad.yaml',
  manifest: { apiVersion: 'toad.dev/v1', name: 'demo', description: 'Fixture', stack: 'demo', compose: 'compose.yaml', files: ['compose.yaml'], services: ['web'], checks: [], secrets: [], volumes: [] },
  compose: { services: { web: { image: desired, deploy: { replicas: 2 } } } },
};

function runtime(image = desired, taskImage = image, state = 'completed'): ServiceRuntime {
  return {
    service: { ID: 'service', Spec: { Name: 'demo_web', Mode: { Replicated: { Replicas: 2 } }, TaskTemplate: { ContainerSpec: { Image: image } } }, UpdateStatus: { State: state } },
    running: 2, desired: 2,
    tasks: Array.from({ length: 2 }, () => ({ DesiredState: 'running', Spec: { ContainerSpec: { Image: taskImage } }, Status: { State: 'running' } })),
  };
}

test('release proof requires requested spec and running task digests, replica configuration, and completed update', () => {
  assert.equal(evaluateRelease(app, [runtime()]).ok, true);
  const staleTask = evaluateRelease(app, [runtime(desired, previous)]);
  assert.equal(staleTask.ok, false);
  assert.ok(staleTask.services[0]?.issues.includes('task_digest_mismatch'));
  const wrongReplicas = runtime();
  wrongReplicas.service.Spec!.Mode!.Replicated!.Replicas = 1;
  assert.ok(evaluateRelease(app, [wrongReplicas]).services[0]?.issues.includes('replica_configuration_mismatch'));
  assert.equal(evaluateRelease(app, [runtime(desired, desired, 'updating')]).outcome, 'pending');
});

test('healthy automatic rollback cannot count as delivery of the requested release', () => {
  const result = evaluateRelease(app, [runtime(previous, previous, 'rollback_completed')]);
  assert.equal(result.outcome, 'rolled_back');
  assert.equal(result.ok, false);
  assert.ok(result.services[0]?.issues.includes('service_digest_mismatch'));
  const recovery = evaluateRelease(app, [runtime(previous, previous, 'rollback_completed')], {
    expectedImages: { demo_web: previous }, allowCompletedRollback: true,
  });
  assert.equal(recovery.ok, true);
  const repaired = { ...app, compose: { services: { web: { image: previous, deploy: { replicas: 2 } } } } };
  assert.equal(evaluateRelease(repaired, [runtime(previous, previous, 'rollback_completed')]).ok, true);
});
