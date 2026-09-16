/** Declarative application manifests and safety validation. */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ROOT_DIR, ROUTER_CONFIG_PATH } from './paths.js';

export const APPS_DIR = resolve(ROOT_DIR, '..', 'apps');
export const APP_API_VERSION = 'toad.dev/v1';

export interface AppCheck {
  name: string;
  url: string;
  status: number;
}

export interface AppSecret {
  name: string;
  source: string;
  environment: string;
}

export interface AppVolume {
  name: string;
  backup: 'required' | 'none';
  description: string;
}

export interface AppManifest {
  apiVersion: typeof APP_API_VERSION;
  name: string;
  description: string;
  stack: string;
  compose: string;
  files: string[];
  services: string[];
  checks: AppCheck[];
  secrets: AppSecret[];
  volumes: AppVolume[];
}

export interface RouterConfig {
  base_domain: string;
  root_domain: string;
}

export interface LoadedApp {
  directory: string;
  manifestPath: string;
  manifest: AppManifest;
  compose: Record<string, unknown>;
}

const APP_NAME = /^[a-z][a-z0-9-]{0,31}$/;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function safeRelativeFile(file: string): boolean {
  const normalized = normalize(file);
  return !isAbsolute(file)
    && normalized !== '..'
    && !normalized.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    && basename(normalized) !== '.env'
    && !normalized.split(/[\\/]/).includes('credentials');
}

function labelsFor(service: Record<string, unknown>): string[] {
  const deploy = object(service.deploy);
  const labels = deploy?.labels;
  if (Array.isArray(labels)) return labels.filter((label): label is string => typeof label === 'string');
  if (object(labels)) return Object.entries(labels as Record<string, unknown>).map(([key, value]) => `${key}=${String(value)}`);
  return [];
}

function pinnedImage(image: string): boolean {
  return /@sha256:[a-f0-9]{64}$/.test(image);
}

function parseCheck(value: unknown, index: number, errors: string[]): AppCheck | undefined {
  const item = object(value);
  if (!item) {
    errors.push(`checks[${index}] must be an object.`);
    return undefined;
  }
  const name = typeof item.name === 'string' ? item.name : '';
  const url = typeof item.url === 'string' ? item.url : '';
  const status = typeof item.status === 'number' ? item.status : 200;
  if (!name) errors.push(`checks[${index}].name is required.`);
  if (!url.startsWith('https://')) errors.push(`checks[${index}].url must use HTTPS.`);
  if (!Number.isInteger(status) || status < 100 || status > 599) errors.push(`checks[${index}].status is invalid.`);
  return name && url ? { name, url, status } : undefined;
}

export function listAppNames(appsDirectory = APPS_DIR): string[] {
  if (!existsSync(appsDirectory)) return [];
  return readdirSync(appsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(appsDirectory, entry.name, 'toad.yaml')))
    .map((entry) => entry.name)
    .sort();
}

export function readRouterConfig(): RouterConfig {
  const path = ROUTER_CONFIG_PATH;
  if (!existsSync(path)) throw new Error('router/config.yaml is missing. Copy router/config.example.yaml first.');
  const raw = object(parseYaml(readFileSync(path, 'utf8')));
  const baseDomain = raw?.base_domain;
  const rootDomain = raw?.root_domain;
  if (typeof baseDomain !== 'string' || !baseDomain) throw new Error('router/config.yaml must define base_domain.');
  if (typeof rootDomain !== 'string' || !rootDomain) throw new Error('router/config.yaml must define root_domain.');
  return { base_domain: baseDomain, root_domain: rootDomain };
}

export function expandAppValue(value: string, config: RouterConfig): string {
  return value
    .replaceAll('${TOAD_DOMAIN}', config.base_domain)
    .replaceAll('${ROOT_DOMAIN}', config.root_domain);
}

