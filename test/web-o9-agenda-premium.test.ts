import fs from 'node:fs';

const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
const agenda = fs.readFileSync('src/web/ScheduleWorkspace.tsx', 'utf8');

test('O9 Web loads canonical tenant schedule read model and renders the premium workspace', () => {
  expect(web).toContain("import { ScheduleWorkspace } from './ScheduleWorkspace';");
  expect(web).toContain("api('/schedule-slots')");
  expect(web).toContain("api('/schedules')");
  expect(web).toContain('bookings={list(data.bookings)}');
  expect(web).not.toContain('Dia da semana (0 a 6)');
  expect(web).not.toContain('<Data value={slots} />');
});

test('O9 Agenda exposes day/week calendar, filters, capacity, status and check-in', () => {
  for (const marker of [
    'schedule-view-day',
    'schedule-view-week',
    'Todos os alunos',
    'Agendados',
    'Check-in',
    'Faltas',
    'Cancelados',
    'ocupadas',
    'livres',
    'schedule-book',
    'schedule-check-in-',
  ]) {
    expect(agenda).toContain(marker);
  }
  expect(agenda).toContain("canCreateSlot");
  expect(agenda).toContain("canManageBookings");
  expect(agenda).toContain("onCreateSlot");
  expect(agenda).toContain("onBook");
  expect(agenda).toContain("onCheckIn");
});

test('O9 Agenda keeps authority in backend contracts and never sends tenant authority from UI', () => {
  expect(agenda).not.toContain('gymId');
  expect(web).not.toMatch(/JSON\.stringify\([^\n]*gymId/);
  expect(web).toContain("canCreateSlot={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}");
  expect(web).toContain("canManageBookings={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')}");
});
