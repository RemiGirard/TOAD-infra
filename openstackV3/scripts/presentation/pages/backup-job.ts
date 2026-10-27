/** Scheduled platform backup: quiesce, encrypt, verify, copy offsite, verify, notify. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { parseBackupIndex } from '../../infrastructure/backup-index.js';
import { ARCHIVE_IMAGE } from '../../infrastructure/app-backup.js';
import { withOperationLock } from '../../infrastructure/operation-lock.js';
import { runProgramAsync } from '../../infrastructure/shell.js';

interface Policy {
  version: 1;
  operatorDirectory: string;
  context: string;
  outputDirectory: string;
  rcloneConfig: string;
  remote: string;
  notificationFile: string;
}

export function parsePolicy(contents: string): Policy {
  let value: Partial<Policy>;
  try { value = JSON.parse(contents) as Partial<Policy>; }
  catch { throw new Error('Backup policy must be valid JSON.'); }
  if (!value || typeof value !== 'object') throw new Error('Backup policy must be an object.');
  if (value.version !== 1 || !['operatorDirectory', 'outputDirectory', 'rcloneConfig', 'notificationFile']
    .every((key) => typeof value[key as keyof Policy] === 'string' && isAbsolute(String(value[key as keyof Policy])))
    || typeof value.context !== 'string' || !/^(?:legacy|[a-z][a-z0-9-]{1,31})$/.test(value.context)
    || typeof value.remote !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z0-9_./-]+$/.test(value.remote)
    || value.remote.slice(value.remote.indexOf(':') + 1).split('/').includes('..')) {
    throw new Error('Backup policy requires version 1, absolute local paths, an explicit context, and an rclone remote:path.');
  }
  return value as Policy;
}

function notificationTarget(policy: Policy): string {
  const url = readFileSync(policy.notificationFile, 'utf8').trim();
  let target: URL;
  try { target = new URL(url); } catch { throw new Error('Invalid notification endpoint configuration.'); }
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Notification endpoint must use HTTPS.');
  return url;
}

async function notify(policy: Policy, result: object): Promise<void> {
  const url = notificationTarget(policy);
  // The endpoint may itself be a secret; never include it or response contents in diagnostics.
  let response: Response;
  try { response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(result), redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch { throw new Error('Backup notification delivery failed.'); }
  if (!response.ok) throw new Error('Backup notification was rejected.');
}

function prerequisites(policy: Policy): void {
  for (const path of [policy.rcloneConfig, policy.notificationFile]) {
    if (!existsSync(path) || (statSync(path).mode & 0o777) !== 0o600) throw new Error('Backup and notification configuration must exist with mode 0600.');
  }
  if (!existsSync(join(policy.operatorDirectory, 'scripts', 'index.ts'))) throw new Error('Configured operator CLI is missing.');
}

async function execute(policy: Policy, stopping: () => boolean): Promise<object> {
  prerequisites(policy);
  const runId = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
  const directory = join(policy.outputDirectory, runId);
  const transfer = join(directory, 'offsite');
  mkdirSync(transfer, { recursive: true, mode: 0o700 });
  const env: NodeJS.ProcessEnv = { ...process.env, TOAD_CONTEXT: policy.context === 'legacy' ? '' : policy.context, TOAD_BACKUP_DIR: join(directory, 'capture') };
  delete env.TOAD_STATE_DIR;
  delete env.TOAD_CONTEXTS_DIR;
  const cli = (args: string[]) => runProgramAsync(process.execPath, ['--import', 'tsx', 'scripts/index.ts', ...args], { cwd: policy.operatorDirectory, env, detached: true, showCommand: false, showOutput: false });
  let stage = 'preflight';
  try {
    // Check every required external tool before accepting service interruption.
    notificationTarget(policy);
    for (const tool of ['age', 'age-keygen', 'tar']) await runProgramAsync(tool, ['--version'], { showCommand: false, showOutput: false });
    const identity = policy.context === 'legacy'
      ? join(policy.operatorDirectory, 'credentials', 'toad-app-secrets.agekey')
      : join(policy.operatorDirectory, 'contexts', policy.context, 'credentials', 'toad-app-secrets.agekey');
    if (!existsSync(identity) || (statSync(identity).mode & 0o777) !== 0o600) throw new Error('Existing escrowed age identity is required.');
    await runProgramAsync('age-keygen', ['-y', identity], { showCommand: false, showOutput: false });
    await runProgramAsync('rclone', ['version'], { showCommand: false, showOutput: false });
    const health = JSON.parse(await cli(['maintenance', 'status', '--json'])) as { ok?: boolean; nodes?: Array<{ role: string; state: string; reachability: string }> };
    const managers = health.nodes?.filter((node) => node.role === 'manager') ?? [];
    if (!health.ok || managers.length !== 3 || managers.some((node) => node.state !== 'ready' || !['leader', 'reachable'].includes(node.reachability))) {
      throw new Error('Three healthy managers are required before the backup window.');
    }
    await runProgramAsync('rclone', ['lsf', '--config', policy.rcloneConfig, policy.remote, '--max-depth', '1'], { showCommand: false, showOutput: false });
    const prepareImage = "import { managerSshArgs } from './scripts/infrastructure/app-secrets.ts'; import { spawnSync } from 'node:child_process'; const result = spawnSync('ssh', [...managerSshArgs(), 'sudo', 'docker', 'pull', process.argv[1]], { stdio: 'ignore' }); process.exit(result.status ?? 1);";
    await runProgramAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', prepareImage, ARCHIVE_IMAGE], { cwd: policy.operatorDirectory, env, showCommand: false, showOutput: false });
    if (stopping()) throw new Error('Backup cancelled before service interruption.');
    stage = 'capture';
    await cli(['platform', 'backup', '--yes']);
    // Let the child complete its finally blocks and restore replicas before honouring a stop.
    if (stopping()) { stage = 'cancelled-after-capture'; throw new Error('Backup cancelled after services were restored.'); }
    const platform = join(directory, 'capture', 'platform');
    const captures = readdirSync(platform, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    if (captures.length !== 1) throw new Error('Expected exactly one completed platform backup.');
    const snapshot = join(platform, captures[0]!.name);
    const indexPath = join(snapshot, 'index.json');
    stage = 'local-verification';
    const verification = JSON.parse(await cli(['platform', 'verify', '--from', indexPath, '--json'])) as { ok?: boolean };
    if (!verification.ok) throw new Error('Local archive verification failed.');
    const { archives } = parseBackupIndex(readFileSync(indexPath, 'utf8'), indexPath);
    for (const archive of archives) {
      const canonical = realpathSync(archive.path);
      if (!archive.file.endsWith('.tar.age') || relative(realpathSync(snapshot), canonical).startsWith('..')) throw new Error('Only encrypted archives from this capture may be transferred.');
      copyFileSync(canonical, join(transfer, basename(archive.file)));
    }
    copyFileSync(indexPath, join(transfer, 'index.json'));
    const destination = `${policy.remote.replace(/\/$/, '')}/${runId}`;
    stage = 'offsite-copy';
    await runProgramAsync('rclone', ['copy', '--config', policy.rcloneConfig, '--immutable', '--checksum', transfer, destination], { showCommand: false, showOutput: false });
    stage = 'offsite-verification';
    await runProgramAsync('rclone', ['check', '--config', policy.rcloneConfig, '--one-way', '--download', transfer, destination], { showCommand: false, showOutput: false });
    const result = { version: 1, source: 'toad-backup', ok: true, runId, archives: archives.length, localVerified: true, offsiteVerified: true };
    writeFileSync(join(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    stage = 'notification';
    await notify(policy, result);
    return result;
  } catch {
    const result = { version: 1, source: 'toad-backup', ok: false, runId, stage };
    writeFileSync(join(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    try { await notify(policy, result); } catch { /* Preserve the failure code without exposing endpoint data. */ }
    throw new Error(`Backup job failed during ${stage}. Encrypted local results were retained for inspection.`);
  }
}

