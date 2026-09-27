import fs from 'node:fs';

const panel = fs.readFileSync('src/components/IntegrationSettingsPanel.tsx', 'utf8');
const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

describe('Commercial Readiness C6 integration admin surface', () => {
  it('is write-only and never implements a secret read/reveal route', () => {
    expect(panel).toContain("/integrations/tenant/connections/' + selected.id + '/secret");
    expect(panel).toContain("method: 'PUT'");
    expect(panel).toContain("method: 'DELETE'");
    expect(panel).not.toMatch(/method:\s*'GET'[\s\S]{0,120}\/secret/);
    expect(panel).not.toMatch(/revealSecret|showSecret|downloadSecret/);
  });

  it('clears sensitive drafts after mutations and masks credential inputs', () => {
    expect(panel).toContain("setCredentials('{}')");
    expect(panel).toContain("setCurrentPassword('')");
    expect(panel).toContain('secureTextEntry');
    expect(panel).not.toMatch(/AsyncStorage|saveSession|localStorage/);
  });

  it('derives tenant from session by never sending gymId', () => {
    expect(panel).not.toMatch(/\bgymId\b/);
    expect(panel).toContain("api('/integrations/tenant/connections')");
  });

  it('adds integrations as an owner/manager commercial module', () => {
    expect(web).toContain("key: 'integrations'");
    expect(web).toContain("roles: ['OWNER', 'MANAGER']");
    expect(web).toContain("<IntegrationSettingsPanel />");
  });
});
