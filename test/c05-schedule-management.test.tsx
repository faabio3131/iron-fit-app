import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScheduleManagementPanel } from '../src/components/ScheduleManagementPanel';

const mockApi = jest.fn();
const onUpdated = jest.fn(async () => undefined);
const onDateChange = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const students = [{ id: 'student-a', name: 'Ana Silva' }];
const slots = [
  { id: 'slot-mon', weekday: 1, startTime: '08:00', endTime: '09:00', capacity: 4, active: true },
  { id: 'slot-tue', weekday: 2, startTime: '10:00', endTime: '11:00', capacity: 4, active: true },
  { id: 'slot-inactive', weekday: 1, startTime: '12:00', endTime: '13:00', capacity: 4, active: false },
];
beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string, _session?: string, options?: { method?: string }) => {
    if (path === '/schedule-slots' && options?.method === 'POST') return { id: 'new-slot' };
    if (path === '/schedules' && options?.method === 'POST') return { id: 'booking-a', status: 'SCHEDULED' };
    throw new Error('Unexpected route: ' + path);
  });
});
function mount(props: Partial<React.ComponentProps<typeof ScheduleManagementPanel>> = {}) {
  return render(<ScheduleManagementPanel students={students} slots={slots} bookingDate="2026-10-26"
    onDateChange={onDateChange} canManageSlots={true} onUpdated={onUpdated} {...props} />);
}
function selectBooking(view: ReturnType<typeof mount>) {
  fireEvent.press(view.getByTestId('schedule-pick-student-student-a'));
  fireEvent.press(view.getByTestId('schedule-pick-slot-slot-mon'));
}
test('C05 confirmed booking posts only canonical session-scoped fields and refreshes calendar', async () => {
  const view = mount();
  selectBooking(view);
  fireEvent.press(view.getByTestId('schedule-book'));
  await waitFor(() => expect(view.getByTestId('schedule-operation-success')).toBeTruthy());
  const call = mockApi.mock.calls.find(([path]) => path === '/schedules');
  expect(call).toBeTruthy();
  expect(JSON.parse(call[2].body)).toEqual({ studentId: 'student-a', slotId: 'slot-mon',
    date: '2026-10-26T00:00:00.000Z' });
  expect(JSON.stringify(call)).not.toContain('gymId');
  expect(onUpdated).toHaveBeenCalledTimes(1);
  expect(view.queryByTestId('schedule-check-in')).toBeNull();
});

test('C05 mismatched weekday and invalid dates do not create booking', () => {
  const view = mount({ bookingDate: '2026-10-27' });
  selectBooking(view);
  expect(view.getByTestId('schedule-weekday-mismatch')).toBeTruthy();
  fireEvent.press(view.getByTestId('schedule-book'));
  expect(mockApi).not.toHaveBeenCalled();
  view.rerender(<ScheduleManagementPanel students={students} slots={slots} bookingDate="2026-02-30"
    onDateChange={onDateChange} canManageSlots onUpdated={onUpdated} />);
  expect(view.getByTestId('schedule-invalid-date')).toBeTruthy();
  fireEvent.press(view.getByTestId('schedule-book'));
  expect(mockApi).not.toHaveBeenCalled();
});

test('C05 booking input is controlled by calendar selection, with no stale date override', () => {
  const view = mount();
  fireEvent.changeText(view.getByTestId('schedule-booking-date'), '2026-10-27');
  expect(onDateChange).toHaveBeenCalledWith('2026-10-27');
  view.rerender(<ScheduleManagementPanel students={students} slots={slots} bookingDate="2026-11-02"
    onDateChange={onDateChange} canManageSlots onUpdated={onUpdated} />);
  expect(view.getByTestId('schedule-booking-date').props.value).toBe('2026-11-02');
});

test('C05 invalid slot times and zero capacity block slot creation before backend', () => {
  const view = mount();
  fireEvent.changeText(view.getByTestId('schedule-end'), '07:00');
  expect(view.getByTestId('schedule-slot-validation')).toBeTruthy();
  fireEvent.press(view.getByTestId('schedule-create-slot'));
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('schedule-end'), '09:00');
  fireEvent.changeText(view.getByTestId('schedule-capacity'), '0');
  fireEvent.press(view.getByTestId('schedule-create-slot'));
  expect(mockApi).not.toHaveBeenCalled();
});

test('C05 valid slot sends exact DTO with weekday/capacity and never passes tenant from UI', async () => {
  const view = mount();
  fireEvent.press(view.getByTestId('schedule-weekday-5'));
  fireEvent.press(view.getByTestId('schedule-create-slot'));
  await waitFor(() => expect(view.getByTestId('schedule-operation-success')).toBeTruthy());
  const call = mockApi.mock.calls.find(([path]) => path === '/schedule-slots');
  expect(JSON.parse(call[2].body)).toEqual({
    weekday: 5, startTime: '08:00', endTime: '09:00', capacity: 10, active: true,
  });
  expect(onUpdated).toHaveBeenCalledTimes(1);
});

test('C05 reception can book but cannot create slot; inactive slot cannot be booked', () => {
  const view = mount({ canManageSlots: false });
  expect(view.queryByTestId('schedule-create-slot')).toBeNull();
  expect(view.queryByTestId('schedule-pick-slot-slot-inactive')).toBeNull();
  selectBooking(view);
  expect(view.getByTestId('schedule-book')).toBeTruthy();
});

test('C05 after confirmed POST, a failed refresh never invites duplicate submission as a failed booking', async () => {
  onUpdated.mockRejectedValueOnce(new Error('GET schedules failed'));
  const view = mount();
  selectBooking(view);
  fireEvent.press(view.getByTestId('schedule-book'));
  await waitFor(() => expect(view.getByTestId('schedule-refresh-warning')).toBeTruthy());
  expect(view.getByText(/Agendamento confirmado pelo IRON/)).toBeTruthy();
  expect(mockApi.mock.calls.filter(([path]) => path === '/schedules')).toHaveLength(1);
});

test('C05 server rejects capacity/duplicate booking with error, without false success', async () => {
  mockApi.mockRejectedValueOnce(new Error('Slot lotado'));
  const view = mount();
  selectBooking(view);
  fireEvent.press(view.getByTestId('schedule-book'));
  await waitFor(() => expect(view.getByTestId('schedule-operation-error')).toBeTruthy());
  expect(view.getByText('Slot lotado')).toBeTruthy();
  expect(view.queryByTestId('schedule-operation-success')).toBeNull();
});
