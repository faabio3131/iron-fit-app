import fs from 'node:fs';

const privacy = fs.readFileSync('src/web/PrivacyCenter.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O18 Privacy Center is a real self-service surface and remains available under commercial block', () => {
  expect(web).toContain("{ key: 'privacy', label: 'Privacidade'");
  expect(web).toContain("item.key === 'privacy'");
  expect(web).toContain("<PrivacyCenter canOperatePrivacy={can('SUPER_ADMIN')} />");
  expect(privacy).toContain('/privacy/dsr');
  expect(privacy).toContain('/privacy/legal-documents');
  expect(privacy).toContain('/privacy/legal-acceptances');
});

test('O18 keeps sensitive governance SUPER_ADMIN-only and does not invent legal approval', () => {
  expect(privacy).toContain('canOperatePrivacy');
  expect(privacy).toContain('/privacy/operations/dsr');
  expect(privacy).toContain('/privacy/operations/governance');
  expect(privacy).toContain('Área exclusiva de SUPER_ADMIN');
  expect(privacy).toContain('Aprovação jurídica continua externa ao software.');
  expect(privacy).toContain('Nenhum prazo legal é inventado pela interface.');
});

test('O18 does not create a generic consent contract that backend does not expose', () => {
  expect(privacy).not.toMatch(/\/privacy\/consents/);
  expect(privacy).not.toContain('consentHealth');
  expect(privacy).not.toContain('consentComm');
  expect(privacy).not.toContain('consentBiometry');
});
