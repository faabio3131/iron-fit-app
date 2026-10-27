import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const financial = fs.readFileSync('src/web/FinancialWorkspace.tsx', 'utf8');

test('O11 Web loads the canonical academy finance read models behind the protected module', () => {
  expect(web).toContain("import { FinancialWorkspace } from './FinancialWorkspace';");
  expect(web).toContain("api('/financial/accounts')");
  expect(web).toContain("api('/financial/charges')");
  expect(web).toContain("api('/financial/subscriptions', undefined, {");
  // These read models belong to FinancialWorkspace, but it is not yet mounted.
  // O11 visual parity stays pending; never certify unrendered functionality.
  expect(financial).toContain("transactions: any[];");
  expect(financial).toContain("overdueCharges: any[];");
  expect(web).toContain('function financialView()');
  expect(web).toMatch(/const restrictedAdminModules: ModuleKey\[\] = \[[^\]]*\x27financial\x27/);
  expect(web).toContain("if (isRestrictedAdminModule(active) && !adminStepUpActive) return adminGateView()");
  expect(web).toContain("{ key: 'financial', label: 'Financeiro'");
  expect(web).toContain("roles: ['SUPER_ADMIN', 'OWNER']");
});

test('O11 Financeiro Academia is a domain workspace with delinquency, payments, plans, history and accounts', () => {
  for (const marker of [
    'Financeiro da academia',
    'Inadimplência',
    'Cobranças',
    'Planos dos alunos',
    'Histórico financeiro',
    'Contas financeiras',
    'Registrar pagamento',
    'financial-create-charge',
    'financial-create-subscription',
    'financial-create-account',
    'financial-pay-',
  ]) {
    expect(financial).toContain(marker);
  }
});

test('O11 keeps academy finance separate from IRON billing and frontend never expands tenant authority', () => {
  expect(financial).toContain('permanece separado da Assinatura IRON');
  expect(financial).not.toContain('gymId');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
  expect(web).toContain("if (active === 'financial') return financialView()");
  expect(web).toContain("if (active === 'saasBilling') return <SaasBillingPanel");
  expect(web).toContain("if (isRestrictedAdminModule(active) && !adminStepUpActive) return adminGateView()");
});
