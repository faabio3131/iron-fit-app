import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScheduleWorkspace } from '../src/web/ScheduleWorkspace';

describe('O9 ScheduleWorkspace', () => {
  test('books a student from a calendar slot and performs check-in on an existing booking', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const onCreateSlot = jest.fn().mockResolvedValue(undefined);
    const onBook = jest.fn().mockResolvedValue(undefined);
    const onCheckIn = jest.fn().mockResolvedValue(undefined);

    const view = render(
      <ScheduleWorkspace
        students={[{ id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } }]}
        slots={[{ id: 'slot-1', weekday, startTime: '08:00', endTime: '09:00', capacity: 2 }]}
        bookings={[{
          id: 'booking-1',
          studentId: 'student-1',
          slotId: 'slot-1',
          date: today,
          status: 'SCHEDULED',
          student: { user: { name: 'Ana Teste' } },
        }]}
        saving={false}
        canCreateSlot
        canManageBookings
        onCreateSlot={onCreateSlot}
        onBook={onBook}
        onCheckIn={onCheckIn}
      />,
    );

    expect(view.getByTestId('schedule-view-week')).toBeTruthy();
    expect(view.getByText('1/2 ocupadas · 1 livres')).toBeTruthy();

    fireEvent.press(view.getByTestId('schedule-student-student-1'));
    fireEvent.press(view.getByTestId('schedule-slot-slot-1'));
    fireEvent.press(view.getByTestId('schedule-book'));

    await waitFor(() => expect(onBook).toHaveBeenCalledTimes(1));
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'student-1',
      slotId: 'slot-1',
    }));
    expect(onBook.mock.calls[0][0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    fireEvent.press(view.getByTestId('schedule-check-in-booking-1'));
    await waitFor(() => expect(onCheckIn).toHaveBeenCalledWith('booking-1'));
  });

  test('switches between week and day workspace modes', () => {
    const view = render(
      <ScheduleWorkspace
        students={[]}
        slots={[]}
        bookings={[]}
        saving={false}
        canCreateSlot={false}
        canManageBookings={false}
        onCreateSlot={jest.fn()}
        onBook={jest.fn()}
        onCheckIn={jest.fn()}
      />,
    );

    fireEvent.press(view.getByTestId('schedule-view-day'));
    expect(view.getByTestId('schedule-view-day').props.accessibilityState.selected).toBe(true);
  });
});
