/** Generic lifecycle commands for manifest-driven Swarm applications. */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ask, banner, closeReadline, error, success } from '../../infrastructure/cli.js';
import {
  APP_API_VERSION,
  APPS_DIR,
  listAppNames,
  loadApp,
} from '../../infrastructure/app-manifest.js';
import { ACTIVE_CONTEXT, INVENTORY_PATH, ROOT_DIR, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import { runProgram, runProgramStream } from '../../infrastructure/shell.js';
import { deployAppSecrets, encryptAppSecret, ensureAgeIdentity, managerSshArgs } from '../../infrastructure/app-secrets.js';
import { backupVolume, restoreVolume } from '../../infrastructure/app-backup.js';
import { publishAppImage } from '../../infrastructure/app-image.js';
import { parseAppArguments } from '../../infrastructure/app-arguments.js';
import { evaluateRelease, expectedRelease, imageDigest } from '../../infrastructure/app-runtime.js';
import { appTargetMetadata, checkEndpoints, collectAppDiagnosis, dockerFromManager, serviceStatus, statusResult } from '../../infrastructure/app-observation.js';
export { collectAppDiagnosis } from '../../infrastructure/app-observation.js';
import { writeRollbackPatch } from '../../infrastructure/app-release-patch.js';
import { stageAppFiles } from '../../infrastructure/app-transfer.js';
import { assertOperationRunning, setOperationPhase } from '../../infrastructure/operation-lock.js';

const ANSIBLE_DIR = resolve(ROOT_DIR, '..', 'ansible');
const INVENTORY = INVENTORY_PATH;
const ANSIBLE = join(ANSIBLE_DIR, 'venv', 'bin', 'ansible');
const ANSIBLE_PLAYBOOK = join(ANSIBLE_DIR, 'venv', 'bin', 'ansible-playbook');

function emitAppJson(result: Record<string, unknown>): void {
  console.log(JSON.stringify({ ...result, ...appTargetMetadata() }, null, 2));
}

export function showAppHelp(command?: string): void {
  const details: Record<string, string> = {
    publish: 'publish NAME [--image REGISTRY/OWNER/APP:TAG] [--service SERVICE] [--platform linux/amd64|linux/arm64] [--json]\nBuild reviewed source, push, and pin the returned digest. Image/platform defaults come from build.yaml. Does not deploy.',
    release: 'release NAME [--image REGISTRY/OWNER/APP:TAG] [--service SERVICE] [--platform linux/amd64|linux/arm64] [--json]\nPublish, validate, deploy, and prove that the requested release is running. Requires an existing platform.',
    deploy: 'deploy NAME [--json]\nValidate and deploy existing immutable images. Success requires the requested service/task digests, replica counts, completed update, and HTTPS checks.',
    rollback: 'rollback NAME [SERVICE] [--output PATH] [--json]\nRecover PreviousSpec images, verify replicas and HTTPS, and write a new reviewable image patch. Does not overwrite Compose or Git. Output files must not already exist.',
    logs: 'logs NAME [SERVICE] [--follow] [--since DURATION|TIMESTAMP] [--tail NUMBER|all]\nStream Docker service logs; defaults to the first declared service and 100 lines. Log output is sensitive and is not available as --json.',
    diagnose: 'diagnose NAME [--json]\nRead-only release state, intended/actual digests, replicas, endpoint checks, failed-task categories, and next actions.',
    status: 'status NAME [--json]\nRead-only release state and intended/actual service/task digests.',
    verify: 'verify NAME [--json]\nCheck declared HTTPS endpoints with bounded concurrent retries.',
    validate: 'validate [NAME|--all] [--json]\nValidate manifest, immutable images, declared files, secrets, and Compose guardrails locally.',
    create: 'create NAME [--template node-web] [--json]\nScaffold an app. The starter image is a routing placeholder until publication.',
    backup: 'backup NAME VOLUME [--output PATH]\nCreate an encrypted archive for a volume declared with backup: required.',
    restore: 'restore NAME VOLUME --from ARCHIVE [--yes]\nRestore into the declared empty detached volume. Requires explicit authorization for the exact target.',
    remove: 'remove NAME [--yes]\nRemove the live Swarm stack, preserving local files. Without --yes, requires typing the exact stack name.',
    secret: 'secret init | recipient | encrypt NAME SECRET --from-file PATH\nKeep plaintext in protected local files. Encryption writes only declared ciphertext.',
    list: 'list [--json]\nList application manifests in the selected project or apps directory.',
  };
  if (command && details[command]) {
    console.log(`Usage: pnpm run app -- ${details[command]}\n\nGlobal options: --context NAME, --project DIR. Unsupported options are rejected.`);
    return;
  }
  console.log(`Usage: pnpm run app -- <command> [app] [options]

Commands:
  list                         List manifest-driven applications
  create <app>                 Scaffold a safe Traefik application
    --template node-web        Include a working frontend + Node API source
  publish <app> --image REGISTRY/OWNER/APP:TAG [--service SERVICE]
                               Build allow-listed source, push, pin its digest
  release <app> [--image ...]  Publish, validate, deploy, and verify one release
  validate [app|--all]         Validate manifests and Compose policies
  deploy <app>                 Copy, deploy, and verify an application
  verify <app>                 Check declared HTTPS endpoints
  status <app> [--json]        Show services and replicas
  diagnose <app> --json        Combine replicas, checks, failed tasks, and hints
  logs <app> [service]         Logs with --follow, --since, and --tail
  rollback <app> [service]     Roll back one service (or every service)
  backup <app> <volume>        Stream an age-encrypted volume backup off-host
  restore <app> <volume> --from <archive> [--yes]
                               Restore only into a detached, empty volume
  remove <app> [--yes]         Remove the application's Swarm stack`);
  console.log(`
Secret commands:
  secret init                  Create an ignored local age identity
  secret recipient             Print its safe-to-share public recipient
  secret encrypt <app> <name> --from-file <path>
                               Encrypt a manifest-declared secret for Git

Use app COMMAND --help for exact options. Global: --context NAME, --project DIR.`);
}

export function validateAppArguments(args: string[]): void { parseAppArguments(args); }

function requireRuntime(): void {
  if (!existsSync(INVENTORY)) throw new Error('No platform inventory in the selected context. Provision and configure the cloud with pnpm run apply -- YOUR-STACK before deploying apps. See ../docs/QUICKSTART.md.');
  if (!existsSync(ANSIBLE) || !existsSync(ANSIBLE_PLAYBOOK)) {
    throw new Error('The Ansible runtime is missing. Run pnpm run apply once or install ansible/requirements.lock.txt.');
  }
}

function remote(command: string, showCommand = true): string {
  requireRuntime();
  return runProgram(ANSIBLE, [
    '-i', INVENTORY,
    'managers[0]',
    '--one-line',
    '--become',
    '-m', 'ansible.builtin.command',
    '-a', command,
  ], { cwd: ANSIBLE_DIR, showOutput: false, showCommand });
}

function serviceName(stack: string, service: string): string {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(stack) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(service)) throw new Error('Invalid Swarm service target.');
  return `${stack}_${service}`;
}

