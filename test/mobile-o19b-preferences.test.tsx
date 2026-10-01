import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../src/screens/ProfileScreen';

const mockApi = jest.fn();
const mockLogout = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      name: 'Aluno A',
      email: 'aluno@example.com',
      status: 'ACTIVE',
      roles: ['STUDENT'],
      gym: { name: 'Academia A' },
    },
    activeTenantId: 'gym-a',
    logout: mockLogout,
  }),
}));

describe('O19B student communication preferences', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockLogout.mockReset();
  });

  test('loads self-service preferences and keeps consent-gated channels disabled', async () => {
    mockApi.mockResolvedValue({
      consentComm: false,
      configured: false,
      pushEnabled: true,
      inAppEnabled: true,
      emailEnabled: false,
      whatsappEnabled: false,
      trainingReminders: true,
      paymentReminders: true,
      marketing: false,
    });

    const view = render(<ProfileScreen />);

    await waitFor(() => expect(view.getByText('Preferências de comunicação')).toBeTruthy());
    expect(view.getByText(/consentimento para comunicações está desativado/i)).toBeTruthy();
    expect(view.getByTestId('preference-whatsappEnabled').props.disabled).toBe(true);
    expect(view.getByTestId('preference-marketing').props.disabled).toBe(true);
  });

  test('updates only the selected preference through /me/preferences', async () => {
    mockApi.mockImplementation(async (path: string, _legacy?: unknown, options?: any) => {
      if (path === '/me/preferences' && !options) {
        return {
          consentComm: true,
          configured: true,
          pushEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          whatsappEnabled: true,
          trainingReminders: true,
          paymentReminders: true,
          marketing: false,
        };
      }
      if (path === '/me/preferences' && options?.method === 'PATCH') {
        return {
          consentComm: true,
          configured: true,
          pushEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          whatsappEnabled: true,
          trainingReminders: false,
          paymentReminders: true,
          marketing: false,
        };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<ProfileScreen />);
    await waitFor(() => expect(view.getByTestId('preference-trainingReminders')).toBeTruthy());

    fireEvent(view.getByTestId('preference-trainingReminders'), 'valueChange', false);

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/me/preferences',
        undefined,
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );

    const call = mockApi.mock.calls.find(
      ([path, _legacy, options]) => path === '/me/preferences' && options?.method === 'PATCH',
    );
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toEqual({
      trainingReminders: false,
    });
  });
});
