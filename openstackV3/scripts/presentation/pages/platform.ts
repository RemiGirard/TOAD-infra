/** Encrypted backup and guarded restore for platform-owned Docker volumes. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { AppManifest, AppVolume } from '../../infrastructure/app-manifest.js';
import { BACKUPS_DIR, backupVolume, restoreVolume, sha256File, verifyEncryptedArchive } from '../../infrastructure/app-backup.js';
import { parseBackupIndex } from '../../infrastructure/backup-index.js';
import { managerSshArgs } from '../../infrastructure/app-secrets.js';
import { ask, banner, closeReadline, error, success } from '../../infrastructure/cli.js';
import { runProgram } from '../../infrastructure/shell.js';

interface Dataset {
  name: string;
  stack: string;
  volume: string;
  service: string;
  description: string;
}

const DATASETS: Dataset[] = [
  { name: 'traefik-certificates', stack: 'traefik', volume: 'traefik-certificates', service: 'traefik_traefik', description: 'ACME accounts and certificates' },
  { name: 'prometheus-data', stack: 'monitoring', volume: 'prometheus-data', service: 'monitoring_prometheus', description: 'Prometheus time series' },
  { name: 'grafana-data', stack: 'monitoring', volume: 'grafana-data', service: 'monitoring_grafana', description: 'Grafana SQLite and runtime data' },
  { name: 'alertmanager-data', stack: 'monitoring', volume: 'alertmanager-data', service: 'monitoring_alertmanager', description: 'Alertmanager silences and notification state' },
  { name: 'loki-data', stack: 'monitoring', volume: 'loki-data', service: 'monitoring_loki', description: 'Centralized log chunks and index' },
];

function docker(args: string[], showCommand = false): string {
  return runProgram('ssh', [...managerSshArgs(), 'sudo', 'docker', ...args], {
    showCommand,
    showOutput: false,
  });
}

function manifestFor(dataset: Dataset): { manifest: AppManifest; volume: AppVolume } {
  const volume: AppVolume = { name: dataset.volume, backup: 'required', description: dataset.description };
  return {
    manifest: {
      apiVersion: 'toad.dev/v1',
      name: `platform-${dataset.name}`.slice(0, 32).replace(/-$/, ''),
      description: dataset.description,
      stack: dataset.stack,
      compose: 'docker-compose.yaml',
      files: [],
      services: [],
      checks: [],
      secrets: [],
      volumes: [volume],
    },
    volume,
  };
}

function select(name: string | undefined): Dataset[] {
  if (!name) return DATASETS;
  const dataset = DATASETS.find((candidate) => candidate.name === name);
  if (!dataset) throw new Error(`Unknown platform dataset "${name}".`);
  return [dataset];
}

function scale(service: string, replicas: number): void {
  docker(['service', 'scale', `${service}=${replicas}`], true);
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const taskIds = docker(['service', 'ps', service, '--quiet']).split('\n').map((id) => id.trim()).filter(Boolean);
    const tasks = taskIds.length > 0
      ? JSON.parse(docker(['inspect', ...taskIds])) as Array<{ DesiredState?: string; Status?: { State?: string } }>
      : [];
    const desired = tasks.filter((task) => task.DesiredState === 'running');
    const running = desired.filter((task) => task.Status?.State === 'running');
    if ((replicas === 0 && desired.length === 0) || (replicas > 0 && desired.length === replicas && running.length === replicas)) return;
    if (attempt < 60) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
  }
  throw new Error(`${service} did not converge to ${replicas} replica(s).`);
}

async function backup(datasets: Dataset[]): Promise<void> {
  const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
  const directory = resolve(BACKUPS_DIR, 'platform', timestamp);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const archives: Array<{ dataset: string; file: string; sha256: string }> = [];
  for (const dataset of datasets) {
    console.log(`\nQuiescing ${dataset.service}...`);
    scale(dataset.service, 0);
    try {
      const { manifest, volume } = manifestFor(dataset);
      const file = resolve(directory, `${dataset.name}.tar.age`);
      const result = await backupVolume(manifest, volume, file);
      archives.push({ dataset: dataset.name, file: basename(result.path), sha256: result.sha256 });
      success(`Backed up ${dataset.name}.`);
    } finally {
      scale(dataset.service, 1);
    }
  }
  const index = resolve(directory, 'index.json');
  writeFileSync(index, `${JSON.stringify({ version: 1, createdAt: new Date().toISOString(), archives }, null, 2)}\n`, { mode: 0o600 });
  success(`Platform backup index: ${index}`);
}

async function verifyBackupIndex(indexPath: string, json: boolean): Promise<void> {
  const resolvedIndex = resolve(indexPath);
  const { index, archives } = parseBackupIndex(readFileSync(resolvedIndex, 'utf8'), resolvedIndex);
  const results: Array<{ dataset: string; ok: boolean; sha256: string }> = [];
  for (const archive of archives) {
    const actualHash = await sha256File(archive.path);
    if (actualHash !== archive.sha256) throw new Error(`${archive.dataset}: encrypted archive checksum mismatch.`);
    await verifyEncryptedArchive(archive.path);
    results.push({ dataset: archive.dataset, ok: true, sha256: actualHash });
  }
  if (json) {
    console.log(JSON.stringify({ version: 1, ok: true, createdAt: index.createdAt, archives: results }, null, 2));
  } else {
    success(`Verified checksums, decryption, and tar structure for ${results.length} archive(s).`);
  }
}

async function restore(dataset: Dataset, archive: string): Promise<void> {
  console.log(`Quiescing ${dataset.service}...`);
  scale(dataset.service, 0);
  let restored = false;
  try {
    const { manifest, volume } = manifestFor(dataset);
    const volumeName = `${dataset.stack}_${dataset.volume}`;
    let removed = false;
    let removalError = '';
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      try {
        docker(['volume', 'rm', volumeName], attempt === 1);
        removed = true;
        break;
      } catch (cause) {
        removalError = cause instanceof Error ? cause.message : String(cause);
        if (!removalError.includes('volume is in use') || attempt === 60) break;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2_000);
      }
    }
    if (!removed) throw new Error(`Could not remove the exact target volume ${volumeName}: ${removalError}`);
    await restoreVolume(manifest, volume, archive);
    restored = true;
  } finally {
    if (restored) scale(dataset.service, 1);
  }
  success(`Restored ${dataset.name}; ${dataset.service} is running again.`);
}

function help(): void {
  console.log(`Usage: pnpm run platform -- <command>

Commands:
  list
  backup [DATASET] [--yes]
  verify --from INDEX [--json]
  restore DATASET --from ARCHIVE [--yes]

Backups briefly stop only the service owning each volume. Restore deletes only
the exact selected volume and leaves the service stopped if recovery fails.`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const json = args.includes('--json');
  if (!json) banner('TOAD Platform Recovery');
  try {
    if (command === 'list') {
      for (const dataset of DATASETS) console.log(`${dataset.name.padEnd(22)} ${dataset.description}`);
      return;
    }
    if (command === 'backup') {
      const datasetName = args.find((arg, index) => index > 0 && !arg.startsWith('--'));
      const datasets = select(datasetName);
      if (!args.includes('--yes')) {
        const confirmation = await ask('Type "platform-backup" to accept brief service interruptions');
        closeReadline();
        if (confirmation !== 'platform-backup') { console.log('Cancelled.'); return; }
      }
      await backup(datasets);
      return;
    }
    if (command === 'verify') {
      const fromIndex = args.indexOf('--from');
      const index = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
      if (!index) throw new Error('Usage: pnpm run platform -- verify --from INDEX [--json]');
      await verifyBackupIndex(index, json);
      return;
    }
    if (command === 'restore') {
      const datasetName = args[1];
      const fromIndex = args.indexOf('--from');
      const archive = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
      if (!datasetName || !archive) throw new Error('Usage: pnpm run platform -- restore DATASET --from ARCHIVE');
      const dataset = select(datasetName)[0]!;
      if (!args.includes('--yes')) {
        const confirmation = await ask(`Type "restore ${dataset.name}" to replace its exact Docker volume`);
        closeReadline();
        if (confirmation !== `restore ${dataset.name}`) { console.log('Cancelled.'); return; }
      }
      await restore(dataset, archive);
      return;
    }
    help();
    if (command) process.exitCode = 1;
  } catch (cause) {
    closeReadline();
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
