import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const hub = fs.readFileSync('src/web/AggregatorHubWorkspace.tsx', 'utf8');

test('D8 exposes Aggregator Hub only inside the authenticated commercial shell', () => {
  expect(web).toContain("type ModuleKey = 'overview'");
  expect(web).toContain("'aggregator'");
  expect(web).toContain("label: 'Aggregator Hub'");
  expect(web).toContain('<AggregatorHubWorkspace');
  expect(hub).toContain('testID="aggregator-hub-workspace"');
});

test('D8 consumes only canonical provider-neutral aggregator read models', () => {
  for (const route of [
    '/aggregator/operations/summary',
    '/aggregator/operations/reception-queue?limit=25',
    '/aggregator/operations/risk-queue?limit=25',
    '/aggregator/operations/settlement-queue?limit=25',
    '/aggregator/intelligence/overview?days=30',
    '/aggregator/intelligence/providers?days=30',
    '/aggregator/intelligence/trends?days=30',
  ]) expect(hub).toContain(route);

  expect(hub).not.toMatch(/method:\s*'POST'|method:\s*"POST"|method:\s*'PATCH'|method:\s*'DELETE'/);
  expect(hub).not.toMatch(/gymId|X-Tenant-ID|X-Gym-ID/);
});

test('D8 preserves external-provider and critical-authority boundaries', () => {
  expect(hub).toContain('só podem aparecer como ativos/homologados quando houver evidência externa real');
  expect(hub).toContain('O Hub não autoriza acesso por conta própria');
  expect(hub).toContain('analytics, risco e settlement ficam restritos');
});
