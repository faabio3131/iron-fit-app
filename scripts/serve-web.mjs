import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist-web');
const port = Number(process.env.PORT ?? '3000');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const canonical = decoded.replaceAll('\\\\', '/');
  const segments = canonical.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) return null;
  return segments.join('/');
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url?.startsWith('/health?')) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ status: 'ok', service: 'iron-fit-web' }));
    return;
  }

  const relative = safePath(req.url);
  if (relative === null) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  let candidate = join(root, relative || 'index.html');

  if (!candidate.startsWith(root)) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    candidate = join(root, 'index.html');
  }

  const type = mime[extname(candidate)] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:;",
  });
  createReadStream(candidate).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(JSON.stringify({ event: 'web_started', port }) + '\n');
});
