/** Build public, reviewed documentation into an immutable-config Swarm app. */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { stringify } from 'yaml';
import { ROOT_DIR } from './infrastructure/paths.js';
import { loadApp } from './infrastructure/app-manifest.js';

const root = resolve(ROOT_DIR, '..');
const source = join(root, 'website');
const output = join(root, 'apps', 'toad-landing');
mkdirSync(output, { recursive: true });
const pages = [
  ['QUICKSTART', 'quickstart', 'Try locally'], ['FIRST-APP', 'first-app', 'First app'],
  ['EVALUATION', 'evaluation', 'Cloud evaluation'], ['DEPLOYMENT', 'deployment', 'Production setup'],
  ['COSTS', 'costs', 'Cost worksheet'], ['OPERATIONS', 'operations', 'Operations'],
  ['DISASTER-RECOVERY', 'recovery', 'Recovery'], ['LAUNCH-READINESS', 'launch', 'Validation record'],
  ['BACKUP-AUTOMATION', 'backups', 'Offsite backup job'],
  ['RECOVERY-DRILL-PLAN', 'drill-plan', 'Proposed recovery drill'],
  ['AGENT-RUNBOOK', 'agents', 'Agent runbook'], ['STATEFUL-STORAGE', 'storage', 'Stateful storage'],
  ['../SECURITY', 'security', 'Security'], ['../LICENSE', 'license', 'License'],
] as const;
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const pagePaths = new Map(pages.map(([name, slug]) => [resolve(root, 'docs', `${name}${name === '../LICENSE' ? '' : '.md'}`), `/${slug}.html`]));
function href(value: string, document: string): string {
  if (value.startsWith('#') || /^(?:https?:|mailto:)/.test(value)) return value;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) return '#';
  const [file, hash] = value.split('#');
  const absolute = resolve(root, 'docs', document, '..', file || '');
  const target = pagePaths.get(absolute) ?? (absolute === join(root, 'README.md') ? '/' : `https://github.com/RemiGirard/TOAD-infra/blob/main/${relative(root, absolute)}`);
  return target + (hash ? `#${hash}` : '');
}
for (const [name, slug, label] of pages) {
  const path = resolve(root, 'docs', `${name}${name === '../LICENSE' ? '' : '.md'}`);
  let markdown = readFileSync(path, 'utf8');
  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escape(text);
  renderer.link = function ({ href: target, tokens }) { return `<a href="${escape(href(target, `${name}.md`))}">${this.parser.parseInline(tokens)}</a>`; };
  renderer.heading = function ({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const id = content.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
    return `<h${depth} id="${escape(id)}">${content}</h${depth}>\n`;
  };
  if (name === '../LICENSE') markdown = `# GNU Affero General Public License\n\n\`\`\`text\n${markdown}\n\`\`\``;
  const body = marked.parse(markdown, { renderer, gfm: true, async: false });
  const navigation = pages.map(([, target, title]) => `<a href="/${target}.html"${target === slug ? ' aria-current="page"' : ''}>${title}</a>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(label)} — TOAD</title><meta name="description" content="TOAD: ${escape(label)}. Deploy and operate apps on infrastructure you control."><link rel="canonical" href="https://toad.remigirard.dev/${slug}.html"><link rel="icon" href="/toad.svg"><link rel="stylesheet" href="/style.css"></head><body><a class="skip" href="#main">Skip to content</a><header class="header wrap"><a href="/" class="brand"><img src="/toad.svg" alt="" width="32" height="32">TOAD<span class="tag">DOCUMENTATION</span></a><nav aria-label="Main navigation"><a href="/">Project</a><a href="https://github.com/RemiGirard/TOAD-infra">Source ↗</a></nav></header><div class="docs-layout wrap"><nav class="doc-nav" aria-label="Documentation"><p>GET STARTED & OPERATE</p>${navigation}</nav><main id="main" class="doc-content"><div class="doc-meta"><span>TOAD / ${escape(label.toUpperCase())}</span><a href="https://github.com/RemiGirard/TOAD-infra/blob/main/${relative(root, path)}">Markdown source ↗</a></div>${body}</main></div><footer class="footer wrap"><a class="brand" href="/">TOAD</a><p>Your app. Your infrastructure.</p><div><a href="/security.html">Security</a><a href="/license.html">AGPL-3.0-or-later</a></div></footer></body></html>`;
  writeFileSync(join(output, `${slug}.html`), html);
}
const assets = ['index.html', 'style.css', 'app.mjs', 'toad.svg', 'starter.png', 'walkthrough.json', 'walkthrough.css'];
for (const asset of assets) {
  if (!existsSync(join(source, asset))) throw new Error(`Missing reviewed website asset: ${asset}`);
  copyFileSync(join(source, asset), join(output, asset));
}
writeFileSync(join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://toad.remigirard.dev/sitemap.xml\n');
writeFileSync(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://toad.remigirard.dev/</loc></url>${pages.map(([, slug]) => `<url><loc>https://toad.remigirard.dev/${slug}.html</loc></url>`).join('')}</urlset>`);
writeFileSync(join(output, 'nginx.conf'), `server {
  listen 80 default_server;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  server_tokens off;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'" always;
  location = /healthz { access_log off; return 200 'ok\\n'; }
  location = /starter { return 308 /starter/; }
  location ~ \\.mjs$ { default_type text/javascript; try_files $uri =404; }
  location / { try_files $uri $uri/ =404; }
}\n`);
const files = [...assets, ...pages.map(([, slug]) => `${slug}.html`), 'robots.txt', 'sitemap.xml', 'nginx.conf'];
const configs: Record<string, unknown> = {};
const mounts: Array<{ source: string; target: string }> = [];
for (const [index, file] of files.entries()) {
  const contents = readFileSync(join(output, file));
  if (contents.length > 480_000) throw new Error(`${file} is too large for a Docker config.`);
  const key = `asset-${index}`;
  configs[key] = { name: `toad-web-${index}-${createHash('sha256').update(contents).digest('hex').slice(0, 16)}`, file: `./${file}` };
  mounts.push({ source: key, target: file === 'nginx.conf' ? '/etc/nginx/conf.d/default.conf' : `/usr/share/nginx/html/${file}` });
}
const compose = {
  services: { web: {
    image: 'nginx:1.29.1-alpine@sha256:42a516af16b852e33b7682d5ef8acbd5d13fe08fecadc7ed98605ba5e3b26ab8',
    security_opt: ['no-new-privileges:true'], networks: ['traefik-public'], configs: mounts,
    healthcheck: { test: ['CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1/healthz'], interval: '15s', timeout: '3s', retries: 3 },
    deploy: { replicas: 2, resources: { limits: { memory: '64M' }, reservations: { memory: '16M' } },
      labels: ['traefik.enable=true', 'traefik.http.routers.toad-site.rule=Host(`toad.remigirard.dev`)',
        'traefik.http.routers.toad-site.priority=100', 'traefik.http.routers.toad-site.entrypoints=websecure',
        'traefik.http.routers.toad-site.tls=true', 'traefik.http.routers.toad-site.tls.certresolver=infomaniak',
        'traefik.http.services.toad-site.loadbalancer.server.port=80'],
      update_config: { parallelism: 1, order: 'start-first', failure_action: 'rollback', monitor: '2m' } },
  } }, configs, networks: { 'traefik-public': { external: true } },
};
writeFileSync(join(output, 'docker-compose.yaml'), stringify(compose));
writeFileSync(join(output, 'toad.yaml'), stringify({ apiVersion: 'toad.dev/v1', name: 'toad-landing', description: 'Public TOAD project site and versioned documentation', stack: 'toad-landing', compose: 'docker-compose.yaml', files: ['docker-compose.yaml', ...files], services: ['web'], checks: [{ name: 'project-site', url: 'https://toad.remigirard.dev/', status: 200 }, { name: 'first-app-guide', url: 'https://toad.remigirard.dev/first-app.html', status: 200 }], secrets: [], volumes: [] }));
loadApp('toad-landing');
console.log(`Built ${pages.length} documentation pages and ${assets.length} public assets; validated toad-landing.`);