export function loadApp(name: string, appsDirectory = APPS_DIR): LoadedApp {
  if (!APP_NAME.test(name)) throw new Error(`Invalid app name "${name}". Use lowercase letters, numbers, and hyphens.`);
  const directory = join(appsDirectory, name);
  const manifestPath = join(directory, 'toad.yaml');
  if (!existsSync(manifestPath)) throw new Error(`Application "${name}" does not exist (${manifestPath}).`);

  const errors: string[] = [];
  const raw = object(parseYaml(readFileSync(manifestPath, 'utf8')));
  if (!raw) throw new Error(`${manifestPath} must contain a YAML object.`);

  const apiVersion = raw.apiVersion;
  const manifestName = raw.name;
  const description = raw.description;
  const stack = raw.stack;
  const composeName = raw.compose;
  const files = strings(raw.files);
  const services = strings(raw.services);

  if (apiVersion !== APP_API_VERSION) errors.push(`apiVersion must be ${APP_API_VERSION}.`);
  if (manifestName !== name) errors.push(`name must match the directory name "${name}".`);
  if (typeof description !== 'string' || !description.trim()) errors.push('description is required.');
  if (typeof stack !== 'string' || !APP_NAME.test(stack)) errors.push('stack must be a valid lowercase app name.');
  if (typeof composeName !== 'string' || !safeRelativeFile(composeName)) errors.push('compose must be a safe relative file path.');
  if (!files || files.length === 0) errors.push('files must contain at least the Compose file.');
  if (!services || services.length === 0) errors.push('services must contain at least one service name.');

  const safeFiles = files ?? [];
  for (const file of safeFiles) {
    if (!safeRelativeFile(file)) errors.push(`files contains unsafe path "${file}".`);
    if (!existsSync(join(directory, file))) errors.push(`Declared file does not exist: ${file}.`);
  }
  if (typeof composeName === 'string' && !safeFiles.includes(composeName)) errors.push('The Compose file must be listed in files.');

  const checksRaw = raw.checks === undefined ? [] : raw.checks;
  if (!Array.isArray(checksRaw)) errors.push('checks must be a list.');
  const checks = Array.isArray(checksRaw)
    ? checksRaw.map((check, index) => parseCheck(check, index, errors)).filter((check): check is AppCheck => Boolean(check))
    : [];

  const secretsRaw = raw.secrets === undefined ? [] : raw.secrets;
  if (!Array.isArray(secretsRaw)) errors.push('secrets must be a list.');
  const secrets: AppSecret[] = [];
  if (Array.isArray(secretsRaw)) {
    for (const [index, value] of secretsRaw.entries()) {
      const item = object(value);
      const secretName = typeof item?.name === 'string' ? item.name : '';
      const source = typeof item?.source === 'string' ? item.source : '';
      const environment = typeof item?.environment === 'string' ? item.environment : '';
      if (!APP_NAME.test(secretName)) errors.push(`secrets[${index}].name is invalid.`);
      if (!safeRelativeFile(source) || !source.endsWith('.age')) errors.push(`secrets[${index}].source must be a safe .age path.`);
      if (!/^[A-Z][A-Z0-9_]*_SECRET$/.test(environment)) errors.push(`secrets[${index}].environment must be uppercase and end in _SECRET.`);
      if (source && !existsSync(join(directory, source))) errors.push(`Encrypted secret does not exist: ${source}.`);
      if (secretName && source && environment) secrets.push({ name: secretName, source, environment });
    }
    if (new Set(secrets.map((secret) => secret.name)).size !== secrets.length) errors.push('Secret names must be unique.');
    if (new Set(secrets.map((secret) => secret.environment)).size !== secrets.length) errors.push('Secret environment variables must be unique.');
  }

  const volumesRaw = raw.volumes === undefined ? [] : raw.volumes;
  if (!Array.isArray(volumesRaw)) errors.push('volumes must be a list.');
  const volumes: AppVolume[] = [];
  if (Array.isArray(volumesRaw)) {
    for (const [index, value] of volumesRaw.entries()) {
      const item = object(value);
      const volumeName = typeof item?.name === 'string' ? item.name : '';
      const backup = item?.backup;
      const volumeDescription = typeof item?.description === 'string' ? item.description : '';
      if (!APP_NAME.test(volumeName)) errors.push(`volumes[${index}].name is invalid.`);
      if (backup !== 'required' && backup !== 'none') errors.push(`volumes[${index}].backup must be required or none.`);
      if (!volumeDescription.trim()) errors.push(`volumes[${index}].description is required.`);
      if (volumeName && (backup === 'required' || backup === 'none') && volumeDescription) {
        volumes.push({ name: volumeName, backup, description: volumeDescription });
      }
    }
    if (new Set(volumes.map((volume) => volume.name)).size !== volumes.length) errors.push('Volume names must be unique.');
  }

  let compose: Record<string, unknown> = {};
  if (typeof composeName === 'string' && safeRelativeFile(composeName) && existsSync(join(directory, composeName))) {
    compose = object(parseYaml(readFileSync(join(directory, composeName), 'utf8'))) ?? {};
    const composeServices = object(compose.services);
    if (!composeServices || Object.keys(composeServices).length === 0) {
      errors.push('Compose file must define services.');
    } else {
      for (const serviceName of services ?? []) {
        const service = object(composeServices[serviceName]);
        if (!service) {
          errors.push(`Manifest service "${serviceName}" is missing from Compose.`);
          continue;
        }
        if (service.ports !== undefined) errors.push(`${serviceName}: published ports are forbidden; route traffic through Traefik.`);
        if (service.privileged === true) errors.push(`${serviceName}: privileged containers are forbidden.`);
        if (service.network_mode === 'host' || service.pid === 'host' || service.ipc === 'host') {
          errors.push(`${serviceName}: host namespace sharing is forbidden.`);
        }
        if (service.cap_add !== undefined) errors.push(`${serviceName}: added Linux capabilities are forbidden by the default policy.`);
        const securityOptions = strings(service.security_opt) ?? [];
        if (!securityOptions.includes('no-new-privileges:true')) {
          errors.push(`${serviceName}: security_opt must include no-new-privileges:true.`);
        }
        const mountsForSecurity = Array.isArray(service.volumes) ? service.volumes : [];
        if (mountsForSecurity.some((mount) => JSON.stringify(mount).includes('/var/run/docker.sock'))) {
          errors.push(`${serviceName}: mounting the Docker socket is forbidden.`);
        }
        if (typeof service.image !== 'string' || !pinnedImage(service.image)) {
          errors.push(`${serviceName}: image must use an immutable sha256 digest.`);
        }
        const deploy = object(service.deploy);
        const resources = object(deploy?.resources);
        const limits = object(resources?.limits);
        if (typeof limits?.memory !== 'string' || !limits.memory) errors.push(`${serviceName}: deploy.resources.limits.memory is required.`);
        const updateConfig = object(deploy?.update_config);
        if (updateConfig?.failure_action !== 'rollback') {
          errors.push(`${serviceName}: deploy.update_config.failure_action must be rollback.`);
        }
        const labels = labelsFor(service);
        if (labels.includes('traefik.enable=true')) {
          if (!labels.some((label) => label.includes('.loadbalancer.server.port='))) {
            errors.push(`${serviceName}: Traefik-enabled service must declare its load-balancer port.`);
          }
          const networks = strings(service.networks) ?? [];
          if (!networks.includes('traefik-public')) errors.push(`${serviceName}: Traefik-enabled service must join traefik-public.`);
        }
        const mounts = Array.isArray(service.volumes) ? service.volumes : [];
        const namedMounts = mounts.map((mount) => {
          if (typeof mount === 'string') return mount.split(':')[0] ?? '';
          return typeof object(mount)?.source === 'string' ? object(mount)?.source as string : '';
        }).filter((source) => source && !source.startsWith('/') && !source.startsWith('.'));
        if (namedMounts.length > 0) {
          const replicas = deploy?.replicas;
          if (replicas !== 1) errors.push(`${serviceName}: a service with local named volumes must use exactly one replica.`);
          const placement = object(deploy?.placement);
          const constraints = strings(placement?.constraints) ?? [];
          if (!constraints.includes('node.labels.toad.stateful-primary == true')) {
            errors.push(`${serviceName}: a service with local named volumes must be pinned to node.labels.toad.stateful-primary.`);
          }
          for (const mount of namedMounts) {
            if (!volumes.some((volume) => volume.name === mount)) errors.push(`${serviceName}: named volume "${mount}" is missing from manifest volumes.`);
          }
        }
      }
      const undeclared = Object.keys(composeServices).filter((service) => !(services ?? []).includes(service));
      if (undeclared.length > 0) errors.push(`Compose services missing from manifest: ${undeclared.join(', ')}.`);
    }
    const composeSecrets = object(compose.secrets) ?? {};
    for (const secret of secrets) {
      const declaration = object(composeSecrets[secret.name]);
      if (declaration?.external !== true || declaration.name !== `\${${secret.environment}}`) {
        errors.push(`Compose secret "${secret.name}" must be external with name \${${secret.environment}}.`);
      }
    }
    const configs = object(compose.configs) ?? {};
    for (const [configName, value] of Object.entries(configs)) {
      const source = object(value)?.file;
      if (typeof source === 'string' && !safeFiles.includes(source.replace(/^\.\//, ''))) {
        errors.push(`Compose config "${configName}" source must be listed in manifest files: ${source}.`);
      }
    }
    const composeVolumes = object(compose.volumes) ?? {};
    for (const volume of volumes) {
      const declaration = composeVolumes[volume.name];
      if (declaration === undefined) errors.push(`Manifest volume "${volume.name}" is missing from Compose.`);
      if (object(declaration)?.external === true) errors.push(`Manifest volume "${volume.name}" must be stack-owned, not external.`);
    }
    const undeclaredVolumes = Object.keys(composeVolumes).filter((name) => !volumes.some((volume) => volume.name === name));
    if (undeclaredVolumes.length > 0) errors.push(`Compose volumes missing from manifest: ${undeclaredVolumes.join(', ')}.`);
  }

  if (errors.length > 0) throw new Error(`${manifestPath}:\n- ${errors.join('\n- ')}`);

  return {
    directory,
    manifestPath,
    manifest: {
      apiVersion: APP_API_VERSION,
      name,
      description: description as string,
      stack: stack as string,
      compose: composeName as string,
      files: safeFiles,
      services: services as string[],
      checks,
      secrets,
      volumes,
    },
    compose,
  };
}

export function appDirectoryFor(path: string): string {
  return dirname(path);
}
