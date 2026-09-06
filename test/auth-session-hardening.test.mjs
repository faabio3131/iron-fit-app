import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('App.tsx', 'utf8');
const api = fs.readFileSync('src/api.ts', 'utf8');
const session = fs.readFileSync('src/auth-session.ts', 'utf8');
const config = fs.readFileSync('src/config.ts', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('login starts without demo credentials', () => {
  assert.doesNotMatch(app, /joao\.silva@email\.com|aluno123/);
  assert.match(app, /useState\(''\)/);
});

test('multi-tenant login selects tenant and resubmits gymId', () => {
  assert.match(app, /requires_tenant_selection/);
  assert.match(app, /data\.tenants/);
  assert.match(app, /gymId: selectedGymId/);
  assert.match(app, /Escolha sua unidade/);
});

test('mobile session persists both access and refresh tokens in SecureStore', () => {
  assert.match(session, /expo-secure-store/);
  assert.match(session, /accessToken: string/);
  assert.match(session, /refreshToken: string/);
  assert.match(session, /SecureStore\.setItemAsync/);
  assert.equal(pkg.dependencies['expo-secure-store'], '~57.0.3');
});

test('401 path rotates refresh token once and retries the original request', () => {
  assert.match(api, /response\.status === 401/);
  assert.match(api, /\/auth\/refresh/);
  assert.match(api, /refreshInFlight/);
  assert.match(api, /retryOnUnauthorized: false/);
  assert.match(api, /payload\.refresh_token/);
});

test('logout revokes refresh session at backend before local cleanup', () => {
  assert.match(api, /\/auth\/logout/);
  assert.match(api, /JSON\.stringify\(\{ refreshToken: current\.refreshToken \}\)/);
  assert.match(api, /finally \{[\s\S]*invalidateSession/);
});

test('backend URL is centralized in EXPO_PUBLIC_API_URL and production URL is not hardcoded', () => {
  assert.match(config, /EXPO_PUBLIC_API_URL/);
  assert.match(envExample, /EXPO_PUBLIC_API_URL=/);
  assert.doesNotMatch(app + config + api, /gym-saas-backend-t9ej\.onrender\.com/);
});
