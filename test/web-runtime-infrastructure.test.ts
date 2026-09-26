import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('B5 Web runtime exports the existing Expo app instead of creating a parallel frontend', async () => {
  const docker = await source('Dockerfile.web');
  assert.match(docker, /npx expo export --platform web --output-dir dist-web/);
  assert.match(docker, /ARG EXPO_PUBLIC_API_URL/);
  assert.match(docker, /CMD \["node", "scripts\/serve-web\.mjs"\]/);
});

test('B5 Web server has healthcheck, SPA fallback and no business API authority', async () => {
  const server = await source('scripts/serve-web.mjs');
  assert.match(server, /req\.url === '\/health'/);
  assert.match(server, /join\(root, 'index\.html'\)/);
  assert.match(server, /content-security-policy/);
  assert.equal(server.includes('/api/v1'), false);
  assert.equal(server.includes('fetch('), false);
});

test('B5 Web Railway config uses Docker and health gate', async () => {
  const cfg = await source('railway.web.toml');
  assert.match(cfg, /dockerfilePath = "Dockerfile\.web"/);
  assert.match(cfg, /healthcheckPath = "\/health"/);
  assert.match(cfg, /restartPolicyType = "ON_FAILURE"/);
});
