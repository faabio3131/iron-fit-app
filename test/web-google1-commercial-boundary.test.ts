import fs from 'node:fs';

const panel = fs.readFileSync('src/components/IntegrationCredentialsPanel.tsx', 'utf8');
const boundary = fs.readFileSync('docs/GOOGLE1_GOOGLE_COMMERCIAL_BOUNDARY.md', 'utf8');

test('GOOGLE-1 fail-closes generic google.oauth from the V1 tenant connection surface', () => {
  expect(panel).toContain("if (provider.providerCode === 'google')");
  expect(panel).toContain('return []');
  expect(panel).toContain('commercialProviders(catalogProviders)');
  expect(boundary).toContain('GOVERNANCE CONFLICT');
  expect(boundary).toContain('channel.google = LAUNCH');
  expect(boundary).toContain('não altera silenciosamente');
});

test('GOOGLE-1 does not invent a Google business feature', () => {
  for (const invented of ['Google Calendar', 'Gmail', 'Google Drive']) {
    expect(panel).not.toContain(invented);
  }
  expect(boundary).toContain('não identificou um consumidor comercial');
});
