import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const webSource = (name: string) =>
  readFileSync(join(process.cwd(), 'src', 'web', name), 'utf8');

test('public trial entry uses customer-ready Brazilian Portuguese instead of backend/internal terminology', () => {
  const source = webSource('TrialSignupScreen.tsx');
  expect(source).toContain('Iniciar período gratuito');
  expect(source).toContain('Sua academia e seu acesso de proprietário');
  expect(source).not.toMatch(/Criar trial|Billing SaaS pertence ao bloco|O tenant, o OWNER/);
});

test('commercial loading and blocked-access copy avoid internal architecture vocabulary', () => {
  const source = webSource('CommercialWebApp.tsx');
  expect(source).toContain('Validando assinatura, período gratuito e funcionalidades disponíveis');
  expect(source).not.toContain('Validando assinatura, trial e capabilities');
  expect(source).not.toContain('A superfície operacional permanece fail-closed');
});

test('access empty-state copy explains next user action rather than backend implementation', () => {
  const source = webSource('AccessCenterWorkspace.tsx');
  expect(source).toContain('Para configurar dispositivos, utilize uma integração de acesso');
  expect(source).not.toContain('O Access Center não cria dispositivos sem um contrato canônico de backend');
});

test('trial completion feedback is fully customer-facing Portuguese', () => {
  const source = webSource('WebAuthEntry.tsx');
  expect(source).toContain('Período gratuito iniciado.');
  expect(source).not.toContain('Trial criado.');
});
