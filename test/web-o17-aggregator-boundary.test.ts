import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const hub = fs.readFileSync('src/web/AggregatorHubWorkspace.tsx', 'utf8');

test('O17 exposes Aggregator Hub without claiming external-provider homologation', () => {
  const modulesBlock = web.slice(
    web.indexOf('const modules: ModuleDefinition[]'),
    web.indexOf('const onboardingLabels'),
  );

  expect(modulesBlock).toContain("key: 'aggregator'");
  expect(modulesBlock).not.toContain('Wellhub');
  expect(modulesBlock).not.toContain('TotalPass');
  expect(web).toContain('<AggregatorHubWorkspace');
  expect(hub).toContain('só podem aparecer como ativos/homologados quando houver evidência externa real');
});

test('O17 keeps the Hub provider-neutral, tenant-scoped and outside critical authority', () => {
  expect(hub).toContain('/aggregator/operations/summary');
  expect(hub).toContain('/aggregator/intelligence/overview?days=30');
  expect(hub).toContain('O Hub não autoriza acesso por conta própria');
  expect(hub).not.toMatch(/method:\s*'POST'|method:\s*"POST"|method:\s*'PATCH'|method:\s*'DELETE'/);
  expect(hub).not.toMatch(/gymId|X-Tenant-ID|X-Gym-ID/);
  expect(hub).not.toMatch(/Wellhub.*(ativo|disponível|conectado|live)/i);
  expect(hub).not.toMatch(/TotalPass.*(ativo|disponível|conectado|live)/i);
});
