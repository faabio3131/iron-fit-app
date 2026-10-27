import fs from 'node:fs';

const premiumSchedule = fs.readFileSync('src/web/ScheduleWorkspace.tsx', 'utf8');
const premiumAccess = fs.readFileSync('src/web/AccessCenterWorkspace.tsx', 'utf8');

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const composer = fs.readFileSync('src/components/WorkoutComposer.tsx', 'utf8');
const accessCenter = fs.readFileSync('src/components/AccessCenterPanel.tsx', 'utf8');
const scheduleManagement = fs.readFileSync('src/components/ScheduleManagementPanel.tsx', 'utf8');
const scheduleCalendar = fs.readFileSync('src/components/ScheduleCalendarPanel.tsx', 'utf8');

test('commercial Web exposes canonical mutation paths for remaining operational parity', () => {
  expect(web + composer).toContain("'/workouts'");
  expect(scheduleManagement).toContain("api('/schedules'");
  expect(scheduleCalendar).toContain('/check-in');
  expect(composer).toContain('manual-workout-create');
  expect(composer).toContain("api('/workouts'");
  expect(scheduleManagement).toContain('schedule-book');
  expect(web).toContain('<ScheduleWorkspace');
  expect(premiumSchedule).toContain('onBook');
  expect(web).toContain("api('/schedules'");
  expect(accessCenter).toContain("api('/access/credentials'");
  expect(accessCenter).toContain('access-credential-create');
  expect(web).toContain('<AccessCenterWorkspace');
  expect(premiumAccess).toContain('onRevokeCredential');
  expect(web).toContain("api('/access/credentials'");
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
});

test('mutation refreshes both commercial shell and the active module', () => {
  expect(web).toMatch(/await loadShell\(\); await loadModule\(active\)/);
});
