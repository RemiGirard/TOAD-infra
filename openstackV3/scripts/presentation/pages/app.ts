/** Generic lifecycle commands for manifest-driven Swarm applications. */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { ask, banner, closeReadline, error, success } from '../../infrastructure/cli.js';
import {
  APP_API_VERSION,
  APPS_DIR,
  expandAppValue,
  listAppNames,
  loadApp,
  readRouterConfig,
} from '../../infrastructure/app-manifest.js';
import { INVENTORY_PATH, ROOT_DIR, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import { runProgram, runProgramStream } from '../../infrastructure/shell.js';
import { deployAppSecrets, encryptAppSecret, ensureAgeIdentity, managerSshArgs } from '../../infrastructure/app-secrets.js';
import { backupVolume, restoreVolume } from '../../infrastructure/app-backup.js';

const ANSIBLE_DIR = resolve(ROOT_DIR, '..', 'ansible');
const INVENTORY = INVENTORY_PATH;
const ANSIBLE = join(ANSIBLE_DIR, 'venv', 'bin', 'ansible');
const ANSIBLE_PLAYBOOK = join(ANSIBLE_DIR, 'venv', 'bin', 'ansible-playbook');

function help(): void {
  console.log(`Usage: pnpm run app -- <command> [app] [options]

Commands:
  list                         List manifest-driven applications
  create <app>                 Scaffold a safe Traefik application
  validate [app|--all]         Validate manifests and Compose policies
  deploy <app>                 Copy, deploy, and verify an application
  verify <app>                 Check declared HTTPS endpoints
  status <app> [--json]        Show services and replicas
  diagnose <app> --json        Combine replicas, checks, failed tasks, and hints
  logs <app> [service]         Show the last 100 service log lines
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
                               Encrypt a manifest-declared secret for Git`);
}

function requireRuntime(): void {
  if (!existsSync(INVENTORY)) throw new Error('inventory.yaml is missing. Run pnpm run inventory <stack-name>.');
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
  return `${stack}_${service}`;
}

function create(name: string | undefined): void {
  if (!name || !/^[a-z][a-z0-9-]{0,31}$/.test(name)) {
    throw new Error('Provide an app name using lowercase letters, numbers, and hyphens.');
  }
  const directory = join(APPS_DIR, name);
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
    checks: [{ name: name, url: `https://${name}.\${TOAD_DOMAIN}/`, status: 200 }],
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

networks:
  traefik-public:
    external: true
`;
  writeFileSync(join(directory, 'toad.yaml'), stringifyYaml(manifest), { mode: 0o640 });
  writeFileSync(join(directory, 'docker-compose.yaml'), compose, { mode: 0o640 });
  success(`Created ${directory}`);
  console.log(`Next: edit the image and labels, then run pnpm run app -- validate ${name}`);
}

function validate(names: string[]): void {
  const selected = names[0] && names[0] !== '--all' ? [names[0]] : listAppNames();
  if (selected.length === 0) throw new Error('No applications with toad.yaml manifests were found.');
  for (const name of selected) {
    const app = loadApp(name);
    success(`${app.manifest.name}: ${app.manifest.services.length} service(s), ${app.manifest.files.length} declared file(s)`);
  }
}

interface ServiceInspect {
  ID?: string;
  Spec?: { Name?: string; TaskTemplate?: { ContainerSpec?: { Image?: string } } };
  UpdateStatus?: { State?: string; Message?: string };
}

interface TaskInspect {
  ID?: string;
  DesiredState?: string;
  Status?: { State?: string; Err?: string; Message?: string; Timestamp?: string };
}

interface ServiceRuntime {
  service: ServiceInspect;
  running: number;
  desired: number;
  tasks: TaskInspect[];
}

function dockerFromManager(args: string[]): string {
  return runProgram('ssh', [...managerSshArgs(), 'sudo', 'docker', ...args], {
    showCommand: false,
    showOutput: false,
  });
}

function serviceStatus(manifest: ReturnType<typeof loadApp>['manifest']): ServiceRuntime[] {
  let rawIds = '';
  try {
    rawIds = dockerFromManager(['stack', 'services', manifest.stack, '--quiet']);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/nothing found in stack|no such stack/i.test(message)) return [];
    throw cause;
  }
  const ids = rawIds.split('\n').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  const services = JSON.parse(dockerFromManager(['service', 'inspect', ...ids])) as ServiceInspect[];
  return services.map((service) => {
    const taskIds = dockerFromManager(['service', 'ps', service.ID ?? '', '--quiet'])
      .split('\n').map((id) => id.trim()).filter(Boolean);
    const tasks = taskIds.length > 0
      ? JSON.parse(dockerFromManager(['inspect', ...taskIds])) as TaskInspect[]
      : [];
    return {
      service,
      running: tasks.filter((task) => task.DesiredState === 'running' && task.Status?.State === 'running').length,
      desired: tasks.filter((task) => task.DesiredState === 'running').length,
      tasks,
    };
  });
}

function serializedServices(runtimes: ServiceRuntime[]) {
  return runtimes.map(({ service, running, desired }) => ({
    id: service.ID,
    name: service.Spec?.Name,
    image: service.Spec?.TaskTemplate?.ContainerSpec?.Image,
    running,
    desired,
    updateState: service.UpdateStatus?.State ?? 'none',
    updateMessage: service.UpdateStatus?.Message ?? '',
  }));
}

function statusResult(manifest: ReturnType<typeof loadApp>['manifest'], runtimes = serviceStatus(manifest)) {
  const services = serializedServices(runtimes);
  return {
    version: 1,
    ok: services.length === manifest.services.length
      && services.every((service) => service.running === service.desired && service.desired > 0),
    app: manifest.name,
    stack: manifest.stack,
    services,
  };
}

function status(name: string | undefined, json = false): void {
  if (!name) throw new Error('Usage: pnpm run app -- status <app>');
  const { manifest } = loadApp(name);
  if (json) {
    console.log(JSON.stringify(statusResult(manifest), null, 2));
    return;
  }
  const output = remote(`docker stack services ${manifest.stack}`);
  console.log(output.trim());
}

async function waitForServices(name: string): Promise<void> {
  const { manifest } = loadApp(name);
  let detail = '';
  let stable = 0;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    detail = remote(`docker stack services ${manifest.stack}`, false);
    const replicas = [...detail.matchAll(/(\d+)\/(\d+)/g)].map((match) => ({
      running: Number(match[1]),
      desired: Number(match[2]),
    }));
    const converged = replicas.length >= manifest.services.length
      && replicas.every((replica) => replica.running === replica.desired && replica.desired > 0);
    stable = converged ? stable + 1 : 0;
    if (stable >= 3) return;
    if (attempt < 24) await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
  }
  throw new Error(`${name} services did not converge:\n${detail.trim()}`);
}

function logs(name: string | undefined, requestedService: string | undefined): void {
  if (!name) throw new Error('Usage: pnpm run app -- logs <app> [service]');
  const { manifest } = loadApp(name);
  const service = requestedService ?? manifest.services[0];
  if (!service || !manifest.services.includes(service)) throw new Error(`Unknown service "${service ?? ''}".`);
  const output = remote(`docker service logs --tail 100 --timestamps ${serviceName(manifest.stack, service)}`);
  console.log(output.trim());
}

async function rollback(name: string | undefined, requestedService: string | undefined): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- rollback <app> [service]');
  const { manifest } = loadApp(name);
  const services = requestedService ? [requestedService] : manifest.services;
  for (const service of services) {
    if (!manifest.services.includes(service)) throw new Error(`Unknown service "${service}".`);
    console.log(remote(`docker service update --rollback ${serviceName(manifest.stack, service)}`).trim());
  }
  success(`Rollback requested for ${services.join(', ')}.`);
}

interface EndpointResult {
  name: string;
  url: string;
  expectedStatus: number;
  actualStatus?: number;
  durationMs: number;
  ok: boolean;
  detail: string;
}

async function checkEndpoints(manifest: ReturnType<typeof loadApp>['manifest'], attempts = 12): Promise<EndpointResult[]> {
  if (manifest.checks.length === 0) return [];
  const config = readRouterConfig();
  const results: EndpointResult[] = [];
  for (const check of manifest.checks) {
    const url = expandAppValue(check.url, config);
    let result = '';
    let ok = false;
    let actualStatus: number | undefined;
    const startedAt = Date.now();
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
        result = `HTTP ${response.status}`;
        actualStatus = response.status;
        ok = response.status === check.status;
      } catch (cause) {
        result = cause instanceof Error ? cause.message : String(cause);
      }
      if (ok || attempt === attempts) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
    }
    results.push({
      name: check.name,
      url,
      expectedStatus: check.status,
      ...(actualStatus === undefined ? {} : { actualStatus }),
      durationMs: Date.now() - startedAt,
      ok,
      detail: result,
    });
  }
  return results;
}

async function verify(name: string | undefined): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- verify <app>');
  const { manifest } = loadApp(name);
  if (manifest.checks.length === 0) {
    console.log(`${name} declares no endpoint checks.`);
    return;
  }
  const results = await checkEndpoints(manifest);
  for (const check of results) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.url} — ${check.detail}`);
  }
  if (results.some((check) => !check.ok)) throw new Error(`${name} endpoint verification failed.`);
  success(`${name} endpoint verification passed.`);
}

