import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');

test('O21A team invitation is unavailable until roster and member data are valid', () => {
  expect(web).toContain('disabled={saving || !teamLoaded || !!inviteIssue}');
  expect(web).toContain("if (inviteIssue) { setError(inviteIssue); return; }");
  expect(web).toContain("api('/users/invite'");
});

test('O21A direct team creation requires valid role, identity, and strong password', () => {
  expect(web).toContain('disabled={saving || !teamLoaded || !!directIssue}');
  expect(web).toContain("const directIssue = inviteIssue || (!member.password");
  expect(web).toContain("strongPassword(member.password)");
  expect(web).toContain("api('/users', undefined, {");
});
