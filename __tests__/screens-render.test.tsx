import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockApi = jest.fn(async (..._args: unknown[]) => []);
const mockLogout = jest.fn(async () => undefined);

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { name: 'Aluno Teste', email: 'aluno@example.test', gym: { name: 'Iron Fit Centro' } },
    activeTenantId: 'gym-a',
    login: jest.fn(async () => ({ requiresTenantSelection: false })),
    logout: mockLogout,
  }),
}));

// eslint-disable-next-line import/first
import { CheckInScreen } from '../src/screens/CheckInScreen';
// eslint-disable-next-line import/first
import { EvolutionScreen } from '../src/screens/EvolutionScreen';
// eslint-disable-next-line import/first
import { FinancialScreen } from '../src/screens/FinancialScreen';
// eslint-disable-next-line import/first
import { LoginScreen } from '../src/screens/LoginScreen';
// eslint-disable-next-line import/first
import { ProfileScreen } from '../src/screens/ProfileScreen';
// eslint-disable-next-line import/first
import { SchedulesScreen } from '../src/screens/SchedulesScreen';
// eslint-disable-next-line import/first
import { WorkoutsScreen } from '../src/screens/WorkoutsScreen';

test('renders each modular screen in isolation', async () => {
  expect(render(<LoginScreen />).getByText('Bem-vindo de volta')).toBeTruthy();
  expect(render(<CheckInScreen />).getByText('Check-in na academia')).toBeTruthy();
  expect(render(<ProfileScreen />).getByText('Aluno Teste')).toBeTruthy();

  const workouts = render(<WorkoutsScreen />);
  const schedules = render(<SchedulesScreen />);
  const evolution = render(<EvolutionScreen />);
  const financial = render(<FinancialScreen />);

  await waitFor(() => {
    expect(workouts.getByText('Nenhum treino ainda')).toBeTruthy();
    expect(schedules.getByText('Nenhum horário reservado')).toBeTruthy();
    expect(evolution.getByText('Nenhuma avaliação')).toBeTruthy();
    expect(financial.getByText('Nenhuma cobrança')).toBeTruthy();
  });
});