export async function run(args: string[]): Promise<void> {
  const index = args.indexOf('--policy');
  const path = index === -1 ? undefined : args[index + 1];
  if (!path || path.startsWith('--')) throw new Error('Usage: backup-job <plan|run|notify-test> --policy FILE [--accept-service-interruptions]');
  const policy = parsePolicy(readFileSync(resolve(path), 'utf8'));
  if (args[0] === 'plan') {
    console.log(JSON.stringify({ version: 1, action: 'plan', changes: false, context: policy.context, platformDatasets: 5, steps: ['quorum preflight', 'briefly stop each owning service', 'age-encrypted capture', 'checksum/decryption/archive verification', 'offsite immutable copy', 'offsite download verification', 'notification'], retention: 'no deletion; configure storage retention separately' }, null, 2));
    return;
  }
  if (args[0] === 'notify-test') {
    prerequisites(policy);
    await notify(policy, { version: 1, source: 'toad-backup', event: 'delivery-test', ok: true });
    console.log(JSON.stringify({ ok: true, notificationDelivered: true }));
    return;
  }
  if (args[0] !== 'run' || !args.includes('--accept-service-interruptions')) throw new Error('Backup run requires --accept-service-interruptions for its service maintenance window.');
  let stopRequested = false;
  const stop = () => { stopRequested = true; };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    const result = await withOperationLock('scheduled-backup', () => execute(policy, () => stopRequested), join(policy.outputDirectory, '.backup-job.lock'));
    console.log(JSON.stringify(result, null, 2));
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); }
}
