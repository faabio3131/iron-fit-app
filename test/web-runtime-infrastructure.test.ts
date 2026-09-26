import { readFile } from 'node:fs/promises';

const source = (path: string) => readFile(path, 'utf8');

test('B5 Web runtime exports the existing Expo app instead of creating a parallel frontend', async () => {
  const docker = await source('Dockerfile.web');
  expect(docker).toMatch(/npx expo export --platform web --output-dir dist-web/);
  expect(docker).toMatch(/ARG EXPO_PUBLIC_API_URL/);
  expect(docker).toMatch(/CMD \["node", "scripts\/serve-web\.mjs"\]/);
});

test('B5 Web server has healthcheck, SPA fallback and no business API authority', async () => {
  const server = await source('scripts/serve-web.mjs');
  expect(server).toMatch(/req\.url === '\/health'/);
  expect(server).toMatch(/join\(root, 'index\.html'\)/);
  expect(server).toMatch(/content-security-policy/);
  expect(server).not.toContain('/api/v1');
  expect(server).not.toContain('fetch(');
});

test('B5 Web Railway config uses Docker and health gate', async () => {
  const cfg = await source('railway.toml');
  expect(cfg).toMatch(/dockerfilePath = "Dockerfile\.web"/);
  expect(cfg).toMatch(/healthcheckPath = "\/health"/);
  expect(cfg).toMatch(/restartPolicyType = "ON_FAILURE"/);
});