async function diagnose(name: string | undefined): Promise<boolean> {
  if (!name) throw new Error('Usage: pnpm run app -- diagnose <app> --json');
  const { manifest } = loadApp(name);
  const runtimes = serviceStatus(manifest);
  const runtime = statusResult(manifest, runtimes);
  const checks = await checkEndpoints(manifest, 1);
  const failedStates = new Set(['failed', 'rejected', 'orphaned']);
  const failedTasks = runtimes.flatMap(({ service, tasks }) => tasks
    .filter((task) => Boolean(task.Status?.Err) || failedStates.has(task.Status?.State ?? ''))
    .map((task) => ({
      service: service.Spec?.Name,
      taskId: task.ID,
      desiredState: task.DesiredState,
      state: task.Status?.State,
      error: task.Status?.Err ?? '',
      message: task.Status?.Message ?? '',
      timestamp: task.Status?.Timestamp,
    })));
  const hints: string[] = [];
  if (runtime.services.length === 0) hints.push(`Deploy the stack with: pnpm run app -- deploy ${manifest.name}`);
  if (!runtime.ok && runtime.services.length > 0) hints.push(`Inspect recent tasks and logs with: pnpm run app -- logs ${manifest.name}`);
  if (checks.some((check) => !check.ok)) hints.push('Check Traefik router labels, service port, DNS, and certificate issuance.');
  if (failedTasks.length > 0) hints.push('Use the failed task error before retrying or requesting a rollback.');
  const ok = runtime.ok && checks.every((check) => check.ok);
  console.log(JSON.stringify({
    version: 1,
    ok,
    app: manifest.name,
    stack: manifest.stack,
    validation: { ok: true },
    services: runtime.services,
    checks,
    failedTasks,
    hints,
  }, null, 2));
  return ok;
}

