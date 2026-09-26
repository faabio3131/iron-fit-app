import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const originalPlatformOs = Object.getOwnPropertyDescriptor(Platform, 'OS');
Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('../App').default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearSession } = require('../src/storage/token-storage') as typeof import('../src/storage/token-storage');

const API_ROOT = 'https://example.invalid/api/v1';
const stored = new Map<string, string>();
const sessionStorageMock = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
  removeItem: (key: string) => { stored.delete(key); },
};
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorageMock });

function response(status: number, payload: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    text: async () => payload == null ? '' : JSON.stringify(payload),
  } as Response);
}

function installCommercialFetch() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.startsWith(API_ROOT) ? url.slice(API_ROOT.length) : url;

    if (path === '/commercial/trial/start') return response(201, {
      userId: 'owner-1', gymId: 'gym-1', subscriptionId: 'sub-1',
      trialEndsAt: '2026-10-10T00:00:00.000Z', idempotentReplay: false,
    });
    if (path === '/auth/login') return response(200, {
      access_token: 'web-access', refresh_token: 'web-refresh', requires_tenant_selection: false,
      user: { id: 'owner-1', name: 'Owner Web', email: 'owner@example.com', roles: ['OWNER'], permissions: ['gym.read'], gymId: 'gym-1', activeGymId: 'gym-1', isSuperAdmin: false, scope: 'tenant' },
    });
    if (path === '/auth/me') return response(200, {
      id: 'owner-1', name: 'Owner Web', email: 'owner@example.com', roles: ['OWNER'], permissions: ['gym.read'], gymId: 'gym-1', activeGymId: 'gym-1', isSuperAdmin: false, scope: 'tenant',
    });
    if (path === '/product-entitlements/tenant/features') return response(200, []);
    if (path === '/product-entitlements/tenant/current') return response(200, { id: 'sub-1', status: 'ACTIVE' });
    if (path === '/commercial/trial/status') return response(200, { status: 'TRIALING', subscriptionId: 'sub-1' });
    if (path === '/commercial/onboarding') return response(200, { status: 'NOT_STARTED', completedSteps: [], nextStep: 'ACADEMY_PROFILE' });
    if (path === '/dashboard/summary') return response(200, { students: { total: 0 }, charges: { pending: 0 } });
    if (path.startsWith('/dashboard/revenue')) return response(200, []);
    if (path.startsWith('/dashboard/attendance')) return response(200, []);
    if (path === '/dashboard/overdue') return response(200, []);
    if (path.startsWith('/dashboard/birthdays')) return response(200, []);
    if (path === '/gyms/gym-1') return response(200, { id: 'gym-1', name: 'Academia Web', timezone: 'America/Sao_Paulo', active: true });
    return response(404, { message: `Unhandled commercial Web route: ${path}` });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterAll(() => {
  if (originalPlatformOs) Object.defineProperty(Platform, 'OS', originalPlatformOs);
});

beforeEach(async () => {
  stored.clear();
  await clearSession();
});

test('visitor creates trial, authenticates and reaches tenant-scoped commercial Web', async () => {
  const fetchMock = installCommercialFetch();
  const view = render(<App />);

  await waitFor(() => expect(view.getByTestId('start-trial')).toBeTruthy());
  fireEvent.press(view.getByTestId('start-trial'));
  fireEvent.changeText(view.getByTestId('trial-name'), 'Owner Web');
  fireEvent.changeText(view.getByTestId('trial-gym-name'), 'Academia Web');
  fireEvent.changeText(view.getByTestId('trial-email'), 'OWNER@EXAMPLE.COM');
  fireEvent.changeText(view.getByTestId('trial-password'), 'senha-segura');
  fireEvent.press(view.getByTestId('trial-submit'));

  await waitFor(() => expect(view.getByTestId('login-notice')).toBeTruthy());
  fireEvent.changeText(view.getByTestId('login-password'), 'senha-segura');
  fireEvent.press(view.getByTestId('login-submit'));

  await waitFor(() => expect(view.getByTestId('commercial-web-app')).toBeTruthy());
  await waitFor(() => expect(view.getByText('Academia Web')).toBeTruthy());

  const trialCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/commercial/trial/start'));
  const trialBody = JSON.parse(String(trialCall?.[1]?.body ?? '{}'));
  expect(trialBody.email).toBe('owner@example.com');
  expect(trialBody).not.toHaveProperty('gymId');
  expect(trialBody).not.toHaveProperty('planCode');

  const loginCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/auth/login'));
  expect(JSON.parse(String(loginCall?.[1]?.body ?? '{}'))).not.toHaveProperty('gymId');

  const persisted = stored.get('iron-fit.auth.session.v1');
  expect(persisted).toContain('web-access');
  expect(persisted).toContain('web-refresh');
});
