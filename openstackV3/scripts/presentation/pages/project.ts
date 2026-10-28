/** Initialize delivery metadata beside an existing app; never copy or upload its source. */
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import { sourceFile } from '../../infrastructure/app-image.js';
export async function run(args: string[]): Promise<void> {
  const value = (flag: string) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
  const name = args[0];
  if (!name || !/^[a-z][a-z0-9-]{0,31}$/.test(name)) throw new Error('Usage: init NAME --image REGISTRY/OWNER/APP:TAG [--port 3000] [--files Dockerfile,server.mjs] --project DIR');
  const image = value('--image');
  if (!image || !/^[a-z0-9.-]+(?::\d+)?\/[a-z0-9._/-]+(?::[A-Za-z0-9_.-]+)?(?:@sha256:[a-f0-9]{64})?$/.test(image)) throw new Error('--image requires an explicit registry/repository:tag or immutable digest.');
  const pinned = /@sha256:[a-f0-9]{64}$/.test(image);
  if (!pinned && !/:[A-Za-z0-9_.-]+$/.test(image)) throw new Error('A build image requires an explicit tag.');
  const port = Number(value('--port') ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be 1-65535.');
  const directory = resolve(process.env.TOAD_PROJECT_DIR ?? process.cwd());
  const files = (value('--files') ?? 'Dockerfile').split(',');
  if (!pinned) { if (!files.includes('Dockerfile')) throw new Error('Build files must include Dockerfile.'); for (const file of files) sourceFile(directory, file); }
  const paths = ['toad.yaml', 'compose.toad.yaml', ...(!pinned ? ['build.yaml'] : [])];
  if (paths.some(file => existsSync(join(directory, file)))) throw new Error('TOAD metadata already exists; existing files were preserved.');
  const initialImage = pinned ? image : 'traefik/whoami:v1.11.0@sha256:200689790a0a0ea48ca45992e0450bc26ccab5307375b41c84dfc4f2475937ab';
  const manifest = { apiVersion: 'toad.dev/v1', name, description: `${name} application`, stack: name, compose: 'compose.toad.yaml', files: ['compose.toad.yaml'], services: [name], checks: [{ name: 'https', url: `https://${name}.\${TOAD_DOMAIN}/`, status: 200 }], secrets: [], volumes: [] };
  const compose = { services: { [name]: { image: initialImage, security_opt: ['no-new-privileges:true'], networks: ['traefik-public'], deploy: { replicas: 2, resources: { limits: { memory: '256M' }, reservations: { memory: '32M' } }, labels: [`traefik.enable=true`, `traefik.http.routers.${name}.rule=Host(\`${name}.\${TOAD_DOMAIN}\`)`, `traefik.http.routers.${name}.entrypoints=websecure`, `traefik.http.routers.${name}.tls=true`, `traefik.http.routers.${name}.tls.certresolver=letsencrypt`, `traefik.http.services.${name}.loadbalancer.server.port=${pinned ? port : 80}`], update_config: { parallelism: 1, order: 'start-first', failure_action: 'rollback', monitor: '2m' } } } }, networks: { 'traefik-public': { external: true } } };
  writeFileSync(join(directory, 'toad.yaml'), stringify(manifest), { flag: 'wx', mode: 0o640 });
  writeFileSync(join(directory, 'compose.toad.yaml'), stringify(compose), { flag: 'wx', mode: 0o640 });
  if (!pinned) writeFileSync(join(directory, 'build.yaml'), stringify({ version: 1, source: '.', image, platform: 'linux/amd64', port, files }), { flag: 'wx', mode: 0o640 });
  const output = { version: 1, ok: true, app: name, project: directory, files: paths, nextAction: pinned ? `app deploy ${name} --project ${directory}` : `Review build.yaml's file allow-list, then app release ${name} --project ${directory}. The current image is a routing placeholder.` };
  console.log(args.includes('--json') ? JSON.stringify(output, null, 2) : `Initialized ${name} in ${directory}.\n${output.nextAction}`);
}
