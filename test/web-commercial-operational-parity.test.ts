import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const scheduleWorkspace = fs.readFileSync('src/web/ScheduleWorkspace.tsx', 'utf8');
const accessCenter = fs.readFileSync('src/web/AccessCenterWorkspace.tsx', 'utf8');

test('commercial Web exposes canonical mutation paths for remaining operational parity', () => {
  for (const route of [
    "'/workouts'",
    "'/schedules'",
    "'/access/credentials'",
  ]) expect(web).toContain(route);
  expect(web).toContain('/check-in');
  expect(web).toContain('manual-workout-create');
  expect(scheduleWorkspace).toContain('schedule-book');
  expect(accessCenter).toContain('access-credential-create');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
});

test('mutation refreshes both commercial shell and the active module', () => {
  expect(web).toMatch(/await loadShell\(\); await loadModule\(active\)/);
});
