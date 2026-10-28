/** Read-only operation visibility and explicit acknowledgement of interrupted work. */
import { acknowledgeInterruptedOperation, operationHistory, processExists, readOperation } from '../../infrastructure/operation-lock.js';
import { hostname } from 'node:os';
export async function run(args: string[]): Promise<void> {
  if (args[0] === 'reconcile') {
    if (!args.includes('--acknowledge-interrupted')) throw new Error('Inspect local workers and remote runtime, then use operation reconcile --acknowledge-interrupted. This does not undo or resume remote work.');
    acknowledgeInterruptedOperation();
  } else if (args[0] && args[0] !== 'status' && args[0] !== 'history') throw new Error('Use operation status, history, or reconcile.');
  const current = readOperation();
  const output = { version: 1, ok: true, current: current ? { ...current, coordinatorAlive: current.host === hostname() && processExists(current.pid), workersAlive: (current.workers ?? []).filter(processExists) } : null, history: operationHistory(), nextAction: current ? 'Inspect workers and remote state before retrying interrupted work.' : 'No local operation holds the context lock.' };
  if (args.includes('--json')) console.log(JSON.stringify(output, null, 2));
  else { console.log(current ? `${current.id}: ${current.operation} / ${current.phase} (${current.state})` : 'No active operation.'); for (const item of output.history) console.log(`${item.id} ${item.operation} ${item.state} ${item.phase} ${item.updatedAt}`); }
}
