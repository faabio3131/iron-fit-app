import fs from 'node:fs';

const api = fs.readFileSync('src/services/api.ts', 'utf8');
const auth = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
const navigator = fs.readFileSync('src/navigation/RootNavigator.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const trial = fs.readFileSync('src/web/TrialSignupScreen.tsx', 'utf8');
const workouts = fs.readFileSync('src/screens/WorkoutsScreen.tsx', 'utf8');
const schedules = fs.readFileSync('src/screens/SchedulesScreen.tsx', 'utf8');
const evolution = fs.readFileSync('src/screens/EvolutionScreen.tsx', 'utf8');
const financial = fs.readFileSync('src/screens/FinancialScreen.tsx', 'utf8');
const profile = fs.readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');

test('B6 Web and mobile share one authenticated API/session authority', () => {
  expect(api).toContain('API_URL');
  expect(api).toContain('getSession()');
  expect(api).toContain('Authorization: `Bearer ${current.accessToken}`');
  expect(api).toContain('/auth/refresh');
  expect(api).toContain('/auth/logout');
  expect(auth).toContain("api('/auth/me')");
  expect(auth).toContain('activeGymId');
  expect(auth).not.toMatch(/X-Tenant-ID|X-Gym-ID/);
  expect(api).not.toMatch(/X-Tenant-ID|X-Gym-ID/);
});

test('B6 routing preserves one app architecture while splitting role-appropriate surfaces', () => {
  expect(navigator).toMatch(/Platform\.OS === 'web'/);
  expect(navigator).toContain('<CommercialWebApp />');
  expect(navigator).toContain('<WebAuthEntry />');
  expect(navigator).toContain('<WorkoutsScreen />');
  expect(navigator).toContain("profile.roles.includes('STUDENT')");
});

test('B6 commercial Web consumes canonical backend domains and entitlement resolution', () => {
  for (const route of [
    '/commercial/onboarding',
    '/students',
    '/users',
    '/equipments/catalog',
    '/equipments/catalog/selection',
    '/assessments',
    '/workouts',
    '/schedule-slots',
    '/access/events',
    '/financial/charges',
    '/product-entitlements/tenant/current',
    '/product-entitlements/tenant/features',
  ]) {
    expect(web).toContain(route);
  }
  expect(web).toContain('equipment.inventory');
  expect(web).toContain('equipment.catalog');
  expect(web).toContain('FAIL_CLOSED_DEFAULT');
  expect(web).not.toMatch(/plan\s*===|planName\s*===/);
  expect(web).not.toMatch(/api\('\/equipments', undefined, \{ method: 'POST'/);
});

test('B6 Web operational mutations follow current security and EQ5 contracts', () => {
  expect(web).toContain('strongPassword(member.password)');
  expect(web).toContain('equipment-catalog-select');
  expect(web).toContain('catalogItemIds: [item.id]');
  expect(web).not.toContain('member.password.length < 6');
});

test('B6 student mobile surface reads the same canonical backend domain through /me routes', () => {
  expect(workouts).toContain("api('/me/workouts')");
  expect(schedules).toContain("api('/me/schedules')");
  expect(evolution).toContain("api('/me/assessments')");
  expect(financial).toContain("api('/me/charges')");
  expect(auth).toContain("api('/me/profile')");
  expect(profile).toContain('useAuth()');
});

test('B6 trial Web uses canonical public provisioning and never invents commercial authority', () => {
  expect(trial).toContain('/commercial/trial/start');
  expect(trial).toContain('requestId');
  expect(trial).toContain('strongPassword(password)');
  expect(trial).not.toMatch(/planCode|subscriptionId|entitlement|priceCode/);
});

test('B6 CI certifies mobile, Web artifacts and the production Web runtime', () => {
  expect(workflow).toContain('npm audit --audit-level=high');
  expect(workflow).toMatch(/expo export --platform android/);
  expect(workflow).toMatch(/expo export --platform web/);
  expect(workflow).toContain('docker build --pull');
  expect(workflow).toContain('Dockerfile.web');
  expect(workflow).toContain('Start Web container and verify health/static export');
  expect(workflow).toContain('curl -fsS http://127.0.0.1:18080/health');
});
