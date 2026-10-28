/** Durable operation ownership; interrupted coordinators are never silently unlocked. */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, renameSync, readdirSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';
import { ACTIVE_CONTEXT, OPERATION_LOCK_PATH } from './paths.js';

export interface OperationRecord {
  version: 1; id: string; pid: number; host: string; context: string;
  operation: string; phase: string; state: 'running' | 'completed' | 'failed' | 'waiting' | 'interrupted' | 'acknowledged';
  createdAt: string; updatedAt: string; workers: number[];
  events: Array<{ phase: string; at: string }>;
}
let active: { record: OperationRecord; path: string } | undefined;
const workers = new Map<number, ChildProcess>();
function lockGuard<T>(path: string, action: () => T): T {
  const guard = `${path}.guard`;
  let descriptor: number;
  try { descriptor = openSync(guard, 'wx', 0o600); }
  catch { throw new Error('Operation lock acquisition or reconciliation is already in progress. Inspect the private lock guard and local coordinator before retrying.'); }
  try { writeFileSync(descriptor, JSON.stringify({ pid: process.pid, host: hostname() })); return action(); }
  finally { closeSync(descriptor); unlinkSync(guard); }
}
export function assertOperationRunning(): void {
  if (active?.record.state === 'interrupted') throw new Error('Operation interrupted. Inspect its state before reconciliation; no further action was started.');
}
export function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (cause) { return (cause as NodeJS.ErrnoException).code === 'EPERM'; }
}
function save(): void {
  if (!active) return;
  active.record.updatedAt = new Date().toISOString();
  const directory = join(dirname(active.path), 'operations');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const serialized = `${JSON.stringify(active.record, null, 2)}\n`;
  for (const path of [active.path, join(directory, `${active.record.id}.json`)]) {
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, serialized, { mode: 0o600 }); renameSync(temporary, path);
  }
}
export function setOperationPhase(phase: string): void {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(phase)) throw new Error('Invalid operation phase.');
  if (!active) return;
  if (phase !== 'interrupted') assertOperationRunning();
  active.record.phase = phase;
  active.record.events.push({ phase, at: new Date().toISOString() }); save();
  if (process.env.TOAD_JSON !== '1') console.error(`[TOAD ${active.record.id.slice(0, 8)}] ${phase}`);
}
export function trackOperationWorker(child: ChildProcess): void {
  if (active?.record.state === 'interrupted') { child.kill('SIGTERM'); assertOperationRunning(); }
  if (!child.pid || !active) return;
  const pid = child.pid; workers.set(pid, child); active.record.workers.push(pid); save();
  child.once('close', () => {
    workers.delete(pid);
    if (active) { active.record.workers = active.record.workers.filter(value => value !== pid); save(); }
  });
}
export function readOperation(path = OPERATION_LOCK_PATH): OperationRecord | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8')) as OperationRecord;
}
export function operationHistory(path = OPERATION_LOCK_PATH): OperationRecord[] {
  const directory = join(dirname(path), 'operations');
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(file => /^[a-f0-9-]+\.json$/.test(file))
    .map(file => JSON.parse(readFileSync(join(directory, file), 'utf8')) as OperationRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
}
export function acknowledgeInterruptedOperation(path = OPERATION_LOCK_PATH): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  lockGuard(path, () => {
  const record = readOperation(path);
  if (!record) return;
  if (record.host !== hostname() || processExists(record.pid) || (record.workers ?? []).some(processExists)) {
    throw new Error('The coordinator or a worker may still be running. Inspect operation status before reconciling.');
  }
  record.state = 'acknowledged'; record.updatedAt = new Date().toISOString();
  const directory = join(dirname(path), 'operations'); mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, `${record.id ?? randomUUID()}.json`), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  unlinkSync(path);
  });
}
export async function withOperationLock<T>(operation: string, action: () => Promise<T>, path = OPERATION_LOCK_PATH): Promise<T> {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let descriptor: number;
  try { descriptor = lockGuard(path, () => openSync(path, 'wx', 0o600)); }
  catch { throw new Error(`Another TOAD mutation holds the context lock at ${path}. Run operation status; interrupted work requires operation reconcile --acknowledge-interrupted after inspecting remote state.`); }
  closeSync(descriptor);
  const now = new Date().toISOString();
  active = { path, record: { version: 1, id: randomUUID(), pid: process.pid, host: hostname(), context: ACTIVE_CONTEXT ?? 'legacy', operation, phase: 'starting', state: 'running', createdAt: now, updatedAt: now, workers: [], events: [{ phase: 'starting', at: now }] } }; save();
  const stop = () => {
    if (!active) return;
    active.record.state = 'interrupted'; setOperationPhase('interrupted'); process.exitCode = 130;
    for (const [pid, child] of workers) {
      try { if (process.platform !== 'win32') process.kill(-pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const result = await action();
    if (active.record.state !== 'interrupted') active.record.state = process.exitCode === 2 ? 'waiting' : process.exitCode ? 'failed' : 'completed';
    return result;
  } catch (cause) {
    if (active.record.state !== 'interrupted') active.record.state = 'failed';
    throw cause;
  } finally {
    process.off('SIGINT', stop); process.off('SIGTERM', stop); save();
    if (active.record.state !== 'interrupted' && active.record.workers.length === 0 && existsSync(path)) unlinkSync(path);
    active = undefined;
  }
}
