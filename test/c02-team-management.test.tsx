import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TeamManagementPanel } from '../src/components/TeamManagementPanel';

const mockApi = jest.fn();
const mockReload = jest.fn(async () => undefined);
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(15000);
const members = [
  { id: 'reception-a', name: 'Ana', email: 'ana@example.test', roleName: 'RECEPTION', accountActive: true,
    membershipActive: true, canManage: true, permissions: ['student.read', 'schedule.read'] },
  { id: 'owner-a', name: 'Proprietário', email: 'owner@example.test', roleName: 'OWNER', accountActive: true,
    membershipActive: true, canManage: false, permissions: ['financial.read'] },
];

beforeEach(() => {
  mockApi.mockReset(); mockReload.mockClear();
  mockApi.mockResolvedValue({ invitation: { accepted: true, delivery: 'PASSWORD_SETUP_EMAIL' } });
});

test('C02 team invites staff through canonical invite without an initial password or tenant spoof', async () => {
  const screen = render(<TeamManagementPanel members={members} actorRoles={['OWNER']} onUpdated={mockReload} />);
  fireEvent.changeText(screen.getByTestId('team-invite-name'), 'Carlos');
  fireEvent.changeText(screen.getByTestId('team-invite-email'), 'CARLOS@EXAMPLE.TEST');
  fireEvent.press(screen.getByTestId('team-invite-role-TRAINER'));
  fireEvent.press(screen.getByTestId('team-invite-submit'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/users/invite', undefined, expect.objectContaining({ method: 'POST' })));
  const [, , options] = mockApi.mock.calls[0];
  expect(JSON.parse(options.body)).toEqual({ name: 'Carlos', email: 'carlos@example.test', roleName: 'TRAINER' });
  expect(JSON.parse(options.body)).not.toHaveProperty('password');
  expect(JSON.parse(options.body)).not.toHaveProperty('gymId');
  expect(screen.getByText(/Convite solicitado/)).toBeTruthy();
  expect(mockReload).toHaveBeenCalledTimes(1);
});

test('C02 managers cannot assign MANAGER or edit owner membership even if frontend receives owner read model', async () => {
  const screen = render(<TeamManagementPanel members={members} actorRoles={['MANAGER']} onUpdated={mockReload} />);
  expect(screen.queryByTestId('team-invite-role-MANAGER')).toBeNull();
  expect(screen.queryByTestId('team-role-save-owner-a')).toBeNull();
  expect(screen.queryByTestId('team-status-toggle-owner-a')).toBeNull();
  expect(screen.getByText('student.read')).toBeTruthy();
  expect(screen.getByTestId('team-role-choice-reception-a-TRAINER')).toBeTruthy();
  expect(screen.getByText(/Financeiro, assinatura IRON/)).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalled();
});

test('C02 changing role requires confirmation and only sends one allowed role', async () => {
  const screen = render(<TeamManagementPanel members={members} actorRoles={['OWNER']} onUpdated={mockReload} />);
  fireEvent.press(screen.getByTestId('team-role-choice-reception-a-TRAINER'));
  fireEvent.press(screen.getByTestId('team-role-save-reception-a'));
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('team-role-confirm-reception-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/users/reception-a/membership/role', undefined,
    { method: 'PATCH', body: JSON.stringify({ roleName: 'TRAINER' }) }));
  expect(mockReload).toHaveBeenCalledTimes(1);
});

test('C02 deactivating membership is an explicit guarded PATCH', async () => {
  const screen = render(<TeamManagementPanel members={members} actorRoles={['OWNER']} onUpdated={mockReload} />);
  fireEvent.press(screen.getByTestId('team-status-toggle-reception-a'));
  expect(mockApi).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('team-status-confirm-reception-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/users/reception-a/membership/status', undefined,
    { method: 'PATCH', body: JSON.stringify({ active: false }) }));
});

test('C02 backend operation failure preserves membership controls and shows error without success claim', async () => {
  mockApi.mockRejectedValue(new Error('Acesso negado'));
  const screen = render(<TeamManagementPanel members={members} actorRoles={['OWNER']} onUpdated={mockReload} />);
  fireEvent.press(screen.getByTestId('team-status-toggle-reception-a'));
  fireEvent.press(screen.getByTestId('team-status-confirm-reception-a'));
  await waitFor(() => expect(screen.getByText('Acesso negado')).toBeTruthy());
  expect(mockReload).not.toHaveBeenCalled();
  expect(screen.queryByTestId('team-notice')).toBeNull();
});
