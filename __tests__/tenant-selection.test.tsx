import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockSelectTenant = jest.fn(async () => ({ requiresTenantSelection: false, requiresMfa: false }));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    pendingTenantSelection: {
      email: 'student@example.test',
      password: 'secret',
      tenants: [
        { id: 'gym-a', name: 'Iron Fit Centro' },
        { id: 'gym-b', name: 'Iron Fit Norte' },
      ],
    },
    selectTenant: mockSelectTenant,
    cancelTenantSelection: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import { TenantSelectionScreen } from '../src/screens/TenantSelectionScreen';

test('renders tenants and dispatches the selected gymId', async () => {
  const view = render(<TenantSelectionScreen />);
  expect(view.getByText('Iron Fit Centro')).toBeTruthy();
  expect(view.getByText('Iron Fit Norte')).toBeTruthy();
  fireEvent.press(view.getByTestId('tenant-gym-b'));
  fireEvent.press(view.getByTestId('tenant-confirm'));
  await waitFor(() =>
    expect(mockSelectTenant).toHaveBeenCalledWith('gym-b', undefined, undefined),
  );
});
