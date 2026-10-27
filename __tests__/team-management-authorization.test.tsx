import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockApi = jest.fn(async () => ({ invitation: { accepted: true } }));
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(args[0], args[1], args[2]) }));
import { TeamManagementPanel } from '../src/components/TeamManagementPanel';

beforeEach(() => { mockApi.mockClear(); });

test('non-manager cannot invite or change a tenant member even if panel is mounted', () => {
  const view = render(<TeamManagementPanel members={[{
    id: 'member-1', name: 'Trainer', email: 'trainer@example.com',
    roleName: 'TRAINER', membershipActive: true, canManage: true,
  }]} actorRoles={['RECEPTION']} onUpdated={async () => undefined} />);
  fireEvent.changeText(view.getByTestId('team-invite-name'), 'Wrong Actor');
  fireEvent.changeText(view.getByTestId('team-invite-email'), 'wrong@example.com');
  fireEvent.press(view.getByTestId('team-invite-submit'));
  expect(view.queryByTestId('team-status-toggle-member-1')).toBeNull();
  expect(view.queryByTestId('team-role-save-member-1')).toBeNull();
  expect(mockApi).not.toHaveBeenCalled();
});

test('manager never receives MANAGER as an invite option', async () => {
  const view = render(<TeamManagementPanel members={[]} actorRoles={['MANAGER']} onUpdated={async () => undefined} />);
  expect(view.queryByTestId('team-invite-role-MANAGER')).toBeNull();
  expect(view.getByTestId('team-invite-role-RECEPTION')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('team-invite-name'), 'Recepção');
  fireEvent.changeText(view.getByTestId('team-invite-email'), 'recepcao@example.com');
  fireEvent.press(view.getByTestId('team-invite-role-RECEPTION'));
  fireEvent.press(view.getByTestId('team-invite-submit'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/users/invite', undefined, expect.objectContaining({
    method: 'POST', body: JSON.stringify({ name: 'Recepção', email: 'recepcao@example.com', roleName: 'RECEPTION' }),
  })));
});
