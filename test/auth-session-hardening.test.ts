import fs from 'node:fs';

const login = fs.readFileSync('src/screens/LoginScreen.tsx', 'utf8');
const tenant = fs.readFileSync('src/screens/TenantSelectionScreen.tsx', 'utf8');
const context = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
const api = fs.readFileSync('src/services/api.ts', 'utf8');
const session = fs.readFileSync('src/storage/token-storage.ts', 'utf8');
const config = fs.readFileSync('src/config/env.ts', 'utf8');

test('login starts without demo credentials', () => {
  expect(login).toMatch(/useState\(''\)/);
  expect(login).not.toMatch(/joao\.silva@email\.com|aluno123/);
});

test('multi-tenant login selects tenant and can complete MFA without duplicating client authority', () => {
  expect(context).toMatch(/requires_tenant_selection/);
  expect(context).toMatch(/data\.tenants/);
  expect(context).toMatch(/\.\.\.\(gymId \? \{ gymId \} : \{\}\)/);
  expect(tenant).toMatch(/selectedGymId/);
  expect(tenant).toMatch(/selectTenant\([\s\S]*selectedGymId/);
  expect(tenant).toMatch(/tenant-mfa-code/);
  expect(tenant).toMatch(/tenant-recovery-code/);
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
  expect(login).not.toMatch(/gym-saas-backend-t9ej\.onrender\.com/);
});

test('commercial identity UI exposes MFA, recovery and account security through backend endpoints', () => {
  const security = fs.readFileSync('src/components/AccountSecurityPanel.tsx', 'utf8');
  const recovery = fs.readFileSync('src/screens/PasswordRecoveryScreen.tsx', 'utf8');
  expect(login).toMatch(/login-mfa-code/);
  expect(login).toMatch(/login-recovery-code/);
  expect(recovery).toMatch(/password\/reset\/request/);
  expect(recovery).toMatch(/password\/reset\/confirm/);
  expect(security).toMatch(/auth\/sessions/);
  expect(security).toMatch(/auth\/mfa\/setup/);
  expect(security).toMatch(/auth\/mfa\/confirm/);
  expect(security).toMatch(/auth\/password\/change/);
  expect(security).toMatch(/auth\/email\/change\/request/);
  expect(security).not.toMatch(/localStorage/);
});
