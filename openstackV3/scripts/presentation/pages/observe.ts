import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { STATE_DIR } from '../../infrastructure/paths.js';
import { observe } from '../../infrastructure/observation.js';
import { renderObservation } from '../monitoring/view.js';
export async function run(args: string[]): Promise<void> {
  const option = (flag: string) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
  const watch = args.includes('--watch'); const json = args.includes('--json');
  if (watch && json) throw new Error('Use observe --json for one snapshot, or observe --watch --output FILE for the local visual view.');
  const output = resolve(option('--output') ?? join(STATE_DIR, 'observe.html'));
  if (!json && !output.endsWith('.html')) throw new Error('--output must name a private .html file.');
  if (json && option('--output')) throw new Error('Choose --json or --output, not both.');
  let stopping = false;
  const stop = () => { stopping = true; }; process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    do {
      const result = await observe(option('--app'));
      if (json) console.log(JSON.stringify(result, null, 2));
      else { mkdirSync(dirname(output), { recursive: true, mode: 0o700 }); const temporary = `${output}.${randomUUID()}.tmp`; writeFileSync(temporary, renderObservation(result, watch), { mode: 0o600, flag: 'wx' }); renameSync(temporary, output); console.log(`Private operation view: ${output} · ${result.generatedAt} · ${result.ok ? 'observed checks passed' : 'attention or missing evidence'}`); }
      if (!watch) { if (!result.ok) process.exitCode = 1; break; }
      for (let tick = 0; tick < 15 && !stopping; tick += 1) await new Promise(done => setTimeout(done, 1000));
    } while (!stopping);
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}
