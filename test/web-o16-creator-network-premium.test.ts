import fs from 'node:fs';

const workspace = fs.readFileSync('src/web/CreatorNetworkWorkspace.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O16 Creator Network uses dedicated product UI instead of generic raw records', () => {
  expect(workspace).toContain('CREATOR NETWORK');
  expect(workspace).toContain('Conteúdo autorizado');
  expect(workspace).toContain('Utilização');
  expect(workspace).toContain('Engajamento');
  expect(web).toContain('<CreatorNetworkWorkspace');
  expect(web).not.toContain('Resumo operacional da rede de criadores.');
});

test('O16 keeps IRON managed and tenant private content fail-closed by entitlement', () => {
  expect(workspace).toContain("if (relation === 'TENANT_OWNED') return tenantPrivateEnabled");
  expect(workspace).toContain("if (relation === 'IRON_OWNED' || relation === 'LICENSED_CONTENT')");
  expect(workspace).toContain('return ironManagedEnabled');
  expect(web).toContain("ironManagedEnabled={enabled('content.iron_managed')}");
  expect(web).toContain("tenantPrivateEnabled={enabled('content.tenant_private')}");
  expect(web).toContain("externalYoutubeEnabled={enabled('content.external_youtube')}");
});

test('O16 does not expose internal governance consoles in tenant surface', () => {
  expect(workspace).not.toMatch(/settlement|ingestion|rightsGrantId|evidenceSha256|fingerprint/i);
  expect(workspace).not.toContain('JSON.stringify');
});
