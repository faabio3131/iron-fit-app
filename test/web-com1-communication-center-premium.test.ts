import fs from 'node:fs';

const center = fs.readFileSync('src/web/CommunicationCenter.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('COM-1 exposes Communication Center only to backend-authorized operational roles', () => {
  expect(web).toContain("{ key: 'communication', label: 'Comunicação'");
  expect(web).toContain("roles: operational");
  expect(web).toContain("<CommunicationCenter");
  expect(web).toContain("canManageAutomations={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}");
  expect(web).toContain("canInspectIntegrations={can('SUPER_ADMIN', 'OWNER')}");
});

test('COM-1 presents only the externally implemented WhatsApp dispatch channel', () => {
  expect(center).toContain("channel: 'WHATSAPP'");
  expect(center).toContain('Modelos desta V1 são específicos de WhatsApp');
  expect(center).not.toContain("channel: 'SMS'");
  expect(center).not.toContain("channel: 'EMAIL'");
  expect(center).not.toContain("channel: 'PUSH'");
});

test('COM-1 keeps tenant/provider authority and advanced automation JSON out of browser payloads', () => {
  expect(center).not.toMatch(/gymId|tenantId|secretReference|accessToken|credential:/);
  expect(center).not.toContain('JSON.parse');
  expect(center).toContain('A criação avançada permanece oculta');
  expect(center).toContain('selectedStudent?.consentComm !== true');
});
