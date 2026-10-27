import fs from 'node:fs';

const shell = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const team = fs.readFileSync('src/components/TeamManagementPanel.tsx', 'utf8');

test('O21A invite stays fail-closed until the authoritative team roster loads', () => {
  expect(shell).toContain('rosterLoaded={Array.isArray(data.users) || Array.isArray(data.users?.items)}');
  expect(team).toContain('disabled={!rosterLoaded || !inviteValid || working}');
  expect(team).toContain('if (working || !rosterLoaded || allowedRoles.length === 0) return;');
  expect(team).toContain('name.trim().length >= 2');
  expect(team).toContain('allowedRoles.includes(inviteRole)');
  expect(team).toContain("api('/users/invite'");
});

test('O21A team creation uses per-user secure invitations and governed tenant memberships', () => {
  expect(team).toContain("isOwner ? ['MANAGER', 'RECEPTION', 'TRAINER'] : isManager ? ['RECEPTION', 'TRAINER'] : []");
  expect(team).toContain('!isManager || role !== \'MANAGER\'');
  expect(team).toContain('/membership/status');
  expect(team).toContain('/membership/role');
  expect(team).not.toContain('member.password');
  expect(team).not.toContain("api('/users', undefined, {");
  expect(shell).not.toContain('member.password');
});
