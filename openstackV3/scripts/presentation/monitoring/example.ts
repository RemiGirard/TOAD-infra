import type { ObservationView } from '../../domain/entities/observation-view.js';

/** Public fixture only. No collector, credentials, customer data or cloud access. */
export function monitoringExamples(): Array<{ key: string; label: string; data: ObservationView }> {
  const v2 = `example/my-app@sha256:${'2'.repeat(64)}`;
  const v3 = `example/my-app@sha256:${'3'.repeat(64)}`;
  const healthy: ObservationView = {
    context: 'my-cloud / my-app', ok: true, generatedAt: '2026-10-28T12:30:00Z', expiresAt: '2026-10-28T12:31:00Z',
    nodes: [1, 2, 3].map(index => ({ hostname: `manager-${index}`, address: `10.0.0.${19 + index}`, role: 'manager', leader: index === 1, state: 'ready', reachability: 'reachable', availability: 'active' })),
    quorum: { healthy: 3, managers: 3, required: 2, state: 'available' },
    apps: [{ app: 'my-app', ok: true, outcome: 'deployed', services: [{ name: 'my-app_web', running: 2, desired: 2, expectedImage: v2, image: v2, actualDigests: [`sha256:${'2'.repeat(64)}`], issues: [], updateState: 'completed' }], checks: [{ name: 'app-home', ok: true, detail: 'HTTP 200 · expected status received', url: 'https://my-app.platform.example.com/' }], hints: [] }],
    monitoring: { state: 'observed', healthyTargets: 18, totalTargets: 18, firingAlerts: 0 },
    operation: null, history: [{ operation: 'app deploy my-app', state: 'completed', events: [{ phase: 'validate', at: '12:28:00 · example' }, { phase: 'rollout', at: '12:28:04 · example' }, { phase: 'verify', at: '12:29:40 · example' }] }],
    gaps: [], notifications: 'Outbound notification delivery is not verified by this observation.',
  };
  const rollback = structuredClone(healthy);
  rollback.ok = false;
  rollback.apps[0]!.ok = false;
  rollback.apps[0]!.outcome = 'rolled_back';
  rollback.apps[0]!.services[0]!.expectedImage = v3;
  rollback.apps[0]!.services[0]!.updateState = 'rollback_completed';
  rollback.apps[0]!.services[0]!.issues = ['release_rolled_back', 'task_digest_mismatch'];
  rollback.apps[0]!.hints = ['The new release rolled back. Version two is serving, but the requested version three did not ship. Inspect release images and logs before another change.'];
  rollback.gaps = ['Requested release was not delivered. Open Applications to compare its image with the recovered running image.'];
  rollback.history[0]!.state = 'failed';
  const unknown = structuredClone(healthy);
  unknown.ok = false; unknown.nodes = []; unknown.apps = [];
  unknown.quorum = { healthy: 0, managers: 0, required: 1, state: 'unknown' };
  unknown.monitoring = { state: 'unknown' }; unknown.history = [];
  unknown.gaps = ['Operator access is unavailable in this example. Missing observations do not establish whether the infrastructure is healthy.'];
  return [{ key: 'healthy', label: 'Healthy app', data: healthy }, { key: 'rollback', label: 'Release rolled back', data: rollback }, { key: 'unknown', label: 'Access unavailable', data: unknown }];
}
