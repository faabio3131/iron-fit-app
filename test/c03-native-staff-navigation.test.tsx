import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../src/navigation/RootNavigator';

let mockAuth: any;
const mockRefreshProfile = jest.fn(async () => undefined);
const mockLogout = jest.fn(async () => undefined);
const originalPlatform = Platform.OS;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../src/web/CommercialWebApp', () => ({
  CommercialWebApp: () => {
    const React = require('react');
    const Native = require('react-native');
    return React.createElement(Native.Text, { testID: 'canonical-staff-operations' }, 'Operação');
  },
}));
jest.mock('../src/web/WebAuthEntry', () => ({ WebAuthEntry: () => null }));
jest.mock('../src/screens/LoginScreen', () => ({ LoginScreen: () => null }));
jest.mock('../src/screens/PasswordRecoveryScreen', () => ({ PasswordRecoveryScreen: () => null }));
jest.mock('../src/screens/TenantSelectionScreen', () => ({ TenantSelectionScreen: () => null }));
jest.mock('../src/screens/WorkoutsScreen', () => ({ WorkoutsScreen: () => {
    const React = require('react');
    const Native = require('react-native');
    return React.createElement(Native.Text, { testID: 'student-workouts' }, 'Aluno');
  } }));
jest.mock('../src/screens/SchedulesScreen', () => ({ SchedulesScreen: () => null }));
jest.mock('../src/screens/EvolutionScreen', () => ({ EvolutionScreen: () => null }));
jest.mock('../src/screens/FinancialScreen', () => ({ FinancialScreen: () => null }));
jest.mock('../src/screens/ProfileScreen', () => ({ ProfileScreen: () => null }));
jest.mock('../src/components/TabItem', () => ({ TabItem: () => null }));

beforeEach(() => {
  mockRefreshProfile.mockReset(); mockLogout.mockReset();
  mockRefreshProfile.mockResolvedValue(undefined); mockLogout.mockResolvedValue(undefined);
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockAuth = {
    sessionReady: true, session: { accessToken: 'test' }, pendingTenantSelection: false,
    profile: { id: 'staff-a', roles: ['RECEPTION'] },
    refreshProfile: mockRefreshProfile, logout: mockLogout,
  };
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});

test.each(['OWNER', 'MANAGER', 'RECEPTION', 'TRAINER', 'SUPER_ADMIN'])(
  'C03 native %s opens the canonical operating workspace rather than student screens', (role) => {
    mockAuth.profile = { id: 'staff-a', roles: [role] };
    const view = render(<RootNavigator />);
    expect(view.getByTestId('canonical-staff-operations')).toBeTruthy();
    expect(view.queryByTestId('student-workouts')).toBeNull();
  },
);

test('C03 native STUDENT keeps actual student journey, not administrative modules', () => {
  mockAuth.profile = { id: 'student-a', roles: ['STUDENT'] };
  const view = render(<RootNavigator />);
  expect(view.getByTestId('student-workouts')).toBeTruthy();
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
});

test('C03 staff/student dual membership prefers authorized operational UI while backend still gates permissions', () => {
  mockAuth.profile = { id: 'both-a', roles: ['STUDENT', 'OWNER'] };
  const view = render(<RootNavigator />);
  expect(view.getByTestId('canonical-staff-operations')).toBeTruthy();
  expect(view.queryByTestId('student-workouts')).toBeNull();
});

test('C03 pending or empty role profile fails closed on native, never guesses student or staff authority', () => {
  mockAuth.profile = null;
  let view = render(<RootNavigator />);
  expect(view.getByTestId('profile-validation-pending')).toBeTruthy();
  expect(view.queryByTestId('student-workouts')).toBeNull();
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
  view.unmount();
  mockAuth.profile = { roles: [] };
  view = render(<RootNavigator />);
  expect(view.getByTestId('profile-validation-pending')).toBeTruthy();
});


test('C05 absent profile gives real retry and logout actions without showing any privileged surface', async () => {
  mockAuth.profile = null;
  const view = render(<RootNavigator />);
  expect(view.getByTestId('profile-validation-pending')).toBeTruthy();
  expect(view.getByText(/módulos do IRON permanecem bloqueados/)).toBeTruthy();
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
  expect(view.queryByTestId('student-workouts')).toBeNull();
  fireEvent.press(view.getByTestId('profile-retry'));
  await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
  fireEvent.press(view.getByTestId('profile-logout'));
  await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
});

test('C05 missing roles fail-closed also on Web while offering profile reload', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  mockAuth.profile = { roles: [] };
  const view = render(<RootNavigator />);
  expect(view.getByTestId('profile-validation-pending')).toBeTruthy();
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
  expect(view.queryByTestId('student-workouts')).toBeNull();
  fireEvent.press(view.getByTestId('profile-retry'));
  await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
});

test('C05 a failed profile refresh never grants tenant/module access', async () => {
  mockAuth.profile = null;
  mockRefreshProfile.mockRejectedValueOnce(new Error('Conexão indisponível'));
  const view = render(<RootNavigator />);
  fireEvent.press(view.getByTestId('profile-retry'));
  await waitFor(() => expect(view.getByTestId('profile-retry-error')).toBeTruthy());
  expect(view.queryByTestId('canonical-staff-operations')).toBeNull();
  expect(view.queryByTestId('student-workouts')).toBeNull();
  expect(view.getByTestId('profile-retry')).toBeTruthy();
});
