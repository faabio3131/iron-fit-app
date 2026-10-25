import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CommercialWebApp } from '../src/web/CommercialWebApp';

const mockApi = jest.fn();
let currentRole = 'OWNER';
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'owner-a', name: 'Operador IRON', roles: [currentRole], permissions: [] },
    activeTenantId: 'gym-a',
    logout: jest.fn(),
  }),
}));
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const workouts = [
  { id: 'draft-a', status: 'DRAFT', goal: 'Treino iniciante' },
  { id: 'review-a', status: 'PENDING_REVIEW', goal: 'Candidato IA' },
  { id: 'approved-a', status: 'APPROVED', goal: 'Aprovado por treinador' },
  { id: 'active-a', status: 'ACTIVE', goal: 'Em andamento' },
];

function setup() {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/product-entitlements/tenant/features') return [];
    if (path === '/product-entitlements/tenant/current') return { status: 'ACTIVE' };
    if (path === '/commercial/trial/status') return { status: 'TRIALING' };
    if (path === '/commercial/onboarding') return { nextStep: 'FINISH' };
    if (path === '/auth/step-up/status') return { active: false };
    if (path === '/dashboard/summary') return {};
    if (path.startsWith('/dashboard/')) return [];
    if (path === '/workouts') return workouts;
    if (path === '/students') return [{ id: 'student-a', name: 'Aluno A' }];
    if (path === '/access/events') return [];
    if (path === '/access/credentials') return [
      { id: 'cred-a', active: true, status: 'ACTIVE', type: 'QR_CODE', student: { user: { name: 'Aluno A' } } },
      { id: 'cred-b', active: false, status: 'INACTIVE', type: 'QR_CODE', student: { user: { name: 'Aluno B' } } },
    ];
    if (path === '/access/devices') return [{ id: 'device-a', name: 'Catraca principal', active: true }];
    if (path === '/access/credentials/cred-a/revoke') return { id: 'cred-a', active: false };
    return [];
  });
}

beforeEach(() => { currentRole = 'OWNER'; setup(); });

test('C02 workout studio only permits transitions the canonical backend supports', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-workouts')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-workouts'));
  await waitFor(() => expect(view.getByText('Candidato IA')).toBeTruthy());

  expect(view.getByTestId('workout-approve-draft-a')).toBeTruthy();
  expect(view.getByTestId('workout-approve-review-a')).toBeTruthy();
  expect(view.getByTestId('workout-activate-approved-a')).toBeTruthy();
  expect(view.queryByTestId('workout-activate-review-a')).toBeNull();
  expect(view.queryByTestId('workout-activate-draft-a')).toBeNull();
  expect(view.queryByTestId('workout-approve-active-a')).toBeNull();

  fireEvent.press(view.getByTestId('workout-activate-approved-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith(
    '/workouts/approved-a/status',
    undefined,
    { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) },
  ));
});

test('C02 access center queries tenant-scoped credentials/devices and requires confirmation to revoke', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-access')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-access'));
  await waitFor(() => expect(view.getByText('Catraca principal')).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/access/credentials');
  expect(mockApi).toHaveBeenCalledWith('/access/devices');
  expect(view.getByTestId('access-revoke-cred-a')).toBeTruthy();
  expect(view.queryByTestId('access-revoke-cred-b')).toBeNull();

  fireEvent.press(view.getByTestId('access-revoke-cred-a'));
  expect(view.getByTestId('access-revoke-confirm-cred-a')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/access/credentials/cred-a/revoke', expect.anything(), expect.anything());

  fireEvent.press(view.getByTestId('access-revoke-confirm-cred-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith(
    '/access/credentials/cred-a/revoke', undefined, { method: 'PATCH' },
  ));
});

test('C02 reception access cannot query owner/manager device administration', async () => {
  currentRole = 'RECEPTION';
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-access')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-access'));
  await waitFor(() => expect(view.getByText('Credenciais dos alunos')).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/access/credentials');
  expect(mockApi).not.toHaveBeenCalledWith('/access/devices');
  expect(view.queryByText('Dispositivos de acesso')).toBeNull();
});
