/** Read-only Swarm release and HTTPS evidence for CLI, agents and private views. */
import { loadApp, readRouterConfig, expandAppValue } from './app-manifest.js';
import { managerSshArgs } from './app-secrets.js';
import { runProgram } from './shell.js';
import { evaluateRelease, type ServiceInspect, type ServiceRuntime, type TaskInspect } from './app-runtime.js';
import { assertOperationRunning, readOperation } from './operation-lock.js';
import { currentContext } from './context.js';

export function appTargetMetadata() {
  let operationId: string | null = null;
  try { operationId = readOperation()?.id ?? null; } catch { /* An unreadable lock remains a separate operation-status issue. */ }
  return { context: currentContext(), operationId };
}

export function dockerFromManager(args: string[]): string {
  return runProgram('ssh', [...managerSshArgs(), 'sudo', 'docker', ...args], {
    showCommand: false,
    showOutput: false,
  });
}

export function serviceStatus(manifest: ReturnType<typeof loadApp>['manifest']): ServiceRuntime[] {
  let rawIds = '';
  try {
    rawIds = dockerFromManager(['stack', 'services', manifest.stack, '--quiet']);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/nothing found in stack|no such stack/i.test(message)) return [];
    throw cause;
  }
  const ids = rawIds.split('\n').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  const services = JSON.parse(dockerFromManager(['service', 'inspect', ...ids])) as ServiceInspect[];
  return services.map((service) => {
    const taskIds = dockerFromManager(['service', 'ps', service.ID ?? '', '--quiet'])
      .split('\n').map((id) => id.trim()).filter(Boolean);
    const tasks = taskIds.length > 0
      ? JSON.parse(dockerFromManager(['inspect', ...taskIds])) as TaskInspect[]
      : [];
    return {
      service,
      running: tasks.filter((task) => task.DesiredState === 'running' && task.Status?.State === 'running').length,
      desired: tasks.filter((task) => task.DesiredState === 'running').length,
      tasks,
    };
  });
}

export function statusResult(app: ReturnType<typeof loadApp>, runtimes = serviceStatus(app.manifest)) {
  const release = evaluateRelease(app, runtimes);
  return {
    version: 1,
    ...appTargetMetadata(),
    ...release,
    app: app.manifest.name,
    stack: app.manifest.stack,
  };
}

export interface EndpointResult {
  name: string;
  url: string;
  expectedStatus: number;
  actualStatus?: number;
  durationMs: number;
  ok: boolean;
  detail: string;
}

export async function checkEndpoints(manifest: ReturnType<typeof loadApp>['manifest'], attempts = 12): Promise<EndpointResult[]> {
  if (manifest.checks.length === 0) return [];
  const config = readRouterConfig();
  const results = new Array<EndpointResult>(manifest.checks.length);
  const deadline = Date.now() + 120_000;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < manifest.checks.length) {
      assertOperationRunning();
      const index = next++;
      const check = manifest.checks[index]!;
      const url = expandAppValue(check.url, config);
      let result = 'Verification budget exhausted';
      let ok = false;
      let actualStatus: number | undefined;
      const startedAt = Date.now();
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        assertOperationRunning();
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
          const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(Math.min(15_000, remaining)) });
          result = `HTTP ${response.status}`;
          actualStatus = response.status;
          ok = response.status === check.status;
          void response.body?.cancel().catch(() => {});
        } catch {
          result = 'Network, DNS, or TLS request failed';
        }
        if (ok || attempt === attempts) break;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(5_000, Math.max(0, deadline - Date.now()))));
      }
      results[index] = {
        name: check.name,
        url,
        expectedStatus: check.status,
        ...(actualStatus === undefined ? {} : { actualStatus }),
        durationMs: Date.now() - startedAt,
        ok,
        detail: result,
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, manifest.checks.length) }, worker));
  return results;
}

export async function collectAppDiagnosis(name: string) {
  const app = loadApp(name);
  const { manifest } = app;
  const runtimes = serviceStatus(manifest);
  const runtime = statusResult(app, runtimes);
  const checks = await checkEndpoints(manifest, 1);
  const failedStates = new Set(['failed', 'rejected', 'orphaned']);
  const failedTasks = runtimes.flatMap(({ service, tasks }) => tasks
    .filter((task) => Boolean(task.Status?.Err) || failedStates.has(task.Status?.State ?? ''))
    .map((task) => ({
      service: service.Spec?.Name,
      taskId: task.ID,
      desiredState: task.DesiredState,
      state: task.Status?.State,
      error: task.Status?.Err ? 'Task reported an infrastructure error; inspect service logs locally.' : '',
      category: /pull|image|manifest|registry/i.test(task.Status?.Err ?? '') ? 'image_pull'
        : /mount|volume/i.test(task.Status?.Err ?? '') ? 'storage'
          : /health/i.test(task.Status?.Err ?? '') ? 'healthcheck' : 'task_failure',
      timestamp: task.Status?.Timestamp,
    })));
  const hints: string[] = [];
  if (runtime.services.length === 0) hints.push(`Deploy the stack with: pnpm run app -- deploy ${manifest.name}`);
  if (!runtime.ok && runtime.services.length > 0) hints.push(`Inspect recent tasks and logs with: pnpm run app -- logs ${manifest.name}`);
  if (checks.some((check) => !check.ok)) hints.push('Check Traefik router labels, service port, DNS, and certificate issuance.');
  if (failedTasks.length > 0) hints.push('Use the failed task error before retrying or requesting a rollback.');
  if (runtime.outcome === 'rolled_back') hints.push(`The new release rolled back. Review expected/actual digests, then run: pnpm run app -- logs ${manifest.name} --since 15m`);
  if (runtime.services.some((service) => service.issues.includes('service_digest_mismatch') || service.issues.includes('task_digest_mismatch'))) hints.push('The intended release is not running. Inspect update state before retrying; do not treat healthy old replicas as successful delivery.');
  const ok = runtime.ok && checks.every((check) => check.ok);
  return {
    version: 1,
    ...appTargetMetadata(),
    ok,
    outcome: runtime.outcome === 'deployed' && !ok ? 'failed' : runtime.outcome,
    app: manifest.name,
    stack: manifest.stack,
    validation: { ok: true },
    services: runtime.services,
    unexpectedServices: runtime.unexpectedServices,
    checks,
    failedTasks,
    hints,
  };
}
