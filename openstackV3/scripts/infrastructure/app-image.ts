/** Build only explicitly allow-listed source files, publish, and pin the resulting image. */
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse as parseYaml, parseDocument } from 'yaml';
import { APPS_DIR, loadApp } from './app-manifest.js';
import { runProgramAsync } from './shell.js';

export interface ImageBuilder {
  publish(context: string, image: string, platform: string, metadata: string): Promise<string>;
}

const dockerBuilder: ImageBuilder = {
  async publish(context, image, platform, metadata) {
    await runProgramAsync('docker', [
      'buildx', 'build', '--platform', platform, '--tag', image,
      '--metadata-file', metadata, '--push', context,
    ], { showOutput: false, spinner: 'Building and publishing image' });
    const output = JSON.parse(readFileSync(metadata, 'utf8')) as Record<string, unknown>;
    const digest = output['containerimage.digest'];
    if (typeof digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
      throw new Error('The builder did not return an immutable SHA-256 image digest. Compose was not changed.');
    }
    return digest;
  },
};

export function sourceFile(context: string, name: string): string {
  const forbidden = (path: string) => !path || isAbsolute(path) || path.includes('\\') || path.split('/').some((part) =>
    part === '..' || part === 'credentials' || part === 'secrets' || part === '.git'
    || part.startsWith('.env') || /\.(?:key|pem|age)$/.test(part));
  if (forbidden(name) || lstatSync(context).isSymbolicLink()) {
    throw new Error('Build files must be safe relative source paths without credentials or secrets.');
  }
  const source = realpathSync(resolve(context, name));
  const inside = relative(realpathSync(context), source);
  if (forbidden(inside) || !statSync(source).isFile()) throw new Error('Build files cannot escape the source directory or include private files.');
  return source;
}

export async function publishAppImage(
  name: string,
  image: string,
  options: { service?: string; platform?: string; appsDirectory?: string; builder?: ImageBuilder } = {},
): Promise<string> {
  // Require an explicit registry and tag: no accidental Docker Hub library push.
  if (!/^[a-z0-9.-]+(?::\d+)?\/[a-z0-9._/-]+:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(image)
    || image.includes('..') || image.includes('//')) {
    throw new Error('--image must name a registry/repository:tag, such as ghcr.io/owner/my-app:v1.');
  }
  const platform = options.platform ?? 'linux/amd64';
  if (!['linux/amd64', 'linux/arm64'].includes(platform)) throw new Error('--platform must be linux/amd64 or linux/arm64.');
  const app = loadApp(name, options.appsDirectory ?? APPS_DIR);
  const service = options.service ?? (app.manifest.services.length === 1 ? app.manifest.services[0] : undefined);
  if (!service || !app.manifest.services.includes(service)) throw new Error('Select a declared service with --service.');
  const configPath = join(app.directory, 'build.yaml');
  if (!existsSync(configPath)) throw new Error('build.yaml is missing. Start with app create NAME --template node-web.');
  const build = parseYaml(readFileSync(configPath, 'utf8')) as { version?: unknown; files?: unknown; port?: unknown };
  if (build?.version !== 1 || !Array.isArray(build.files) || !build.files.every((file) => typeof file === 'string')
    || !build.files.includes('Dockerfile') || !Number.isInteger(build.port) || Number(build.port) < 1 || Number(build.port) > 65535) {
    throw new Error('build.yaml requires version: 1, an explicit files allow-list including Dockerfile, and a valid port.');
  }
  const composePath = join(app.directory, app.manifest.compose);
  const original = readFileSync(composePath, 'utf8');
  const document = parseDocument(original);
  const labelsPath = ['services', service, 'deploy', 'labels'];
  const labels = (document.toJS() as { services?: Record<string, { deploy?: { labels?: unknown } }> })
    .services?.[service]?.deploy?.labels;
  const portLabels = Array.isArray(labels)
    ? labels.filter((label) => typeof label === 'string' && label.includes('.loadbalancer.server.port='))
    : labels && typeof labels === 'object' ? Object.keys(labels).filter((key) => key.endsWith('.loadbalancer.server.port')) : [];
  if (portLabels.length > 1) throw new Error('Multiple routed ports are ambiguous. Use one Traefik service per build target.');
  const staging = mkdtempSync(join(tmpdir(), 'toad-build-'));
  try {
    const context = join(staging, 'context');
    mkdirSync(context);
    for (const file of build.files as string[]) {
      const source = sourceFile(join(app.directory, 'source'), file);
      const target = join(context, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    const digest = await (options.builder ?? dockerBuilder).publish(context, image, platform, join(staging, 'metadata.json'));
    if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('The builder returned an invalid digest.');
    const pinned = `${image}@${digest}`;
    if (readFileSync(composePath, 'utf8') !== original) throw new Error('Compose changed during the build; refusing to overwrite it.');
    document.setIn(['services', service, 'image'], pinned);
    if (Array.isArray(labels)) {
      document.setIn(labelsPath, labels.map((label) => typeof label === 'string'
        ? label.replace(/(\.loadbalancer\.server\.port=).*$/, `$1${build.port}`) : label));
    } else if (labels && typeof labels === 'object') {
      for (const key of Object.keys(labels)) if (key.endsWith('.loadbalancer.server.port')) document.setIn([...labelsPath, key], String(build.port));
    }
    writeFileSync(composePath, document.toString(), { mode: 0o640 });
    try { loadApp(name, options.appsDirectory ?? APPS_DIR); }
    catch (cause) { writeFileSync(composePath, original); throw cause; }
    return pinned;
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
