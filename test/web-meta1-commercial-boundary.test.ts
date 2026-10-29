import fs from 'node:fs';

const integrations = fs.readFileSync('src/components/IntegrationCredentialsPanel.tsx', 'utf8');
const communication = fs.readFileSync('src/web/CommunicationCenter.tsx', 'utf8');
const doc = fs.readFileSync('docs/META1_META_COMMERCIAL_BOUNDARY.md', 'utf8');

test('META-1 exposes only WhatsApp as Meta commercial capability in V1', () => {
  expect(integrations).toContain("provider.providerCode === 'meta'");
  expect(integrations).toContain("capability === 'meta.whatsapp'");
  expect(communication).toContain("channel: 'WHATSAPP'");
  expect(communication).not.toContain("channel: 'SMS'");
  expect(communication).not.toContain("channel: 'EMAIL'");
});

test('META-1 preserves OAuth least privilege and tenant authority in backend', () => {
  expect(integrations).toContain('commercialCapabilities(selectedProvider)');
  expect(integrations).not.toMatch(/gymId|tenantId/);
  expect(integrations).not.toContain('scope:');
});

test('META-1 documents external homologation honestly', () => {
  expect(doc).toContain('IMPLEMENTED / EXTERNAL BLOCKER');
  expect(doc).toContain('Meta App oficial');
  expect(doc).toContain('OAuth real');
  expect(doc).not.toContain('PRODUCTION HOMOLOGATED — PASS');
});
