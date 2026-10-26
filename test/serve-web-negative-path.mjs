import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverScript = fileURLToPath(new URL('../scripts/serve-web.mjs', import.meta.url));

async function reserveEphemeralPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function rawRequest(port, path) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET', timeout: 2000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Web service did not respond')));
    req.end();
  });
}

test('real IRON Web server rejects malformed percent encoding and traversal without process termination', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'iron-web-static-security-'));
  const port = await reserveEphemeralPort();
  await mkdir(join(cwd, 'dist-web'));
  await writeFile(join(cwd, 'dist-web/index.html'), '<!DOCTYPE html><title>IRON</title>');
  const proc = spawn(process.execPath, [serverScript], {
    cwd, env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (proc.exitCode !== null) throw new Error('Web runtime terminated before health check');
      try {
        const health = await rawRequest(port, '/health');
        if (health.status === 200) { ready = true; break; }
      } catch { /* not yet listening */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'Web runtime failed readiness');

    for (const path of ['/%', '/%ZZ', '/%E0%A4%A', '/%C3%28', '/%2e%2e/%2e%2e/etc/passwd']) {
      const response = await rawRequest(port, path);
      assert.equal(response.status, 400, `Unexpected static-server response for ${path}`);
      assert.equal(proc.exitCode, null, `Malformed request killed IRON server: ${path}`);
    }

    const after = await rawRequest(port, '/health');
    assert.equal(after.status, 200, 'Web must remain healthy after malicious paths');
    const homepage = await rawRequest(port, '/');
    assert.equal(homepage.status, 200);
    assert.ok(homepage.body.includes('IRON'));
    console.log(JSON.stringify({ event: 'iron_web_static_runtime_path_security',
      invalidEncodingBlocked: true, traversalBlocked: true, processSurvived: true }));
  } finally {
    proc.kill('SIGTERM');
    await rm(cwd, { recursive: true, force: true });
  }
}, { timeout: 15000 });
