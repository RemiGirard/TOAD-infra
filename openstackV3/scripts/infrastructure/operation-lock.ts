/** Prevent concurrent state-changing operations within one client context. */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname } from 'node:path';
import { OPERATION_LOCK_PATH } from './paths.js';

interface LockMetadata {
  pid: number;
  host: string;
  operation: string;
  createdAt: string;
}

function localProcessExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removeStaleLocalLock(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const metadata = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockMetadata>;
    if (metadata.host === hostname() && typeof metadata.pid === 'number' && !localProcessExists(metadata.pid)) {
      unlinkSync(path);
      return true;
    }
  } catch {
    // An unreadable lock is treated as active and requires human inspection.
  }
  return false;
}

export async function withOperationLock<T>(operation: string, action: () => Promise<T>, path = OPERATION_LOCK_PATH): Promise<T> {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let descriptor: number;
  try {
    descriptor = openSync(path, 'wx', 0o600);
  } catch (cause) {
    if (removeStaleLocalLock(path)) descriptor = openSync(path, 'wx', 0o600);
    else throw new Error(`Another TOAD mutation holds the context lock at ${path}.`);
  }
  const metadata: LockMetadata = {
    pid: process.pid,
    host: hostname(),
    operation,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(descriptor, `${JSON.stringify(metadata, null, 2)}\n`);
  closeSync(descriptor);
  try {
    return await action();
  } finally {
    if (existsSync(path)) unlinkSync(path);
  }
}
