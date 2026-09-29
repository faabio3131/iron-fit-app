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
  expect(web).toContain('Seu acesso operacional está limitado.');
});

test('CI keeps dependency high-severity audit and production exports', () => {
  expect(workflow).toContain('npm audit --audit-level=high');
  expect(workflow).toMatch(/expo export --platform android/);
  expect(workflow).toMatch(/expo export --platform web/);
});