function create(name: string | undefined, template?: string, quiet = false): string {
  if (!name || !/^[a-z][a-z0-9-]{0,31}$/.test(name)) {
    throw new Error('Provide an app name using lowercase letters, numbers, and hyphens.');
  }
  const directory = join(APPS_DIR, name);
  if (template && template !== 'node-web') throw new Error('Available template: node-web.');
  if (existsSync(directory)) throw new Error(`${directory} already exists.`);
  mkdirSync(directory, { recursive: false });
  const manifest = {
    apiVersion: APP_API_VERSION,
    name,
    description: `${name} service`,
    stack: name,
    compose: 'docker-compose.yaml',
    files: ['docker-compose.yaml'],
    services: [name],
    checks: [
      { name: name, url: `https://${name}.\${TOAD_DOMAIN}/`, status: 200 },
      ...(template ? [{ name: 'api-health', url: `https://${name}.\${TOAD_DOMAIN}/api/health`, status: 200 }] : []),
    ],
    secrets: [],
    volumes: [],
  };
  const compose = `services:
  ${name}:
    image: traefik/whoami:v1.11.0@sha256:200689790a0a0ea48ca45992e0450bc26ccab5307375b41c84dfc4f2475937ab
    security_opt: [no-new-privileges:true]
    networks: [traefik-public]
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 64M
        reservations:
          memory: 16M
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.${name}.rule=Host(\`${name}.\${TOAD_DOMAIN}\`)"
        - "traefik.http.routers.${name}.entrypoints=websecure"
        - "traefik.http.routers.${name}.tls=true"
        - "traefik.http.routers.${name}.tls.certresolver=letsencrypt"
        - "traefik.http.services.${name}.loadbalancer.server.port=80"
      update_config:
        parallelism: 1
        order: start-first
        failure_action: rollback
        monitor: 2m

networks:
  traefik-public:
    external: true
`;
  writeFileSync(join(directory, 'toad.yaml'), stringifyYaml(manifest), { mode: 0o640 });
  writeFileSync(join(directory, 'docker-compose.yaml'), compose, { mode: 0o640 });
  if (template === 'node-web') {
    cpSync(resolve(ROOT_DIR, '..', 'examples', 'node-web'), join(directory, 'source'), { recursive: true });
    writeFileSync(join(directory, 'build.yaml'), stringifyYaml({
      version: 1,
      port: 3000,
      files: ['Dockerfile', 'server.mjs', 'public/index.html', 'public/style.css', 'public/app.mjs'],
    }), { mode: 0o640 });
  }
  if (!quiet) {
    success(`Created ${directory}`);
    console.log(template
      ? `Next: edit source/, then run pnpm run app -- publish ${name} --image ghcr.io/YOUR-OWNER/${name}:v1. The current Compose image is only a routing placeholder.`
      : `Next: edit the image and labels, then run pnpm run app -- validate ${name}`);
  }
  return directory;
}

