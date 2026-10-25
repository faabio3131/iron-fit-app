import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScheduleCalendarPanel } from '../src/components/ScheduleCalendarPanel';

const mockApi = jest.fn();
const onDateSelected = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const slots = [{ id: 'slot-a', weekday: 1, startTime: '08:00', endTime: '09:00', capacity: 12, active: true }];
const scheduled = {
  id: 'booking-a', date: '2026-10-26T00:00:00.000Z', status: 'SCHEDULED',
  slot: slots[0], student: { user: { name: 'Ana' } },
};
const checkedIn = {
  id: 'booking-b', date: '2026-10-27T00:00:00.000Z', status: 'CHECKED_IN',
  slot: { ...slots[0], weekday: 2 }, student: { user: { name: 'Bruno' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/schedules?')) return [scheduled, checkedIn];
    throw new Error('Rota inesperada: ' + path);
  });
});

test('C02 agenda shows canonical bookings in week and day views and populates reservation date', async () => {
  const view = render(<ScheduleCalendarPanel slots={slots} canCheckIn={false}
    onDateSelected={onDateSelected} initialDate="2026-10-26" />);
  await waitFor(() => expect(view.getByTestId('agenda-booking-booking-a')).toBeTruthy());
  expect(view.getByTestId('agenda-booking-booking-b')).toBeTruthy();
  const read = mockApi.mock.calls.find(([path]) => path.startsWith('/schedules?'));
  expect(read[0]).toContain('from=2026-10-26T00%3A00%3A00.000Z');
  expect(read[0]).toContain('to=2026-11-01T23%3A59%3A59.999Z');
  expect(read[0]).not.toContain('gymId=');
  fireEvent.press(view.getByTestId('agenda-view-day'));
  expect(view.getByTestId('agenda-booking-booking-a')).toBeTruthy();
  expect(view.queryByTestId('agenda-booking-booking-b')).toBeNull();
  fireEvent.press(view.getByTestId('agenda-day-2026-10-27'));
  expect(onDateSelected).toHaveBeenCalledWith('2026-10-27');
  expect(view.getByTestId('agenda-booking-booking-b')).toBeTruthy();
});

test('C02 check-in needs confirmation, uses backend mutation and refreshes canonical list', async () => {
  let checked = false;
  mockApi.mockImplementation(async (path: string, _token?: string, options?: { method?: string }) => {
    if (path.startsWith('/schedules?')) return [{ ...scheduled, status: checked ? 'CHECKED_IN' : 'SCHEDULED' }];
    if (path === '/schedules/booking-a/check-in') {
      expect(options?.method).toBe('PATCH');
      checked = true;
      return { ...scheduled, status: 'CHECKED_IN' };
    }
    throw new Error('Rota inesperada');
  });
  const view = render(<ScheduleCalendarPanel slots={slots} canCheckIn={true}
    onDateSelected={onDateSelected} initialDate="2026-10-26" />);
  await waitFor(() => expect(view.getByTestId('agenda-checkin-booking-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('agenda-checkin-booking-a'));
  expect(mockApi.mock.calls.filter(([path]) => path.includes('/check-in'))).toHaveLength(0);
  fireEvent.press(view.getByTestId('agenda-confirm-checkin-booking-a'));
  await waitFor(() => expect(view.getByText(/Presença registrada/)).toBeTruthy());
  expect(mockApi.mock.calls.filter(([path]) => path.includes('/check-in'))).toHaveLength(1);
  expect(view.queryByTestId('agenda-checkin-booking-a')).toBeNull();
});

test('C02 TRAINER can inspect agenda but cannot submit staff check-in', async () => {
  const view = render(<ScheduleCalendarPanel slots={slots} canCheckIn={false}
    onDateSelected={onDateSelected} initialDate="2026-10-26" />);
  await waitFor(() => expect(view.getByTestId('agenda-booking-booking-a')).toBeTruthy());
  expect(view.queryByTestId('agenda-checkin-booking-a')).toBeNull();
  expect(mockApi.mock.calls.some(([path]) => path.includes('/check-in'))).toBe(false);
});

test('C02 failed schedule reads fail closed and retry restores actual bookings', async () => {
  let attempts = 0;
  mockApi.mockImplementation(async (path: string) => {
    if (!path.startsWith('/schedules?')) throw new Error('Rota inesperada');
    attempts++;
    if (attempts === 1) throw new Error('Falha de autorização');
    return [scheduled];
  });
  const view = render(<ScheduleCalendarPanel slots={slots} canCheckIn={false}
    onDateSelected={onDateSelected} initialDate="2026-10-26" />);
  await waitFor(() => expect(view.getByTestId('agenda-error')).toBeTruthy());
  expect(view.queryByTestId('agenda-booking-booking-a')).toBeNull();
  fireEvent.press(view.getByTestId('agenda-retry'));
  await waitFor(() => expect(view.getByTestId('agenda-booking-booking-a')).toBeTruthy());
  expect(attempts).toBe(2);
});

test('C02 rejected check-in never presents a successful attendance state', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path.startsWith('/schedules?')) return [scheduled];
    if (path === '/schedules/booking-a/check-in') throw new Error('Agendamento não pode receber check-in');
    throw new Error('Rota inesperada');
  });
  const view = render(<ScheduleCalendarPanel slots={slots} canCheckIn={true}
    onDateSelected={onDateSelected} initialDate="2026-10-26" />);
  await waitFor(() => expect(view.getByTestId('agenda-checkin-booking-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('agenda-checkin-booking-a'));
  fireEvent.press(view.getByTestId('agenda-confirm-checkin-booking-a'));
  await waitFor(() => expect(view.getByText(/Agendamento não pode receber check-in/)).toBeTruthy());
  expect(view.getByText(/Agendado/)).toBeTruthy();
});
