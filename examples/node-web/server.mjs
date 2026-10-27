import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const started = Date.now();
const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['public/app.mjs', 'text/javascript; charset=utf-8']],
]);
const token = process.env.API_TOKEN_FILE ? readFileSync(process.env.API_TOKEN_FILE, 'utf8').trim() : '';
const server = createServer((request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  let path;
  try { path = new URL(request.url ?? '/', 'http://localhost').pathname; }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }).end(); return; }
  if (path === '/api/health' || path === '/api/info' || path === '/api/private') {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    if (path === '/api/private') {
      const supplied = Buffer.from((request.headers.authorization ?? '').replace(/^Bearer /, ''));
      const expected = Buffer.from(token);
      if (!token || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        response.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' })); return;
      }
      response.end(JSON.stringify({ authenticated: true })); return;
    }
    response.end(JSON.stringify(path === '/api/health' ? { ok: true } : {
      message: process.env.APP_MESSAGE ?? 'Your app. Your infrastructure.',
      version: process.env.APP_VERSION ?? '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - started) / 1000),
      runtime: `Node.js ${process.versions.node}`,
    }));
    return;
  }
  const asset = assets.get(path);
  if (!asset) { response.writeHead(404).end('Not found'); return; }
  response.setHeader('Content-Type', asset[1]);
  response.end(readFileSync(fileURLToPath(new URL(asset[0], import.meta.url))));
});
server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0', () => {
  console.log(`TOAD starter listening on port ${Number(process.env.PORT ?? 3000)}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
