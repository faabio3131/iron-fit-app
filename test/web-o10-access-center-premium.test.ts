import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const access = fs.readFileSync('src/web/AccessCenterWorkspace.tsx', 'utf8');

test('O10 Web loads canonical Access Center read models with role-aware devices', () => {
  expect(web).toContain("import { AccessCenterWorkspace } from './AccessCenterWorkspace';");
  expect(web).toContain("api('/access/events')");
  expect(web).toContain("api('/access/credentials')");
  expect(web).toContain("api('/access/devices')");
  expect(web).toContain("can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? api('/access/devices')");
  expect(web).toContain('credentials={list(data.credentials)}');
  expect(web).toContain('events={list(data.events)}');
  expect(web).toContain('devices={list(data.devices)}');
});

test('O10 Access Center exposes credentials, decisions, timeline, revocation and governed devices', () => {
  for (const marker of [
    'Credenciais',
    'Emitir credencial',
    'Timeline de acessos',
    'Permitidos',
    'Negados',
    'Revogar credencial',
    'Dispositivos de acesso',
    'Rotacionar token',
    'EXIBIÇÃO ÚNICA',
    'access-credential-create',
    'access-credential-revoke-',
    'access-device-rotate-',
  ]) {
    expect(access).toContain(marker);
  }
});

test('O10 Web preserves backend authority and never sends tenant or secret hashes', () => {
  expect(access).not.toContain('gymId');
  expect(access).not.toContain('tokenHash');
  expect(access).not.toContain('biometricHash');
  expect(access).not.toContain('deviceTokenHash');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
  expect(web).toContain("canManageDevices={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}");
  expect(web).toContain("method: 'PATCH'");
  expect(web).toContain('/revoke');
});
