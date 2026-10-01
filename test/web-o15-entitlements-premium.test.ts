import fs from 'node:fs';

const workspace = fs.readFileSync('src/web/EntitlementsWorkspace.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O15 removes technical entitlement editor and uses the dedicated product workspace', () => {
  expect(web).toContain("import { EntitlementsWorkspace } from './EntitlementsWorkspace'");
  expect(web).toContain('<EntitlementsWorkspace');
  expect(web).not.toContain('configDraft');
  expect(web).not.toContain('Regras separadas por vírgula');
  expect(workspace).toContain('PLANO E CONFIGURAÇÕES');
  expect(workspace).toContain('Hierarquia de autoridade');
  expect(workspace).toContain('Seu plano permite');
  expect(workspace).toContain('Configuração efetiva');
});

test('O15 browser mutations preserve server tenant authority and only send configuration payloads', () => {
  const start = web.indexOf('function entitlementsView()');
  const end = web.indexOf('function creatorView()', start);
  const section = web.slice(start, end);

  expect(section).toContain('/product-entitlements/tenant/configurations/');
  expect(section).toContain("method: 'PUT'");
  expect(section).toContain("method: 'DELETE'");
  expect(section).not.toMatch(/gymId|tenantId|planCode|version:/);
});

test('O15 UI never offers direct feature enablement beyond the plan', () => {
  expect(workspace).toContain("featureEnabled: false");
  expect(workspace).not.toContain("featureEnabled: true");
  expect(workspace).toContain('parsedLimit <= planValue');
  expect(workspace).toContain('planPolicyValues');
});
