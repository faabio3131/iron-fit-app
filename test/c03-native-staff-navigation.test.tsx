import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { RootNavigator } from '../src/navigation/RootNavigator';

let mockAuth: any;
const originalPlatform = Platform.OS;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../src/web/CommercialWebApp', () => ({
  CommercialWebApp: () => <Text testID="canonical-staff-operations">Operação</Text>,
}));
jest.mock('../src/web/WebAuthEntry', () => ({ WebAuthEntry: () => null }));
jest.mock('../src/screens/LoginScreen', () => ({ LoginScreen: () => null }));
jest.mock('../src/screens/PasswordRecoveryScreen', () => ({ PasswordRecoveryScreen: () => null }));
jest.mock('../src/screens/TenantSelectionScreen', () => ({ TenantSelectionScreen: () => null }));
jest.mock('../src/screens/WorkoutsScreen', () => ({ WorkoutsScreen: () => <Text testID="student-workouts">Aluno</Text> }));
jest.mock('../src/screens/SchedulesScreen', () => ({ SchedulesScreen: () => null }));
jest.mock('../src/screens/EvolutionScreen', () => ({ EvolutionScreen: () => null }));
jest.mock('../src/screens/FinancialScreen', () => ({ FinancialScreen: () => null }));
jest.mock('../src/screens/ProfileScreen', () => ({ ProfileScreen: () => null }));
jest.mock('../src/components/TabItem', () => ({ TabItem: () => null }));

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockAuth = {
    sessionReady: true, session: { accessToken: 'test' }, pendingTenantSelection: false,
    profile: { id: 'staff-a', roles: ['RECEPTION'] },
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
