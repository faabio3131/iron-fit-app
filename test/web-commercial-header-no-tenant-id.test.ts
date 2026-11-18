import { readFile } from 'node:fs/promises';

test('commercial page header has product-facing copy and never renders internal tenant UUID', async () => {
  const web = await readFile('src/web/CommercialWebApp.tsx', 'utf8');
  expect(web).toContain('<Text style={styles.muted}>Gestão operacional da academia</Text>');
  expect(web).not.toContain("Tenant derivado da sessão autenticada");
  expect(web).not.toContain("{activeTenantId ?? 'sem tenant ativo'}");
});
