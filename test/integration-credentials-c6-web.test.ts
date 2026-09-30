import fs from 'node:fs';

const panel = fs.readFileSync(
  'src/components/IntegrationCredentialsPanel.tsx',
  'utf8',
);
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('C6 Web exposes OWNER-only integration administration surface', () => {
  expect(web).toContain("key: 'integrations'");
  expect(web).toContain("roles: ['OWNER']");
  expect(web).toContain('<IntegrationCredentialsPanel />');
  expect(panel).toContain("api('/integrations/providers')");
  expect(panel).toContain("api('/integrations/connections')");
});

test('C6 Web treats secret inputs as write-only and never persists them in browser storage', () => {
  expect(panel).toContain('secureTextEntry');
  expect(panel).toContain('integration-create-secret');
  expect(panel).toContain('integration-rotate-secret');
  expect(panel).not.toMatch(/localStorage|sessionStorage/);
  expect(panel).not.toMatch(/secretReference/);
  expect(panel).not.toMatch(/setItem\([^)]*secret/i);
  expect(panel).toContain("setSecret('')");
  expect(panel).toContain("setReplacementSecret('')");
});

test('C7 Web requires step-up material for credential mutations', () => {
  expect(panel).toContain('currentPassword');
  expect(panel).toContain('mfaCode');
  expect(panel).toContain('recoveryCode');
  expect(panel).toContain('integration-action-confirm');
  expect(panel).toContain('Senha atual — reautenticação');
});

test('C6 Web never lets the browser choose tenant authority', () => {
  expect(panel).not.toMatch(/gymId|tenantId/);
  expect(panel).toContain('/integrations/connections');
  expect(web).toContain('const { profile, activeTenantId, logout } = useAuth()');
});

test('C6 Web derives provider/auth/capabilities from backend catalog and treats environment as server authority', () => {
  expect(panel).toContain('catalog?.providers');
  expect(panel).toContain('catalog?.environment');
  expect(panel).toContain('selectedProvider.authModels');
  expect(panel).toContain('selectedProvider.capabilities');
  expect(panel).toContain('tenantEntitlementFeatureKey');
  expect(panel).toContain('Definido pelo servidor');
  expect(panel).not.toMatch(/providerCode: selectedProvider\.providerCode,\s*environment,/);
  for (const vendor of ['MERCADO_PAGO', 'PAGBANK', 'ASAAS', 'TOTALPASS', 'WELLHUB']) {
    expect(panel).not.toContain(vendor);
  }
});

test('C6 Web exposes separate replace, rotate, provider-test and revoke actions', () => {
  expect(panel).toContain("beginAction(connection.id, 'replace')");
  expect(panel).toContain("beginAction(connection.id, 'rotate')");
  expect(panel).toContain("beginAction(connection.id, 'verify')");
  expect(panel).toContain("beginAction(connection.id, 'revoke')");
  expect(panel).toContain('Testar provedor');
  expect(panel).not.toContain('Testar cofre');
});
