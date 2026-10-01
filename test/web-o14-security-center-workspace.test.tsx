import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccountSecurityPanel } from '../src/components/AccountSecurityPanel';

const mockApi = jest.fn();
const mockLogout = jest.fn(async () => undefined);
const mockRefreshProfile = jest.fn(async () => undefined);
let mockProfile: any = {
  id: 'owner-a',
  email: 'owner@example.com',
  mfaEnabled: false,
};

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    logout: mockLogout,
    refreshProfile: mockRefreshProfile,
  }),
}));

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('O14 AccountSecurityPanel', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockLogout.mockClear();
    mockRefreshProfile.mockClear();
    mockProfile = {
      id: 'owner-a',
      email: 'owner@example.com',
      mfaEnabled: false,
    };
    mockApi.mockImplementation(async (path: string, _legacy?: unknown, options?: any) => {
      if (path === '/auth/sessions') {
        return [{
          id: 'session-current',
          activeGymId: 'gym-a',
          createdAt: '2026-09-30T10:00:00.000Z',
          lastUsedAt: '2026-09-30T18:00:00.000Z',
          expiresAt: '2026-10-01T18:00:00.000Z',
          absoluteExpiresAt: '2026-10-10T18:00:00.000Z',
          revokedAt: null,
          current: true,
          active: true,
        }, {
          id: 'session-other',
          activeGymId: 'gym-a',
          createdAt: '2026-09-29T10:00:00.000Z',
          lastUsedAt: '2026-09-29T18:00:00.000Z',
          expiresAt: '2026-10-01T18:00:00.000Z',
          absoluteExpiresAt: '2026-10-09T18:00:00.000Z',
          revokedAt: null,
          current: false,
          active: true,
        }];
      }
      if (options?.method === 'POST') return {};
      throw new Error('Unexpected route: ' + path);
    });
  });

  test('shows premium security summary and formatted session facts', async () => {
    const view = render(<AccountSecurityPanel />);

    await waitFor(() => expect(view.getByTestId('security-center')).toBeTruthy());
    expect(view.getByText('Segurança da conta')).toBeTruthy();
    expect(view.getByText('owner@example.com')).toBeTruthy();
    expect(view.getByText('Desativada')).toBeTruthy();

    fireEvent.press(view.getByTestId('security-tab-sessions'));
    await waitFor(() => expect(view.getByText('Sessão atual')).toBeTruthy());
    expect(view.getByText('Outra sessão')).toBeTruthy();
    expect(view.getAllByText(/30\/09\/2026/).length).toBeGreaterThan(0);
  });

  test('revokes other sessions with canonical step-up payload', async () => {
    const view = render(<AccountSecurityPanel />);

    await waitFor(() => expect(view.getByTestId('security-tab-sessions')).toBeTruthy());
    fireEvent.changeText(view.getByLabelText('Senha atual'), 'fixture-step');
    fireEvent.press(view.getByTestId('security-tab-sessions'));
    await waitFor(() => expect(view.getByText('Outra sessão')).toBeTruthy());
    fireEvent.press(view.getByTestId('security-revoke-others'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/auth/sessions/revoke-others',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const call = mockApi.mock.calls.find(([path]) => path === '/auth/sessions/revoke-others');
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toEqual({
      currentPassword: 'fixture-step',
    });
  });

  test('MFA setup and confirmation preserve one-time recovery flow', async () => {
    mockApi.mockImplementation(async (path: string, _legacy?: unknown, options?: any) => {
      if (path === '/auth/sessions') return [];
      if (path === '/auth/mfa/setup' && options?.method === 'POST') {
        return {
          secret: 'FIXTURE-SETUP',
          otpauthUri: 'otpauth://totp/IRON:test',
        };
      }
      if (path === '/auth/mfa/confirm' && options?.method === 'POST') {
        return { recoveryCodes: ['FIXTURE-A', 'FIXTURE-B'] };
      }
      throw new Error('Unexpected route: ' + path);
    });

    const view = render(<AccountSecurityPanel />);
    await waitFor(() => expect(view.getByTestId('security-tab-mfa')).toBeTruthy());

    fireEvent.changeText(view.getByLabelText('Senha atual'), 'fixture-step');
    fireEvent.press(view.getByTestId('security-tab-mfa'));
    fireEvent.press(view.getByTestId('security-mfa-setup'));

    await waitFor(() => expect(view.getByTestId('security-mfa-enrollment')).toBeTruthy());
    fireEvent.changeText(view.getByLabelText('Código do autenticador'), '123456');
    fireEvent.press(view.getByText('Confirmar MFA'));

    await waitFor(() => expect(view.getByText('FIXTURE-A')).toBeTruthy());
    expect(view.getByText('FIXTURE-B')).toBeTruthy();
    expect(mockRefreshProfile).toHaveBeenCalled();
  });
});
