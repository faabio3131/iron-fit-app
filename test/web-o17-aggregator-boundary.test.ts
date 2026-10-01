import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O17 keeps Aggregator Hub out of the V1 tenant menu while providers are external blockers', () => {
  const modulesBlock = web.slice(
    web.indexOf('const modules: ModuleDefinition[]'),
    web.indexOf('const onboardingLabels'),
  );

  expect(modulesBlock).not.toContain("key: 'aggregator'");
  expect(modulesBlock).not.toContain('Wellhub');
  expect(modulesBlock).not.toContain('TotalPass');
  expect(web).not.toContain("nav-aggregator");
});

test('O17 does not promise provider availability from the application shell', () => {
  expect(web).not.toMatch(/Wellhub.*(ativo|disponível|conectado|live)/i);
  expect(web).not.toMatch(/TotalPass.*(ativo|disponível|conectado|live)/i);
  expect(web).not.toContain('/aggregator/');
});
