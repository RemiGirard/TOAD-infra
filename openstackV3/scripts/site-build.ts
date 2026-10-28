/** Build public, reviewed documentation into an immutable-config Swarm app. */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { stringify } from 'yaml';
import { ROOT_DIR } from './infrastructure/paths.js';
import { loadApp } from './infrastructure/app-manifest.js';
import { diagramSources, digest } from './site-diagrams.js';
import { renderMonitor } from './presentation/monitoring/view.js';
import { monitorCss, monitorClient } from './presentation/monitoring/assets.js';
import { monitoringExamples } from './presentation/monitoring/example.js';

const root = resolve(ROOT_DIR, '..');
const source = join(root, 'website');
const output = join(root, 'apps', 'toad-landing');
mkdirSync(output, { recursive: true });
const pages = [
  ['UNDERSTAND', 'understand', 'Your app explained'],
  ['INFOMANIAK-EXAMPLE', 'infomaniak', 'Infomaniak example'],
  ['QUICKSTART', 'quickstart', 'Get started'], ['CLOUD-ACCOUNT', 'account', 'Account and access'],
  ['DEPLOYMENT', 'deployment', 'Cloud setup'],
  ['FIRST-APP', 'first-app', 'Deploy an app'], ['OBSERVABILITY', 'observability', 'Understand operations'],
  ['ARCHITECTURE', 'architecture', 'Visual architecture'],
  ['LOCAL-STARTER', 'local-starter', 'Optional local preview'], ['EVALUATION', 'evaluation', 'Heat experiment'],
  ['COSTS', 'costs', 'Cost worksheet'], ['OPERATIONS', 'operations', 'Operations'],
  ['DISASTER-RECOVERY', 'recovery', 'Recovery'], ['LAUNCH-READINESS', 'launch', 'Validation record'],
  ['BACKUP-AUTOMATION', 'backups', 'Offsite backup job'],
  ['RECOVERY-DRILL-PLAN', 'drill-plan', 'Proposed recovery drill'],
  ['AGENT-RUNBOOK', 'agents', 'Agent runbook'], ['STATEFUL-STORAGE', 'storage', 'Stateful storage'],
  ['../SECURITY', 'security', 'Security'], ['../LICENSE', 'license', 'License'],
] as const;
const diagramRecords = JSON.parse(readFileSync(join(source, 'diagrams.json'), 'utf8')) as Array<{
  file: string; sourceHash: string; svgHash: string; mobile?: { file: string; svgHash: string };
}>;
const diagrams = new Map<string, { file: string; description: string; mobile?: string; layout: string }>();
const diagramAssets: string[] = [];
const definitions = diagramSources();
if (diagramRecords.length !== definitions.length) throw new Error('Refresh the reviewed public diagram cache.');
for (const definition of definitions) {
  const record = diagramRecords.find((entry) => entry.file === definition.file);
  if (!record || record.sourceHash !== digest(definition.text)) throw new Error(`Stale diagram: ${definition.file}. Run site:diagrams.`);
  const expectedMobile = /^flowchart LR\b/m.test(definition.text) ? definition.file.replace('.svg', '-mobile.svg') : undefined;
  if (record.mobile?.file !== expectedMobile) throw new Error(`Invalid mobile layout: ${definition.file}.`);
  for (const asset of [{ file: definition.file, svgHash: record.svgHash }, ...(record.mobile ? [record.mobile] : [])]) {
    if (digest(readFileSync(join(source, asset.file))) !== asset.svgHash) throw new Error(`Changed diagram: ${asset.file}. Run site:diagrams.`);
    diagramAssets.push(asset.file);
  }
  function readableSize(file: string) {
    const viewBox = readFileSync(join(source, file), 'utf8').match(/viewBox="([^"]+)"/);
    const width = Number(viewBox?.[1]?.split(/\s+/)[2]);
    if (!Number.isFinite(width) || width <= 0 || width > 2000) throw new Error(`Review SVG dimensions: ${file}.`);
    return width <= 350 ? 0 : Math.ceil(width * .8 / 100) * 100;
  }
  const desktopSize = readableSize(definition.file);
  const mobileSize = readableSize(expectedMobile ?? definition.file);
  diagrams.set(record.sourceHash, { file: definition.file, description: definition.description,
    layout: `diagram-desktop-${desktopSize} diagram-mobile-${mobileSize}`, ...(expectedMobile ? { mobile: expectedMobile } : {}) });
}
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const pagePaths = new Map(pages.map(([name, slug]) => [resolve(root, 'docs', `${name}${name === '../LICENSE' ? '' : '.md'}`), `/${slug}.html`]));
const illustrations: Record<string, { desktopHeight: number; mobileHeight: number }> = {
  delivery: { desktopHeight: 258, mobileHeight: 864 }, platform: { desktopHeight: 318, mobileHeight: 890 },
  journey: { desktopHeight: 320, mobileHeight: 960 }, observability: { desktopHeight: 350, mobileHeight: 790 },
  'app-map': { desktopHeight: 470, mobileHeight: 1100 },
};
const lessonNames = ['visit', 'access', 'context', 'cloud', 'dns', 'release', 'evidence'] as const;
const lessons = new Map(lessonNames.map((name) => [name, readFileSync(join(source, 'lessons', `${name}.html`), 'utf8')]));
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
  const usedLessons = new Set<string>();
  renderer.html = ({ text }) => {
    if (!text.includes('TOAD_LESSON')) return escape(text);
    const lessonName = text.trim().match(/^<!-- TOAD_LESSON: ([a-z]+) -->$/)?.[1];
    const lesson = lessons.get(lessonName as typeof lessonNames[number]);
    // Only the two reviewed onboarding documents can embed these static fragments.
    if (!lessonName || !lesson || usedLessons.has(lessonName) || !['QUICKSTART', 'INFOMANIAK-EXAMPLE'].includes(name)) throw new Error(`Invalid or duplicate teaching diagram in ${path}.`);
    usedLessons.add(lessonName);
    return lesson;
  };
  const renderCode = renderer.code;
  renderer.code = function (token) {
    if (token.lang !== 'mermaid') return renderCode.call(this, token);
    const diagram = diagrams.get(digest(token.text.trim()));
    if (!diagram) throw new Error(`Unreviewed Mermaid diagram in ${name}.`);
    return `<figure class="doc-diagram ${diagram.layout}${token.text.startsWith('sequenceDiagram') ? ' sequence' : ''}"><div class="diagram-scroll" tabindex="0" role="region" aria-label="Diagram; scroll horizontally to explore"><picture>${diagram.mobile ? `<source media="(max-width:760px)" srcset="/${diagram.mobile}">` : ''}<img src="/${diagram.file}" alt="${escape(diagram.description)}" loading="lazy"></picture></div>${diagram.layout ? '<p class="diagram-hint">Scroll sideways to explore the diagram.</p>' : ''}<figcaption><span>${escape(diagram.description)}.</span><a href="/${diagram.file}">Open full size ↗</a></figcaption><details><summary>Diagram source</summary><pre><code>${escape(token.text)}</code></pre></details></figure>\n`;
  };
  renderer.image = ({ href: target, text: description }) => {
    const illustration = Object.keys(illustrations).find((asset) => target === `../website/${asset}.svg`);
    if (illustration) {
      const size = illustrations[illustration]!;
      return `<span class="illustration"><picture><source media="(max-width:760px)" srcset="/${illustration}-mobile.svg" width="360" height="${size.mobileHeight}"><img src="/${illustration}.svg" width="1120" height="${size.desktopHeight}" alt="${escape(description)}" loading="lazy"></picture></span>`;
    }
    return `<img src="${escape(href(target, `${name}.md`))}" alt="${escape(description)}" loading="lazy">`;
  };
  renderer.link = function ({ href: target, tokens }) { return `<a href="${escape(href(target, `${name}.md`))}">${this.parser.parseInline(tokens)}</a>`; };
  renderer.heading = function ({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const id = content.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
    return `<h${depth} id="${escape(id)}">${content}</h${depth}>\n`;
  };
  if (name === '../LICENSE') markdown = `# MIT License\n\n\`\`\`text\n${markdown}\n\`\`\`\n\n${readFileSync(join(root, 'LICENSING.md'), 'utf8').replace(/^(#{1,5}) /gm, '#$1 ')}`;
  const body = marked.parse(markdown, { renderer, gfm: true, async: false });
  const navigation = pages.map(([, target, title]) => `<a href="/${target}.html"${target === slug ? ' aria-current="page"' : ''}>${title}</a>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(label)} — TOAD</title><meta name="description" content="TOAD: ${escape(label)}. Deploy and operate apps on infrastructure you control."><link rel="canonical" href="https://toad.remigirard.dev/${slug}.html"><link rel="icon" href="/toad.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/diagrams.css">${usedLessons.size ? '<link rel="stylesheet" href="/lessons.css">' : ''}</head><body><a class="skip" href="#main">Skip to content</a><header class="header wrap"><a href="/" class="brand"><img src="/toad.svg" alt="" width="32" height="32">TOAD<span class="tag">DOCUMENTATION</span></a><nav aria-label="Main navigation"><a href="/">Project</a><a href="https://github.com/RemiGirard/TOAD-infra">Source ↗</a></nav></header><div class="docs-layout wrap"><nav class="doc-nav" aria-label="Documentation"><p>GET STARTED & OPERATE</p>${navigation}</nav><main id="main" class="doc-content"><div class="doc-meta"><span>TOAD / ${escape(label.toUpperCase())}</span><a href="https://github.com/RemiGirard/TOAD-infra/blob/main/${relative(root, path)}">Markdown source ↗</a></div>${body}</main></div><footer class="footer wrap"><a class="brand" href="/">TOAD</a><p>Your app. Your infrastructure.</p><div><a href="/security.html">Security</a><a href="/license.html">MIT</a></div></footer>${usedLessons.has('visit') ? '<script type="module" src="/lessons.mjs"></script>' : ''}</body></html>`;
  writeFileSync(join(output, `${slug}.html`), html);
}
const assets = ['index.html', 'style.css', 'app.mjs', 'toad.svg', 'starter.png', 'walkthrough.json', 'walkthrough.css',
  'diagrams.css', 'lessons.css', 'lessons.mjs', 'agent-view.mjs', 'agent-view.css', 'observability.svg', 'observability-mobile.svg', 'agent-guide.txt', 'journey.svg', 'journey-mobile.svg', 'delivery.svg', 'delivery-mobile.svg', 'platform.svg', 'platform-mobile.svg', ...diagramAssets, 'agent-prompt.txt', 'agent-health-prompt.txt', 'agent-debug-prompt.txt', 'learn.css', 'learn.mjs', 'app-map.svg', 'app-map-mobile.svg'];
for (const asset of assets) {
  if (!existsSync(join(source, asset))) throw new Error(`Missing reviewed website asset: ${asset}`);
  if (asset === 'index.html') {
    let html = readFileSync(join(source, asset), 'utf8');
    for (const [marker, file] of [['TOAD_AGENT_PROMPT', 'agent-prompt.txt'], ['TOAD_HEALTH_PROMPT', 'agent-health-prompt.txt'], ['TOAD_DEBUG_PROMPT', 'agent-debug-prompt.txt']] as const) {
      const slot = `<!-- ${marker} -->`;
      if (html.split(slot).length !== 2) throw new Error(`The homepage must contain exactly one ${marker} slot.`);
      html = html.replace(slot, () => escape(readFileSync(join(source, file), 'utf8').trim()));
    }
    const monitorSlot = '<!-- TOAD_MONITOR -->';
    if (html.split(monitorSlot).length !== 2) throw new Error('The homepage must contain one monitoring example slot.');
    const examples = monitoringExamples();
    const monitor = `<div data-monitor-examples><div class="monitor-scenarios" role="group" aria-label="Example monitoring state">${examples.map((example, index) => `<button type="button" data-monitor-scenario="${example.key}" aria-pressed="${index === 0}">${example.label}</button>`).join('')}</div>${examples.map((example, index) => `<div class="monitor-example" data-monitor-example="${example.key}"${index === 0 ? '' : ' hidden'}>${renderMonitor(example.data, { example: true, id: `example-${example.key}` })}</div>`).join('')}</div>`;
    html = html.replace(monitorSlot, () => monitor);
    writeFileSync(join(output, asset), html);
  } else copyFileSync(join(source, asset), join(output, asset));
}
const sharedAssets = { 'monitor.css': monitorCss, 'monitor.mjs': monitorClient };
for (const [file, contents] of Object.entries(sharedAssets)) writeFileSync(join(output, file), contents);
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
const files = [...assets, ...Object.keys(sharedAssets), ...pages.map(([, slug]) => `${slug}.html`), 'robots.txt', 'sitemap.xml', 'nginx.conf'];
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
console.log(`Built ${pages.length} documentation pages and ${assets.length + Object.keys(sharedAssets).length} public assets; validated toad-landing.`);