function validate(names: string[]): void {
  const selected = names[0] && names[0] !== '--all' ? [names[0]] : listAppNames();
  if (selected.length === 0) throw new Error('No applications with toad.yaml manifests were found.');
  for (const name of selected) {
    const app = loadApp(name);
    success(`${app.manifest.name}: ${app.manifest.services.length} service(s), ${app.manifest.files.length} declared file(s)`);
  }
}

function status(name: string | undefined, json = false): void {
  if (!name) throw new Error('Usage: pnpm run app -- status <app>');
  const app = loadApp(name);
  const result = statusResult(app);
  if (json) {
    emitAppJson(result);
    return;
  }
  console.log(`${name}: ${result.outcome}`);
  for (const service of result.services) console.log(`${service.name}: ${service.running}/${service.desired}; expected ${service.expectedDigest}; actual ${service.actualDigest || 'unknown'}; ${service.updateState}`);
}

class AppReleaseError extends Error {
  constructor(message: string, readonly result: Record<string, unknown>) { super(message); }
}

async function waitForServices(app: ReturnType<typeof loadApp>, options: Parameters<typeof evaluateRelease>[2] = {}) {
  const name = app.manifest.name;
  let result = evaluateRelease(app, [], options);
  for (let attempt = 1; attempt <= 120; attempt += 1) {
    assertOperationRunning();
    result = evaluateRelease(app, serviceStatus(app.manifest), options);
    if (result.ok) return result;
    if (result.outcome === 'rolled_back' || result.outcome === 'failed') {
      throw new AppReleaseError(`The requested release ${result.outcome === 'rolled_back' ? 'rolled back' : 'failed'}. Inspect app diagnose before retrying.`, { ...result, app: name });
    }
    if (attempt % 6 === 0 && process.env.TOAD_JSON !== '1') console.error(`Waiting for ${name}: ${result.services.map((service) => `${service.name} ${service.running}/${service.desired} ${service.updateState}`).join('; ')}`);
    if (attempt < 120) await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
  }
  throw new AppReleaseError('Timed out waiting for requested release digests and completed update. Inspect app diagnose before retrying.', { ...result, app: name });
}

