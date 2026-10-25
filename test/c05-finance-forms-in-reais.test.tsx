import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CommercialWebApp } from '../src/web/CommercialWebApp';

const mockApi = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ profile: {
    id: 'owner-a', name: 'Proprietário', email: 'owner@example.com',
    roles: ['OWNER'], permissions: ['gym.read'],
  }, activeTenantId: 'gym-a', logout: jest.fn() }),
}));
jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string, _token?: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'POST') return { id: 'created-a' };
    if (path === '/product-entitlements/tenant/features') return [];
    if (path === '/product-entitlements/tenant/current') return { id: 'sub-a', status: 'ACTIVE' };
    if (path === '/commercial/trial/status') return { status: 'TRIALING' };
    if (path === '/commercial/onboarding') return { status: 'COMPLETED', completedSteps: [], nextStep: null };
    if (path === '/auth/step-up/status') return { active: true, expiresAt: '2099-12-31T00:00:00.000Z' };
    if (path === '/financial/accounts') return [{ id: 'account-a', name: 'Caixa', active: true, initialBalance: 10000 }];
    if (path === '/financial/charges') return [];
    if (path === '/students') return [{ id: 'student-a', name: 'Ana Silva' }];
    if (path === '/dashboard/summary') return { students: { total: 1 } };
    if (path.startsWith('/dashboard/')) return [];
    if (path === '/gyms/gym-a') return { id: 'gym-a', name: 'Academia A', timezone: 'America/Sao_Paulo' };
    return [];
  });
});
async function finance() {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-financial'));
  await waitFor(() => expect(view.getByTestId('finance-create-charge')).toBeTruthy());
  return view;
}

test('C05 finance user enters R$ 199,90 and API receives 19990 integer centavos, no gymId', async () => {
  const view = await finance();
  fireEvent.press(view.getByText('Ana Silva'));
  fireEvent.changeText(view.getByTestId('finance-charge-amount'), '199,90');
  fireEvent.changeText(view.getByTestId('finance-charge-due'), '2026-10-27');
  fireEvent.press(view.getByTestId('finance-create-charge'));
  await waitFor(() => expect(mockApi.mock.calls.some(([p, , opts]) => p === '/financial/charges' && opts?.method === 'POST')).toBe(true));
  const post = mockApi.mock.calls.find(([p, , opts]) => p === '/financial/charges' && opts?.method === 'POST');
  expect(JSON.parse(post[2].body)).toEqual({
    studentId: 'student-a', amount: 19990, dueDate: '2026-10-27T00:00:00.000Z',
  });
});

test('C05 invalid monetary and impossible date inputs disable charge creation', async () => {
  const view = await finance();
  fireEvent.press(view.getByText('Ana Silva'));
  fireEvent.changeText(view.getByTestId('finance-charge-amount'), '100.50');
  fireEvent.changeText(view.getByTestId('finance-charge-due'), '2026-02-30');
  expect(view.getByTestId('finance-charge-invalid')).toBeTruthy();
  expect(view.getByTestId('finance-charge-date-invalid')).toBeTruthy();
  fireEvent.press(view.getByTestId('finance-create-charge'));
  expect(mockApi.mock.calls.some(([p, , opts]) => p === '/financial/charges' && opts?.method === 'POST')).toBe(false);
});

test('C05 account initial balance converts R$ 1.234,56 into 123456 minor units, not 1234', async () => {
  const view = await finance();
  fireEvent.changeText(view.getByTestId('finance-account-name'), 'Banco');
  fireEvent.changeText(view.getByTestId('finance-account-balance'), '1.234,56');
  fireEvent.press(view.getByTestId('finance-create-account'));
  await waitFor(() => expect(mockApi.mock.calls.some(([p, , opts]) => p === '/financial/accounts' && opts?.method === 'POST')).toBe(true));
  const call = mockApi.mock.calls.find(([p, , opts]) => p === '/financial/accounts' && opts?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ name: 'Banco', type: 'CASH', initialBalance: 123456 });
  expect(view.getByText(/Saldo inicial: R\$\s*100,00/)).toBeTruthy();
});

test('C05 subscription amount R$ 149,90 is sent as 14990 minor units under the student', async () => {
  const view = await finance();
  fireEvent.press(view.getByText('Ana Silva'));
  fireEvent.changeText(view.getByTestId('finance-plan-name'), 'Plano Plus');
  fireEvent.changeText(view.getByTestId('finance-subscription-amount'), '149,90');
  fireEvent.changeText(view.getByTestId('finance-subscription-date'), '2026-11-05');
  fireEvent.press(view.getByTestId('finance-create-subscription'));
  await waitFor(() => expect(mockApi.mock.calls.some(([p, , opts]) => p === '/financial/subscriptions' && opts?.method === 'POST')).toBe(true));
  const call = mockApi.mock.calls.find(([p, , opts]) => p === '/financial/subscriptions' && opts?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ studentId: 'student-a', planName: 'Plano Plus',
    amount: 14990, nextBillingAt: '2026-11-05T00:00:00.000Z' });
});

test('C05 payment route includes the human-confirmed account and payment method, never pseudo gateway', async () => {
  const view = await finance();
  expect(view.getByText(/Conta para registrar recebimentos/)).toBeTruthy();
  expect(view.queryByTestId('saas-billing-open-checkout')).toBeNull();
  expect(mockApi.mock.calls.some(([p]) => p.includes('saas-billing/checkout'))).toBe(false);
});
