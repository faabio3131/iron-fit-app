import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const composer = fs.readFileSync('src/components/WorkoutComposer.tsx', 'utf8');
const accessCenter = fs.readFileSync('src/components/AccessCenterPanel.tsx', 'utf8');

test('commercial Web exposes canonical mutation paths for remaining operational parity', () => {
  for (const route of [
    "'/workouts'",
    "'/schedules'",
  ]) expect(web).toContain(route);
  expect(web).toContain('/check-in');
  expect(composer).toContain('manual-workout-create');
  expect(composer).toContain("api('/workouts'");
  expect(web).toContain('schedule-book');
  expect(accessCenter).toContain("api('/access/credentials'");
  expect(accessCenter).toContain('access-credential-create');
  expect(web).toContain('<AccessCenterPanel');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
});

test('mutation refreshes both commercial shell and the active module', () => {
  expect(web).toMatch(/await loadShell\(\); await loadModule\(active\)/);
});