async function logs(name: string | undefined, requestedService: string | undefined, options: Record<string, string | true>): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- logs <app> [service]');
  const { manifest } = loadApp(name);
  const service = requestedService ?? manifest.services[0];
  if (!service || !manifest.services.includes(service)) throw new Error(`Unknown service "${service ?? ''}".`);
  const args = ['service', 'logs', '--tail', String(options['--tail'] ?? '100'), '--timestamps'];
  if (options['--since']) args.push('--since', String(options['--since']));
  if (options['--follow']) args.push('--follow');
  args.push(serviceName(manifest.stack, service));
  const code = await runProgramStream('ssh', [...managerSshArgs(), 'sudo', 'docker', ...args], { showCommand: false });
  if (code !== 0) throw new Error('Service log streaming failed.');
}

async function rollback(name: string | undefined, requestedService: string | undefined, output?: string) {
  if (!name) throw new Error('Usage: pnpm run app -- rollback <app> [service]');
  const app = loadApp(name);
  const { manifest } = app;
  const services = requestedService ? [requestedService] : manifest.services;
  const before = serviceStatus(manifest);
  const images = expectedRelease(app);
  const recovered: Record<string, string> = {};
  for (const service of services) {
    if (!manifest.services.includes(service)) throw new Error(`Unknown service "${service}".`);
    const runtime = before.find((candidate) => candidate.service.Spec?.Name === serviceName(manifest.stack, service));
    const previous = runtime?.service.PreviousSpec?.TaskTemplate?.ContainerSpec?.Image;
    if (!previous || !imageDigest(previous)) throw new Error(`No immutable previous release exists for ${service}.`);
    images[serviceName(manifest.stack, service)] = previous;
    recovered[service] = previous;
  }
  if (output && existsSync(resolve(output))) throw new Error('Rollback patch output already exists. Choose a new path.');
  setOperationPhase('rollback');
  for (const service of services) dockerFromManager(['service', 'update', '--rollback', serviceName(manifest.stack, service)]);
  const runtime = await waitForServices(app, { expectedImages: images, allowCompletedRollback: true });
  setOperationPhase('https');
  const checks = await checkEndpoints(manifest);
  if (checks.some((check) => !check.ok)) throw new AppReleaseError('Rollback reached its expected images but HTTPS checks failed.', { ...runtime, app: name, checks, ok: false });
  const patch = writeRollbackPatch(join(app.directory, manifest.compose), recovered, output);
  return { version: 1, ok: true, outcome: 'rolled_back', app: name, stack: manifest.stack, services: runtime.services, checks, patch: patch ?? null, patchBaseDirectory: dirname(join(app.directory, manifest.compose)), nextAction: patch ? 'Review the image-only patch and apply it from patchBaseDirectory, then validate before another deployment.' : 'Desired images already match the recovered release. Validate before another deployment.' };
}

