import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../apps/toad-landing/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer((request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || !statSync(file).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? '' : readFileSync(file));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT ?? 48173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${process.env.PORT ?? 48173}`));
