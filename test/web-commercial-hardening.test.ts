import fs from 'node:fs';

const storage = fs.readFileSync('src/storage/token-storage.ts', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const securityPanel = fs.readFileSync('src/components/AccountSecurityPanel.tsx', 'utf8');
const integrationsPanel = fs.readFileSync('src/components/IntegrationCredentialsPanel.tsx', 'utf8');
const billingPanel = fs.readFileSync('src/components/SaasBillingPanel.tsx', 'utf8');
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


test('interactive touch controls in critical Web surfaces have explicit handlers', () => {
  for (const source of [web, securityPanel, integrationsPanel, billingPanel]) {
    const touchables = source.match(/<TouchableOpacity\b/g) ?? [];
    const handlers = source.match(/\bonPress=/g) ?? [];
    expect(touchables.length).toBeGreaterThan(0);
    expect(handlers.length).toBeGreaterThanOrEqual(touchables.length);
    expect(source).not.toContain('onPress={() => undefined}');
  }
});

test('sensitive commercial surfaces remain narrowed by role in the Web shell', () => {
  expect(web).toContain("{ key: 'team', label: 'Equipe', icon: 'shield-checkmark-outline', roles: ['SUPER_ADMIN', 'OWNER'] }");
  expect(web).toContain("{ key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] }");
  expect(web).toContain("{ key: 'integrations', label: 'Integrações', icon: 'git-network-outline', roles: ['SUPER_ADMIN', 'OWNER'] }");
  expect(web).toContain("showFinancial={can('SUPER_ADMIN', 'OWNER')}");
  expect(web).toContain("canSeeFinancialDashboard ? api('/dashboard/revenue?days=30') : Promise.resolve(null)");
  expect(web).toContain('ADMINISTRAÇÃO RESTRITA');
  expect(web).toContain('Área restrita · Proprietário / Administrador');
  expect(web).toContain("roles: ['SUPER_ADMIN', 'OWNER']");
  expect(web).toContain("restrictedAdminModules: ModuleKey[] = ['financial', 'saasBilling', 'entitlements', 'integrations']");
  expect(web).toContain("api('/auth/step-up'");
  expect(web).toContain('Acesso administrativo protegido');
  expect(web).toContain('admin-step-up-submit');
});
