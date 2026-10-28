/** Private, timestamped infrastructure evidence shared by humans and agents. */
import { existsSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { inspectSwarm } from './swarm-maintenance.js';
import { readRouterConfig, listAppNames } from './app-manifest.js';
import { ADMIN_PKI_DIR, ACTIVE_CONTEXT } from './paths.js';
import { runProgram } from './shell.js';
import { readOperation, operationHistory, processExists } from './operation-lock.js';
import { collectAppDiagnosis } from './app-observation.js';

export async function observe(appName?: string) {
  const generatedAt = new Date().toISOString();
  let nodes: ReturnType<typeof inspectSwarm> = [];
  const gaps: string[] = [];
  try { nodes = inspectSwarm(); } catch { gaps.push('Swarm state unavailable; check operator SSH access and inventory.'); }
  const apps: Array<Awaited<ReturnType<typeof collectAppDiagnosis>>> = [];
  for (const name of appName ? [appName] : listAppNames()) {
    try { apps.push(await collectAppDiagnosis(name)); } catch { gaps.push(`Application ${name}: observation unavailable. Run app validate and diagnose in the selected context.`); }
  }
  let monitoring: { state: string; healthyTargets?: number; totalTargets?: number; firingAlerts?: number; links?: Record<string, string> } = { state: 'unknown' };
  try {
    const domain = readRouterConfig().base_domain;
    monitoring.links = { grafana: `https://grafana.${domain}/d/toad-overview`, metrics: `https://prometheus.${domain}/`, alerts: `https://alerts.${domain}/` };
    const certificate = join(ADMIN_PKI_DIR, 'operator.crt'); const key = join(ADMIN_PKI_DIR, 'operator.key');
    if (!existsSync(certificate) || !existsSync(key)) throw new Error('No operator identity.');
    const get = (path: string) => JSON.parse(runProgram('curl', ['--fail', '--silent', '--show-error', '--max-time', '8', '--cert', certificate, '--key', key, `https://prometheus.${domain}${path}`], { showCommand: false, showOutput: false })) as { status?: string; data?: { activeTargets?: Array<{ health?: string }>; alerts?: Array<{ state?: string }> } };
    const targets = get('/api/v1/targets'); const alerts = get('/api/v1/alerts');
    if (targets.status !== 'success' || alerts.status !== 'success' || !Array.isArray(targets.data?.activeTargets) || !Array.isArray(alerts.data?.alerts)) throw new Error('Monitoring response incomplete.');
    monitoring = { ...monitoring, state: 'observed', healthyTargets: targets.data.activeTargets.filter(item => item.health === 'up').length, totalTargets: targets.data.activeTargets.length, firingAlerts: alerts.data.alerts.filter(item => item.state === 'firing').length };
  } catch { gaps.push('Metrics and alert state unavailable. Restore the original admin mTLS identity; unknown does not mean healthy.'); }
  const current = readOperation() ?? null;
  if (current && (current.state === 'interrupted' || current.host !== hostname() || !processExists(current.pid))) gaps.push('An interrupted or unverified operation still holds the lock. Inspect workers and remote state before reconciling.');
  const expiresAt = new Date(Date.parse(generatedAt) + 60_000).toISOString();
  if (Date.now() >= Date.parse(expiresAt)) gaps.push('This collection exceeded the freshness budget; refresh before relying on the oldest checks.');
  const managers = nodes.filter(node => node.role === 'manager');
  const healthyManagers = managers.filter(node => node.state === 'ready' && node.reachability === 'reachable');
  return { version: 1, generatedAt, expiresAt, context: ACTIVE_CONTEXT ?? 'legacy', ok: gaps.length === 0 && managers.length >= 3 && healthyManagers.length === managers.length && apps.every(app => app.ok) && monitoring.state === 'observed' && monitoring.totalTargets! > 0 && monitoring.healthyTargets === monitoring.totalTargets && monitoring.firingAlerts === 0,
    nodes, quorum: { healthy: healthyManagers.length, managers: managers.length, required: Math.floor(managers.length / 2) + 1, state: managers.length === 0 ? 'unknown' : healthyManagers.length >= Math.floor(managers.length / 2) + 1 ? 'available' : 'degraded' }, apps, monitoring, operation: current, history: operationHistory(), gaps, notifications: 'Not verified by this snapshot. An Alertmanager dashboard alone does not establish notification delivery.' };
}
export type Observation = Awaited<ReturnType<typeof observe>>;
