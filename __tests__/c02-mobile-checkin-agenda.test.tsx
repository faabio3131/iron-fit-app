import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApi = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

// eslint-disable-next-line import/first
import { SchedulesScreen } from '../src/screens/SchedulesScreen';

beforeEach(() => mockApi.mockReset());

test('C02 mobile reloads server-confirmed agenda after student check-in', async () => {
  let reads = 0;
  let posts = 0;
  mockApi.mockImplementation(async (path: string, _token?: string, options?: { method?: string }) => {
    if (path === '/me/schedules') {
      reads++;
      return [{
        id: 'booking-a',
        date: '2026-10-25T13:00:00.000Z',
        status: posts ? 'CHECKED_IN' : 'SCHEDULED',
        slot: { name: 'Treino funcional', startTime: '10:00' },
      }];
    }
    if (path === '/me/check-in') {
      expect(options?.method).toBe('POST');
      posts++;
      return { id: 'booking-a', status: 'CHECKED_IN' };
    }
    throw new Error('Unexpected route: ' + path);
  });
  const view = render(<SchedulesScreen />);
  await waitFor(() => expect(view.getByText(/Agendado/)).toBeTruthy());
  fireEvent.press(view.getByTestId('checkin-submit'));
  await waitFor(() => expect(view.getByText(/Entrada registrada/)).toBeTruthy());
  expect(view.getByText(/Check-in registrado/)).toBeTruthy();
  expect(reads).toBe(2);
  expect(posts).toBe(1);
});

test('C02 failed agenda read shows retry instead of incorrectly reporting no booking', async () => {
  let reads = 0;
  mockApi.mockImplementation(async (path: string) => {
    if (path !== '/me/schedules') throw new Error('Unexpected route');
    reads++;
    if (reads === 1) throw new Error('Connection refused');
    return [{ id: 'booking-a', status: 'SCHEDULED', slot: { name: 'Pilates' } }];
  });
  const view = render(<SchedulesScreen />);
  await waitFor(() => expect(view.getByText(/Não foi possível atualizar a agenda/)).toBeTruthy());
  expect(view.queryByText('Nenhum horário reservado')).toBeNull();
  fireEvent.press(view.getByTestId('schedule-retry'));
  await waitFor(() => expect(view.getByText('Pilates')).toBeTruthy());
  expect(reads).toBe(2);
});

test('C02 rejected self check-in never triggers a success refresh', async () => {
  let reads = 0;
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/me/schedules') {
      reads++;
      return [{ id: 'booking-a', status: 'SCHEDULED', slot: { name: 'Musculação' } }];
    }
    if (path === '/me/check-in') throw new Error('Nenhum agendamento para hoje');
    throw new Error('Unexpected route');
  });
  const view = render(<SchedulesScreen />);
  await waitFor(() => expect(view.getByText('Musculação')).toBeTruthy());
  fireEvent.press(view.getByTestId('checkin-submit'));
  await waitFor(() => expect(view.getByText('Nenhum agendamento para hoje')).toBeTruthy());
  expect(reads).toBe(1);
  expect(view.getByText(/Agendado/)).toBeTruthy();
});
