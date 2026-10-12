import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const hub = fs.readFileSync('src/web/AggregatorHubWorkspace.tsx', 'utf8');

test('D8 keeps Aggregator Hub implemented but outside the V1 tenant menu until launch authority permits it', () => {
  expect(hub).toContain('testID="aggregator-hub-workspace"');
  expect(web).not.toContain("key: 'aggregator'");
  expect(web).not.toContain('AggregatorHubWorkspace');
  expect(web).not.toContain('nav-aggregator');
  expect(web).not.toContain('/aggregator/');
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
