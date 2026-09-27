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
  expect(panel).toContain('Senha atual — step-up');
});

test('C6 Web never lets the browser choose tenant authority', () => {
  expect(panel).not.toMatch(/gymId|tenantId/);
  expect(panel).toContain('/integrations/connections');
  expect(web).toContain('Tenant derivado da sessão autenticada');
});

test('C6 Web derives provider/auth/capabilities/environment from backend catalog rather than hardcoding vendors', () => {
  expect(panel).toContain('catalog?.providers');
  expect(panel).toContain('catalog?.environment');
  expect(panel).toContain('selectedProvider.authModels');
  expect(panel).toContain('selectedProvider.capabilities');
  for (const vendor of ['MERCADO_PAGO', 'PAGBANK', 'ASAAS', 'TOTALPASS', 'WELLHUB']) {
    expect(panel).not.toContain(vendor);
  }
});
