import fs from 'node:fs';

const fiscal = fs.readFileSync('src/web/FiscalCenter.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('FISCAL-1 is OWNER/SUPER_ADMIN-only and uses the existing administrative step-up gate', () => {
  expect(web).toContain("{ key: 'fiscal', label: 'Fiscal / NFS-e'");
  expect(web).toContain("roles: ['SUPER_ADMIN', 'OWNER']");
  expect(web).toContain("'financial', 'fiscal', 'saasBilling'");
  expect(web).toContain("if (active === 'fiscal') return <FiscalCenter />");
});

test('FISCAL-1 uses canonical fiscal APIs without browser tenant/provider authority', () => {
  expect(fiscal).toContain("api('/financial/fiscal/scope-binding'");
  expect(fiscal).toContain("'/financial/fiscal/handoffs'");
  expect(fiscal).toContain("'/cancel'");
  expect(fiscal).not.toMatch(/gymId|providerAccessKey|providerProtocolReference|idempotencyKey|bridgeConnectionId/);
});

test('FISCAL-1 does not promise external homologation or expose a fake issuance action', () => {
  expect(fiscal).toContain('Homologação externa pendente');
  expect(fiscal).toContain('Provider, município, credencial e emissão real exigem evidência oficial');
  expect(fiscal).not.toContain('Emitir NFS-e');
  expect(fiscal).not.toContain('Emitir nota');
  expect(fiscal).toContain("['AUTHORIZED', 'RECONCILED'].includes(handoff.status)");
});
