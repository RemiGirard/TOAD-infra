/** Compare a requested immutable application release with observed Swarm state. */
import type { LoadedApp } from './app-manifest.js';

export interface ServiceInspect {
  ID?: string;
  Spec?: {
    Name?: string;
    Mode?: { Replicated?: { Replicas?: number }; Global?: Record<string, unknown> };
    TaskTemplate?: { ContainerSpec?: { Image?: string } };
  };
  PreviousSpec?: { TaskTemplate?: { ContainerSpec?: { Image?: string } } };
  UpdateStatus?: { State?: string; Message?: string };
}

export interface TaskInspect {
  ID?: string;
  DesiredState?: string;
  Spec?: { ContainerSpec?: { Image?: string } };
  Status?: { State?: string; Err?: string; Message?: string; Timestamp?: string };
}

export interface ServiceRuntime {
  service: ServiceInspect;
  running: number;
  desired: number;
  tasks: TaskInspect[];
}

export type ReleaseOutcome = 'deployed' | 'rolled_back' | 'pending' | 'failed';

export function imageDigest(image: string | undefined): string | undefined {
  return image?.match(/@(sha256:[a-f0-9]{64})$/)?.[1];
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

export function expectedRelease(app: LoadedApp): Record<string, string> {
  const composeServices = object(app.compose.services) ?? {};
  return Object.fromEntries(app.manifest.services.map((name) => {
    const image = object(composeServices[name])?.image;
    if (typeof image !== 'string' || !imageDigest(image)) throw new Error('Every requested service must have an immutable image digest.');
    return [`${app.manifest.stack}_${name}`, image];
  }));
}

export function evaluateRelease(
  app: LoadedApp,
  runtimes: ServiceRuntime[],
  options: { expectedImages?: Record<string, string>; allowCompletedRollback?: boolean } = {},
) {
  const expectedImages = options.expectedImages ?? expectedRelease(app);
  const composeServices = object(app.compose.services) ?? {};
  const services = app.manifest.services.map((shortName) => {
    const name = `${app.manifest.stack}_${shortName}`;
    const runtime = runtimes.find((candidate) => candidate.service.Spec?.Name === name);
    const expectedImage = expectedImages[name] ?? '';
    const expectedDigest = imageDigest(expectedImage) ?? '';
    const actualImage = runtime?.service.Spec?.TaskTemplate?.ContainerSpec?.Image ?? '';
    const deploy = object(object(composeServices[shortName])?.deploy);
    const global = deploy?.mode === 'global';
    const declaredReplicas = typeof deploy?.replicas === 'number' ? deploy.replicas : 1;
    const desired = global ? runtime?.desired ?? 0 : declaredReplicas;
    const runningTasks = runtime?.tasks.filter((task) => task.Status?.State === 'running') ?? [];
    const activeTasks = runtime?.tasks.filter((task) => task.DesiredState === 'running') ?? [];
    const actualDigests = [...new Set(runningTasks.map((task) => imageDigest(task.Spec?.ContainerSpec?.Image) ?? 'unknown'))];
    const updateState = runtime?.service.UpdateStatus?.State ?? 'none';
    const issues: string[] = [];
    if (!runtime) issues.push('service_missing');
    if (!expectedDigest || imageDigest(actualImage) !== expectedDigest) issues.push('service_digest_mismatch');
    if (desired < 1 || runningTasks.length !== desired || activeTasks.some((task) => task.Status?.State !== 'running')) issues.push('replicas_pending');
    if (!global && runtime?.service.Spec?.Mode?.Replicated?.Replicas !== desired) issues.push('replica_configuration_mismatch');
    if (global && !runtime?.service.Spec?.Mode?.Global) issues.push('replica_configuration_mismatch');
    if (runningTasks.some((task) => imageDigest(task.Spec?.ContainerSpec?.Image) !== expectedDigest)) issues.push('task_digest_mismatch');
    if (!['none', 'completed', 'rollback_completed', 'paused', 'rollback_paused'].includes(updateState)) issues.push('update_pending');
    if (['paused', 'rollback_paused'].includes(updateState)) issues.push('update_failed');
    // A completed rollback may be historical after desired state was repaired.
    // Treat it as failed delivery when the requested immutable release differs.
    if (updateState === 'rollback_completed' && !options.allowCompletedRollback
      && (imageDigest(actualImage) !== expectedDigest || runningTasks.some((task) => imageDigest(task.Spec?.ContainerSpec?.Image) !== expectedDigest))) issues.push('release_rolled_back');
    return {
      id: runtime?.service.ID ?? '', name, expectedImage, expectedDigest,
      image: actualImage, actualDigest: imageDigest(actualImage) ?? '', actualDigests,
      running: runningTasks.length, desired, updateState, issues, ok: issues.length === 0,
    };
  });
  const unexpectedServices = runtimes.map((runtime) => runtime.service.Spec?.Name ?? '')
    .filter((name) => !services.some((service) => service.name === name));
  const outcome: ReleaseOutcome = services.some((service) => service.issues.includes('release_rolled_back')) ? 'rolled_back'
    : services.some((service) => service.issues.includes('update_failed')) || unexpectedServices.length > 0 ? 'failed'
      : services.every((service) => service.ok) ? 'deployed' : 'pending';
  return { outcome, ok: outcome === 'deployed', services, unexpectedServices };
}
