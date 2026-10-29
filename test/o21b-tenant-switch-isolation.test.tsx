import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

let mockActiveTenantId = 'gym-a';
const mockLogout = jest.fn(async () => undefined);
const mockApi = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'owner-1', name: 'Proprietário', email: 'owner@example.test', roles: ['OWNER'], permissions: [] },
    activeTenantId: mockActiveTenantId,
    logout: mockLogout,
  }),
}));
jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { CommercialWebApp } from '../src/web/CommercialWebApp';

beforeEach(() => {
  mockActiveTenantId = 'gym-a';
  mockApi.mockReset();
  mockLogout.mockClear();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/product-entitlements/tenant/features') return [];
    if (path === '/product-entitlements/tenant/current')
      return mockActiveTenantId === 'gym-a' ? { id: 'sub-a', status: 'ACTIVE' } : null;
    if (path === '/commercial/trial/status') return { status: 'TRIALING' };
    if (path === '/commercial/onboarding') return { status: 'COMPLETED' };
    if (path === '/auth/step-up/status') return { active: false, expiresAt: null };
    if (path === '/users') return [{ id: 'member-a', name: 'Professor da academia A', roleName: 'TRAINER', canManage: true }];
    return [];
  });
});

test('O21B ao trocar academia revoga o shell anterior, dados da equipe e licença do tenant anterior', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByText('Professor da academia A')).toBeTruthy());

  mockActiveTenantId = 'gym-b';
  view.rerender(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('subscription-blocked')).toBeTruthy());
  expect(view.queryByText('Professor da academia A')).toBeNull();
  expect(view.queryByTestId('nav-team')).toBeNull();
  expect(mockApi.mock.calls.filter(([path]) => path === '/product-entitlements/tenant/current').length).toBeGreaterThanOrEqual(2);
});

test('O21B resposta atrasada do tenant antigo não reabre acesso após a troca', async () => {
  let resolveOld: ((value: unknown) => void) | undefined;
  const original = mockApi.getMockImplementation();
  mockApi.mockImplementation((path: string, ...args: unknown[]) => {
    if (path === '/product-entitlements/tenant/features' && mockActiveTenantId === 'gym-a') {
      return new Promise((resolve) => { resolveOld = resolve; });
    }
    return original?.(path, ...args);
  });
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(resolveOld).toBeDefined());

  mockActiveTenantId = 'gym-b';
  view.rerender(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('subscription-blocked')).toBeTruthy());

  await act(async () => {
    resolveOld?.([{ featureKey: 'content.tenant_private', kind: 'FEATURE', value: true, source: 'PLAN' }]);
  });
  await waitFor(() => expect(view.queryByTestId('nav-creator')).toBeNull());
  expect(view.queryByTestId('nav-team')).toBeNull();
});

test('O21B billing bloqueado exige navegação e step-up, sem consulta antes da autorização', async () => {
  mockActiveTenantId = 'gym-b';
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('subscription-blocked')).toBeTruthy());
  expect(view.queryByTestId('saas-billing-panel')).toBeNull();
  expect(view.getByText('Acesso comercial limitado')).toBeTruthy();
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/saas-billing/'))).toBe(false);
  fireEvent.press(view.getByTestId('nav-saasBilling'));
  await waitFor(() => expect(view.getByText('Acesso administrativo protegido')).toBeTruthy());
  expect(view.queryByTestId('saas-billing-panel')).toBeNull();
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/saas-billing/'))).toBe(false);
});


test('O21B troca de academia descarta elevação administrativa e formulários', async () => {
  const original = mockApi.getMockImplementation();
  mockApi.mockImplementation((path: string, ...args: unknown[]) => {
    if (path === '/product-entitlements/tenant/current') return Promise.resolve({ status: 'ACTIVE' });
    if (path === '/auth/step-up/status') return Promise.resolve({
      active: mockActiveTenantId === 'gym-a',
      expiresAt: mockActiveTenantId === 'gym-a' ? new Date(Date.now() + 60000).toISOString() : null,
    });
    return original?.(path, ...args);
  });
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-financial'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/financial/accounts')).toBe(true));
  mockApi.mockClear();
  mockActiveTenantId = 'gym-b';
  view.rerender(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-financial'));
  await waitFor(() => expect(view.getByText('Acesso administrativo protegido')).toBeTruthy());
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/'))).toBe(false);
});
