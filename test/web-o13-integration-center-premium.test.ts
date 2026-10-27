import fs from 'node:fs';

const panel = fs.readFileSync('src/components/IntegrationCredentialsPanel.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O13 Integration Center removes raw JSON and translates the commercial surface', () => {
  expect(panel).toContain('INTEGRATION CENTER');
  expect(panel).toContain('Cofre IRON');
  expect(panel).toContain('Configuração pública');
  expect(panel).toContain('Adicionar campo público');
  expect(panel).not.toContain('Configuração pública (JSON)');
  expect(panel).not.toContain('JSON.parse(publicConfiguration');
  expect(panel).toContain('providerLabel');
  expect(panel).toContain('capabilityLabel');
  expect(panel).toContain('authModelLabels');
  expect(panel).toContain('environmentLabels');
});

test('O13 OAuth is OWNER-scoped in Web and delegates tenant, scopes and callback authority to backend', () => {
  expect(web).toContain("<IntegrationCredentialsPanel canStartOAuth={can('OWNER')} />");
  expect(panel).toContain('canStartOAuth');
  expect(panel).toContain('/integrations/oauth/');
  expect(panel).toContain('API_URL');
  expect(panel).toContain('capabilities');
  expect(panel).not.toMatch(/gymId|tenantId/);
  expect(panel).not.toContain('scope:');
});

test('O13 never exposes vault references or stores secrets in browser persistence', () => {
  expect(panel).not.toMatch(/secretReference/);
  expect(panel).not.toMatch(/localStorage|sessionStorage/);
  expect(panel).toContain('secureTextEntry');
  expect(panel).toContain("setSecret('')");
  expect(panel).toContain("setReplacementSecret('')");
  expect(panel).toContain('Protegida no Cofre IRON');
});

test('O13 OAuth connections cannot be manually replaced or rotated from the tenant UI', () => {
  expect(panel).toContain("connection.authModel !== 'OAUTH2'");
  expect(panel).toContain("beginAction(connection.id, 'verify')");
  expect(panel).toContain("beginAction(connection.id, 'revoke')");
});