async function deploy(name: string | undefined): Promise<void> {
  if (!name) throw new Error('Usage: pnpm run app -- deploy <app>');
  requireRuntime();
  const { directory, manifest } = loadApp(name);
  const secretEnvironment = deployAppSecrets(manifest);
  const extraVars = JSON.stringify({
    toad_app_name: manifest.name,
    toad_app_stack: manifest.stack,
    toad_app_compose: manifest.compose,
    toad_app_source: directory,
    toad_app_files: manifest.files,
    toad_app_environment: secretEnvironment,
    toad_app_has_state: manifest.volumes.length > 0,
    toad_router_config_path: ROUTER_CONFIG_PATH,
  });
  const code = await runProgramStream(ANSIBLE_PLAYBOOK, [
    '-i', INVENTORY,
    'playbooks/deployApp.yaml',
    '--extra-vars', extraVars,
  ], { cwd: ANSIBLE_DIR });
  if (code !== 0) throw new Error(`Deployment failed with exit code ${code}.`);
  await waitForServices(name);
  status(name);
  await verify(name);
  success(`${name} deployed and verified.`);
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
    const { manifest } = loadApp(appName);
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
  const command = args[0];
  const positional = args.slice(1).filter((arg) => !arg.startsWith('--'));
  const json = args.includes('--json') && (command === 'status' || command === 'diagnose');
  if (!json) banner('TOAD Application Lifecycle');
  try {
    switch (command) {
      case 'list':
        for (const name of listAppNames()) {
          const { manifest } = loadApp(name);
          console.log(`${name.padEnd(18)} ${manifest.description}`);
        }
        break;
      case 'create': create(positional[0]); break;
      case 'validate': validate(args.slice(1)); break;
      case 'deploy': await deploy(positional[0]); break;
      case 'verify': await verify(positional[0]); break;
      case 'status': status(positional[0], json); break;
      case 'diagnose': if (!await diagnose(positional[0])) process.exitCode = 1; break;
      case 'logs': logs(positional[0], positional[1]); break;
      case 'rollback': await rollback(positional[0], positional[1]); break;
      case 'backup': await backup(args.slice(1)); break;
      case 'restore': await restore(args.slice(1)); break;
      case 'remove': await remove(positional[0], args.includes('--yes')); break;
      case 'secret': secret(args.slice(1)); break;
      default: help(); if (command) process.exitCode = 1;
    }
  } catch (cause) {
    closeReadline();
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
