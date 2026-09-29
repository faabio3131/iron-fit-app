import fs from 'node:fs';

const navigator = fs.readFileSync('src/navigation/RootNavigator.tsx', 'utf8');
const auth = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
const login = fs.readFileSync('src/screens/LoginScreen.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const trial = fs.readFileSync('src/web/TrialSignupScreen.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');

test('web routing reuses canonical auth and preserves student mobile surface', () => {
  expect(navigator).toMatch(/Platform\.OS === 'web'/);
  expect(navigator).toMatch(/<CommercialWebApp \/>/);
  expect(navigator).toMatch(/<WebAuthEntry \/>/);
  expect(navigator).toMatch(/profile\.roles.*STUDENT|roles\) && profile\.roles\.includes\('STUDENT'\)/s);
  expect(auth).toMatch(/api\('\/auth\/me'\)/);
  expect(auth).toMatch(/api\('\/me\/profile'\)/);
});

test('public web trial calls only the canonical commercial provisioning endpoint', () => {
  expect(login).toMatch(/start-trial/);
  expect(trial).toMatch(/\/commercial\/trial\/start/);
  expect(trial).toMatch(/requestId/);
  expect(trial).toMatch(/auth: false/);
  expect(trial).not.toMatch(/planCode|price|amount|subscriptionId/);
});

test('commercial web derives tenant from session and never submits browser-selected gymId', () => {
  expect(web).toMatch(/activeTenantId/);
  expect(web).toContain('const { profile, activeTenantId, logout } = useAuth()');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/s);
  expect(web).not.toMatch(/localStorage|sessionStorage/);
});

test('commercial modules consume backend sources of truth and entitlement keys', () => {
  for (const route of [
    '/dashboard/summary',
    '/commercial/onboarding',
    '/students',
    '/users',
    '/equipments',
    '/exercises',
    '/assessments',
    '/workouts',
    '/schedule-slots',
    '/access/events',
    '/financial/charges',
    '/product-entitlements/tenant/features',
    '/creator-network/content/tenant/items',
    '/ai/workout-candidates',
  ]) {
    expect(web).toContain(route);
  }
  expect(web).toContain("equipment.inventory");
  expect(web).toContain("ai.workout_generation");
  expect(web).toContain("content.tenant_private");
  expect(web).not.toMatch(/plan\s*===|planName\s*===/);
});

test('web surface exposes fail-closed and human-review states', () => {
  expect(web).toMatch(/EXPIRED/);
  expect(web).toMatch(/SUSPENDED/);
  expect(web).toMatch(/FAIL_CLOSED_DEFAULT/);
  expect(web).toMatch(/PENDING_REVIEW/);
  expect(web).toMatch(/APPROVED/);
  expect(web).toMatch(/Seu perfil não possui permissão/);
});

test('CI certifies both Android and Web production exports', () => {
  expect(workflow).toMatch(/expo export --platform android/);
  expect(workflow).toMatch(/expo export --platform web/);
  expect(workflow).toMatch(/dist-web\/index\.html/);
  expect(workflow).toMatch(/stabilization\/\*\*/);
});
