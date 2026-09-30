import fs from 'node:fs';

const storage = fs.readFileSync('src/storage/token-storage.ts', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');

test('Web auth survives reload only for the browser session and never uses localStorage', () => {
  expect(storage).toContain('sessionStorage');
  expect(storage).toContain('SESSION_STORAGE_KEY');
  expect(storage).not.toContain('localStorage');
  expect(storage).toMatch(/Platform\.OS !== 'web'/);
});

test('commercial shell does not hide authority failures and blocks invalid commercial state', () => {
  expect(web).toContain("api('/product-entitlements/tenant/features')");
  expect(web).toContain("api('/product-entitlements/tenant/current')");
  expect(web).toContain("api('/commercial/trial/status')");
  expect(web).not.toMatch(/product-entitlements\/tenant\/features'\)\.catch/);
  expect(web).not.toMatch(/commercial\/trial\/status'\)\.catch/);
  expect(web).toContain("!subscription || trial?.status === 'EXPIRED'");
  expect(web).toContain('subscription-blocked');
  expect(web).toContain('A superfície operacional permanece fail-closed');
});

test('CI keeps dependency high-severity audit and production exports', () => {
  expect(workflow).toContain('npm audit --audit-level=high');
  expect(workflow).toMatch(/expo export --platform android/);
  expect(workflow).toMatch(/expo export --platform web/);
});


test('restricted administration is owner-only and requires session step-up', () => {
  expect(web).toContain("restrictedAdminModules: ModuleKey[] = ['financial', 'saasBilling', 'entitlements', 'integrations']");
  expect(web).toContain("{ key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] }");
  expect(web).toContain("{ key: 'saasBilling', label: 'Assinatura IRON', icon: 'card-outline', roles: ['SUPER_ADMIN', 'OWNER'] }");
  expect(web).toContain("api('/auth/step-up/status')");
  expect(web).toContain("api('/auth/step-up'");
  expect(web).toContain('Acesso administrativo protegido');
  expect(web).toContain('admin-step-up-submit');
  expect(web).toContain("can('SUPER_ADMIN', 'OWNER') && adminStepUpActive");
});