async function verify(name: string | undefined, json = false): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- verify <app>');
  const { manifest } = loadApp(name);
  if (manifest.checks.length === 0) {
    if (json) emitAppJson({ version: 1, ok: true, app: name, checks: [], warning: 'No endpoint checks declared.' });
    else console.log(`${name} declares no endpoint checks.`);
    return;
  }
  const results = await checkEndpoints(manifest);
  if (json) {
    const ok = results.every((check) => check.ok);
    emitAppJson({ version: 1, ok, app: name, checks: results });
    if (!ok) process.exitCode = 1;
    return;
  }
  for (const check of results) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.url} — ${check.detail}`);
  }
  if (results.some((check) => !check.ok)) throw new Error(`${name} endpoint verification failed.`);
  success(`${name} endpoint verification passed.`);
}

async function diagnose(name: string | undefined): Promise<boolean> {
  if (!name) throw new Error('Usage: pnpm run app -- diagnose <app> --json');
  const result = await collectAppDiagnosis(name);
  emitAppJson(result);
  const { ok } = result;
  return ok;
}

async function deploy(name: string | undefined) {
  if (!name) throw new Error('Usage: pnpm run app -- deploy <app>');
  setOperationPhase('validate');
  requireRuntime();
  const app = loadApp(name);
  const { directory, manifest } = app;
  setOperationPhase('stage-files');
  const transfer = stageAppFiles(directory, manifest.files);
  try {
    if (!isDeepStrictEqual(app.compose, parseYaml(readFileSync(join(transfer.directory, manifest.compose), 'utf8')))) throw new Error('Compose changed after validation. Review and validate it again before deploying.');
    await new Promise<void>(done => setImmediate(done));
    assertOperationRunning();
    const secretEnvironment = deployAppSecrets(manifest);
    const extraVars = JSON.stringify({
      toad_app_name: manifest.name,
      toad_app_stack: manifest.stack,
      toad_app_compose: manifest.compose,
      toad_app_source: transfer.directory,
      toad_app_files: manifest.files,
      toad_app_environment: secretEnvironment,
      toad_app_has_state: manifest.volumes.length > 0,
      toad_router_config_path: ROUTER_CONFIG_PATH,
    });
    setOperationPhase('transfer');
    const code = await runProgramStream(ANSIBLE_PLAYBOOK, [
      '-i', INVENTORY,
      'playbooks/deployApp.yaml',
      '--extra-vars', extraVars,
    ], { cwd: ANSIBLE_DIR });
    if (code !== 0) throw new Error(`Deployment failed with exit code ${code}.`);
    setOperationPhase('rollout');
    const runtime = await waitForServices(app);
    setOperationPhase('https');
    const checks = await checkEndpoints(manifest);
    if (checks.some((check) => !check.ok)) throw new AppReleaseError('Requested images are running, but HTTPS checks failed.', { ...runtime, app: name, checks, ok: false, outcome: 'failed' });
    return { version: 1, ...runtime, app: name, stack: manifest.stack, checks, urls: checks.map((check) => check.url) };
  } finally { transfer.cleanup(); }
}

function secret(args: string[]): void {
  const action = args[0];
  if (action === 'init') {
    ensureAgeIdentity();
    success('Created or reused the ignored TOAD age identity. Back it up in your secret manager.');
    return;
  }
  if (action === 'recipient') {
    console.log(ensureAgeIdentity());
    return;
  }
  if (action === 'encrypt') {
    const appName = args[1];
    const secretName = args[2];
    const fromIndex = args.indexOf('--from-file');
    const source = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
    if (!appName || !secretName || !source) {
      throw new Error('Usage: pnpm run app -- secret encrypt <app> <name> --from-file <path>');
    }
    // Encryption bootstraps declared ciphertext. Deployment/validation still require every file.
    const { manifest } = loadApp(appName, APPS_DIR, { allowMissingSecretFiles: true });
    const spec = manifest.secrets.find((candidate) => candidate.name === secretName);
    if (!spec) throw new Error(`Secret "${secretName}" is not declared in ${appName}/toad.yaml.`);
    const destination = encryptAppSecret(appName, spec, resolve(source));
    success(`Encrypted ${secretName} to ${destination}. The plaintext input was not modified.`);
    return;
  }
  throw new Error('Usage: pnpm run app -- secret <init|recipient|encrypt>');
}

async function remove(name: string | undefined, force: boolean): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- remove <app> [--yes]');
  const { manifest } = loadApp(name);
  if (!force) {
    const confirmation = await ask(`Type the stack name "${manifest.stack}" to remove it`);
    if (confirmation !== manifest.stack) {
      closeReadline();
      console.log('Cancelled.');
      return;
    }
  }
  closeReadline();
  console.log(remote(`docker stack rm ${manifest.stack}`).trim());
  success(`Removed Swarm stack ${manifest.stack}. Local application files were kept.`);
}

function declaredVolume(appName: string | undefined, volumeName: string | undefined) {
  if (!appName || !volumeName) throw new Error('Both app and volume names are required.');
  const app = loadApp(appName);
  const volume = app.manifest.volumes.find((candidate) => candidate.name === volumeName);
  if (!volume) throw new Error(`Volume "${volumeName}" is not declared by ${appName}.`);
  if (volume.backup !== 'required') throw new Error(`Volume "${volumeName}" is explicitly excluded from backups.`);
  return { app, volume };
}

async function backup(args: string[]): Promise<void> {
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const { app, volume } = declaredVolume(positional[0], positional[1]);
  const result = await backupVolume(app.manifest, volume, output);
  success(`Encrypted backup: ${result.path}`);
  console.log(`SHA-256: ${result.sha256}`);
}

async function restore(args: string[]): Promise<void> {
  const positional = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--from');
  const fromIndex = args.indexOf('--from');
  const source = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
  if (!source) throw new Error('Usage: pnpm run app -- restore <app> <volume> --from <archive> [--yes]');
  const { app, volume } = declaredVolume(positional[0], positional[1]);
  if (!args.includes('--yes')) {
    const expected = `${app.manifest.stack}_${volume.name}`;
    const confirmation = await ask(`Type the volume name "${expected}" to restore it`);
    if (confirmation !== expected) {
      closeReadline();
      console.log('Cancelled.');
      return;
    }
  }
  closeReadline();
  await restoreVolume(app.manifest, volume, source);
  success(`Restored ${app.manifest.stack}_${volume.name}. Redeploy the app and verify it.`);
}

export async function run(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const previousJson = process.env.TOAD_JSON;
  if (json) process.env.TOAD_JSON = '1';
  let parsing = true;
  try {
    const parsed = parseAppArguments(args);
    parsing = false;
    const { command, positional, options } = parsed;
    if (parsed.help) { showAppHelp(args[0] === 'help' ? args[1] : command); return; }
    if (!json) banner('TOAD Application Lifecycle');
    const option = (flag: string): string | undefined => typeof options[flag] === 'string' ? options[flag] : undefined;
    const printResult = (result: Record<string, unknown>): void => {
      if (json) emitAppJson(result);
      else {
        success(`${String(result.app ?? 'Application')}: ${String(result.outcome ?? 'complete')}`);
        if (Array.isArray(result.urls)) for (const url of result.urls) console.log(String(url));
        if (typeof result.patch === 'string') console.log(`Review rollback patch: ${result.patch}`);
        if (typeof result.nextAction === 'string') console.log(result.nextAction);
      }
    };
    const publish = async (): Promise<string> => {
      const name = positional[0]!;
      const app = loadApp(name);
      const buildPath = join(app.directory, 'build.yaml');
      const config = existsSync(buildPath) ? parseYaml(readFileSync(buildPath, 'utf8')) as { image?: unknown; platform?: unknown } : {};
      const image = option('--image') ?? (typeof config?.image === 'string' ? config.image : undefined);
      if (!image) throw new Error('Set --image REGISTRY/OWNER/APP:TAG once or configure build.yaml.image.');
      const service = option('--service');
      const platform = option('--platform') ?? (typeof config?.platform === 'string' ? config.platform : undefined);
      setOperationPhase('build');
      return publishAppImage(name, image, { ...(service ? { service } : {}), ...(platform ? { platform } : {}) });
    };
    if (['deploy', 'release', 'rollback'].includes(command) && !json) {
      const app = loadApp(positional[0]!);
      console.log(`Target: context ${ACTIVE_CONTEXT ?? 'legacy'}, stack ${app.manifest.stack}, app ${app.manifest.name}`);
    }
    switch (command) {
      case 'list': {
        const apps = listAppNames().map((name) => {
          const { manifest } = loadApp(name);
          return { name, description: manifest.description, stack: manifest.stack };
        });
        if (json) emitAppJson({ version: 1, ok: true, apps });
        else for (const app of apps) console.log(`${app.name.padEnd(18)} ${app.description}`);
        break;
      }
      case 'create': {
        const directory = create(positional[0], option('--template'), json);
        if (json) emitAppJson({ version: 1, ok: true, app: positional[0], directory });
        break;
      }
      case 'publish': {
        const pinned = await publish();
        if (json) emitAppJson({ version: 1, ok: true, app: positional[0], outcome: 'published', image: pinned, nextAction: 'Validate and deploy this immutable release.' });
        else {
          success(`Published and pinned ${pinned}`);
          console.log(`Next: pnpm run app -- validate ${positional[0]}, then pnpm run app -- deploy ${positional[0]}`);
        }
        break;
      }
      case 'release': {
        const pinned = await publish();
        setOperationPhase('validate');
        loadApp(positional[0]!);
        printResult({ ...await deploy(positional[0]), publishedImage: pinned });
        break;
      }
      case 'validate': {
        if (json) {
          const selected = positional[0] ? [positional[0]] : listAppNames();
          if (selected.length === 0) throw new Error('No application manifests found.');
          const apps = selected.map((name) => {
            const { manifest } = loadApp(name);
            return { app: name, services: manifest.services.length, files: manifest.files.length };
          });
          emitAppJson({ version: 1, ok: true, apps });
        } else validate(positional);
        break;
      }
      case 'deploy': printResult(await deploy(positional[0])); break;
      case 'verify': await verify(positional[0], json); break;
      case 'status': status(positional[0], json); break;
      case 'diagnose': {
        if (json) { if (!await diagnose(positional[0])) process.exitCode = 1; }
        else {
          const result = await collectAppDiagnosis(positional[0]!);
          console.log(`${result.app}: ${result.outcome}; ${result.ok ? 'healthy requested release' : 'attention required'}`);
          for (const service of result.services) console.log(`${service.name}: ${service.running}/${service.desired}; ${service.updateState}; ${service.issues.join(', ') || 'verified'}`);
          for (const hint of result.hints) console.log(`Next: ${hint}`);
          if (!result.ok) process.exitCode = 1;
        }
        break;
      }
      case 'logs': await logs(positional[0], positional[1], options); break;
      case 'rollback': printResult(await rollback(positional[0], positional[1], option('--output'))); break;
      case 'backup': await backup(args.slice(1)); break;
      case 'restore': await restore(args.slice(1)); break;
      case 'remove': await remove(positional[0], args.includes('--yes')); break;
      case 'secret': secret(args.slice(1)); break;
      default: showAppHelp(); if (command) process.exitCode = 1;
    }
  } catch (cause) {
    closeReadline();
    if (json) {
      const message = cause instanceof AppReleaseError ? cause.message
        : parsing && cause instanceof Error ? cause.message
          : 'Application command failed. Inspect local validation or operator diagnostics for details.';
      emitAppJson({
        version: 1, ok: false,
        ...(cause instanceof AppReleaseError ? cause.result : {}),
        error: { code: parsing ? 'INVALID_ARGUMENTS' : cause instanceof AppReleaseError ? 'RELEASE_NOT_DELIVERED' : 'APP_COMMAND_FAILED', message },
        nextAction: parsing ? 'Run app COMMAND --help and correct the arguments.' : 'Run app validate NAME, then app diagnose NAME --json. Inspect sensitive logs only in your trusted operator environment.',
      });
    } else error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  } finally {
    if (previousJson === undefined) delete process.env.TOAD_JSON;
    else process.env.TOAD_JSON = previousJson;
  }
}
