/** Encrypted streaming backup and restore for pinned, local Swarm volumes. */

import { chmodSync, createReadStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { AppManifest, AppVolume } from './app-manifest.js';
import { ensureAgeIdentity, managerSshArgs } from './app-secrets.js';
import { ACTIVE_CONTEXT, APP_AGE_IDENTITY_PATH, ROOT_DIR, STATE_DIR } from './paths.js';
import { runProgram } from './shell.js';

const ARCHIVE_IMAGE = 'alpine:3.22.1@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1';
export const BACKUPS_DIR = process.env.TOAD_BACKUP_DIR
  ? resolve(process.env.TOAD_BACKUP_DIR)
  : ACTIVE_CONTEXT ? resolve(STATE_DIR, 'backups') : resolve(ROOT_DIR, '..', 'backups');

function swarmVolume(manifest: AppManifest, volume: AppVolume): string {
  return `${manifest.stack}_${volume.name}`;
}

function sshCommand(args: string[], show = true): string {
  return runProgram('ssh', [...managerSshArgs(), ...args], {
    showCommand: show,
    showOutput: false,
  });
}

function waitFor(child: ReturnType<typeof spawn>, label: string, stderr: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${label} exited with ${code}: ${stderr.join('').trim()}`));
    });
  });
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, reject) => {
    const input = createReadStream(path);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('error', reject);
    input.once('end', resolvePromise);
  });
  return hash.digest('hex');
}

function prepareArchiveImage(): void {
  try {
    sshCommand(['sudo', 'docker', 'image', 'inspect', ARCHIVE_IMAGE], false);
  } catch {
    sshCommand(['sudo', 'docker', 'pull', ARCHIVE_IMAGE]);
  }
}

export async function backupVolume(manifest: AppManifest, volume: AppVolume, requestedOutput?: string): Promise<{ path: string; sha256: string }> {
  const recipient = ensureAgeIdentity();
  prepareArchiveImage();
  const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
  const output = requestedOutput
    ? resolve(requestedOutput)
    : resolve(BACKUPS_DIR, manifest.name, `${timestamp}-${volume.name}.tar.age`);
  if (existsSync(output)) throw new Error(`Refusing to overwrite backup: ${output}`);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });

  const dockerArgs = [
    ...managerSshArgs(), 'sudo', 'docker', 'run', '--rm',
    '--volume', `${swarmVolume(manifest, volume)}:/data:ro`,
    ARCHIVE_IMAGE, 'tar', '-C', '/data', '-cf', '-', '.',
  ];
  const source = spawn('ssh', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  const encrypt = spawn('age', ['--encrypt', '--recipient', recipient, '--output', output], { stdio: ['pipe', 'ignore', 'pipe'] });
  const sourceErrors: string[] = [];
  const encryptErrors: string[] = [];
  source.stderr.setEncoding('utf8');
  encrypt.stderr.setEncoding('utf8');
  source.stderr.on('data', (chunk: string) => sourceErrors.push(chunk));
  encrypt.stderr.on('data', (chunk: string) => encryptErrors.push(chunk));
  source.stdout.pipe(encrypt.stdin);
  try {
    await Promise.all([waitFor(source, 'remote archive', sourceErrors), waitFor(encrypt, 'age encryption', encryptErrors)]);
  } catch (cause) {
    if (existsSync(output)) unlinkSync(output);
    throw cause;
  }
  chmodSync(output, 0o600);
  return { path: output, sha256: await sha256File(output) };
}

export async function verifyEncryptedArchive(sourcePath: string): Promise<void> {
  const source = resolve(sourcePath);
  if (!existsSync(source)) throw new Error(`Backup does not exist: ${source}`);
  const decrypt = spawn('age', ['--decrypt', '--identity', APP_AGE_IDENTITY_PATH, source], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const inspect = spawn('tar', ['-tf', '-'], { stdio: ['pipe', 'ignore', 'pipe'] });
  const decryptErrors: string[] = [];
  const inspectErrors: string[] = [];
  decrypt.stderr.setEncoding('utf8');
  inspect.stderr.setEncoding('utf8');
  decrypt.stderr.on('data', (chunk: string) => decryptErrors.push(chunk));
  inspect.stderr.on('data', (chunk: string) => inspectErrors.push(chunk));
  decrypt.stdout.pipe(inspect.stdin);
  await Promise.all([
    waitFor(decrypt, 'age decryption', decryptErrors),
    waitFor(inspect, 'archive inspection', inspectErrors),
  ]);
}

export async function restoreVolume(manifest: AppManifest, volume: AppVolume, sourcePath: string): Promise<void> {
  const source = resolve(sourcePath);
  if (!existsSync(source)) throw new Error(`Backup does not exist: ${source}`);
  prepareArchiveImage();
  const name = swarmVolume(manifest, volume);
  const containers = sshCommand(['sudo', 'docker', 'ps', '--quiet', '--filter', `volume=${name}`], false).trim();
  if (containers) throw new Error(`Volume ${name} is attached to a running container. Remove the app stack before restoring.`);
  try {
    sshCommand(['sudo', 'docker', 'volume', 'inspect', name], false);
  } catch {
    sshCommand(['sudo', 'docker', 'volume', 'create', name], false);
  }
  const existing = sshCommand([
    'sudo', 'docker', 'run', '--rm', '--volume', `${name}:/data:ro`, ARCHIVE_IMAGE, 'ls', '-A', '/data',
  ], false).trim();
  if (existing) throw new Error(`Volume ${name} is not empty. TOAD will not merge a restore into existing data.`);

  const decrypt = spawn('age', ['--decrypt', '--identity', APP_AGE_IDENTITY_PATH, source], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const target = spawn('ssh', [
    ...managerSshArgs(), 'sudo', 'docker', 'run', '--rm', '-i',
    '--volume', `${name}:/data`, ARCHIVE_IMAGE, 'tar', '-C', '/data', '-xf', '-',
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  const decryptErrors: string[] = [];
  const targetErrors: string[] = [];
  decrypt.stderr.setEncoding('utf8');
  target.stderr.setEncoding('utf8');
  decrypt.stderr.on('data', (chunk: string) => decryptErrors.push(chunk));
  target.stderr.on('data', (chunk: string) => targetErrors.push(chunk));
  decrypt.stdout.pipe(target.stdin);
  await Promise.all([waitFor(decrypt, 'age decryption', decryptErrors), waitFor(target, 'remote restore', targetErrors)]);
}
