import fs from 'node:fs';

const security = fs.readFileSync('src/components/AccountSecurityPanel.tsx', 'utf8');

test('O14 Security Center covers password, email, MFA, recovery and sessions on canonical auth APIs', () => {
  for (const marker of [
    'SECURITY CENTER',
    '/auth/password/change',
    '/auth/email/change/request',
    '/auth/email/change/confirm',
    '/auth/mfa/setup',
    '/auth/mfa/confirm',
    '/auth/mfa/disable',
    '/auth/sessions',
    '/auth/sessions/revoke',
    '/auth/sessions/revoke-others',
    'security-change-password',
    'security-mfa-setup',
    'security-recovery-codes-saved',
    'security-revoke-others',
  ]) {
    expect(security).toContain(marker);
  }
});

test('O14 renders session dates as product language instead of raw ISO strings', () => {
  expect(security).toContain('formatDate(session.createdAt)');
  expect(security).toContain('formatDate(session.lastUsedAt)');
  expect(security).toContain('formatDate(session.expiresAt)');
  expect(security).not.toContain('String(session.createdAt)');
  expect(security).not.toContain('String(session.lastUsedAt)');
});

test('O14 keeps second-factor authority and one-time recovery behavior', () => {
  expect(security).toContain("profile?.mfaEnabled");
  expect(security).toContain("mfaCode: factor");
  expect(security).toContain("recoveryCode: factor.toUpperCase()");
  expect(security).toContain('Exibição única');
  expect(security).toContain('não ficam disponíveis para consulta posterior');
});
