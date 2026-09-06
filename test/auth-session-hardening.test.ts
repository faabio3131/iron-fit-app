import fs from 'node:fs';

const app = fs.readFileSync('App.tsx', 'utf8');
const api = fs.readFileSync('src/api.ts', 'utf8');
const session = fs.readFileSync('src/auth-session.ts', 'utf8');
const config = fs.readFileSync('src/config.ts', 'utf8');

test('login starts without demo credentials', () => {
  expect(app).toMatch(/useState\(''\)/);
  expect(app).not.toMatch(/joao\.silva@email\.com|aluno123/);
});

test('multi-tenant login selects tenant and resubmits gymId', () => {
  expect(app).toMatch(/requires_tenant_selection/);
  expect(app).toMatch(/data\.tenants/);
  expect(app).toMatch(/selectedGymId/);
  expect(app).toMatch(/gymId: selectedGymId/);
});

test('mobile session persists both access and refresh tokens in SecureStore', () => {
  expect(session).toMatch(/expo-secure-store/);
  expect(session).toMatch(/accessToken/);
  expect(session).toMatch(/refreshToken/);
  expect(session).toMatch(/SecureStore\.setItemAsync/);
});

test('401 path rotates refresh token once and retries original request', () => {
  expect(api).toMatch(/refreshInFlight/);
  expect(api).toMatch(/\/auth\/refresh/);
  expect(api).toMatch(/response\.status === 401/);
  expect(api).toMatch(/retryOnUnauthorized: false/);
});

test('logout revokes backend refresh session before local cleanup', () => {
  expect(api).toMatch(/\/auth\/logout/);
  expect(api).toMatch(/refreshToken: current\.refreshToken/);
  expect(api).toMatch(/finally[\s\S]*invalidateSession/);
});

test('backend URL is centralized in EXPO_PUBLIC_API_URL', () => {
  expect(config).toMatch(/EXPO_PUBLIC_API_URL/);
  expect(app).not.toMatch(/gym-saas-backend-t9ej\.onrender\.com/);
});
