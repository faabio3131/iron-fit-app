import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

let mockProfile: any = {
  id: 'owner-1',
  name: 'Proprietário QA',
  email: 'owner@example.com',
  roles: ['OWNER'],
  permissions: [],
};
let mockFeatureSet: any[] = [];
const mockLogout = jest.fn(async () => undefined);
const mockApi = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    activeTenantId: 'gym-1',
    logout: mockLogout,
  }),
}));
jest.mock('../src/services/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

import { CommercialWebApp } from '../src/web/CommercialWebApp';

function installApi() {
  mockApi.mockImplementation(async (path: string, _query?: unknown, options?: { method?: string; body?: string }) => {
    if (path === '/product-entitlements/tenant/features') return mockFeatureSet;
    if (path === '/product-entitlements/tenant/current') return { id: 'sub-1', status: 'ACTIVE' };
    if (path === '/commercial/trial/status') return { status: 'TRIALING', subscriptionId: 'sub-1' };
    if (path === '/commercial/onboarding') return { status: 'COMPLETED', completedSteps: ['FINISH'], nextStep: null };
    if (path === '/dashboard/summary') return { students: { total: 2, active: 2 }, workouts: { approved: 1 }, charges: { pending: 0, overdue: 0 }, revenue: { thisMonth: 10000 } };
    if (path.startsWith('/dashboard/revenue')) return [];
    if (path.startsWith('/dashboard/attendance')) return [];
    if (path === '/dashboard/overdue') return [];
    if (path.startsWith('/dashboard/birthdays')) return [];
    if (path === '/gyms/gym-1') return { id: 'gym-1', name: 'Academia QA' };
    if (path === '/users' && options?.method === 'POST') return { id: 'member-1', name: 'Professor QA', email: 'professor@example.com' };
    if (path === '/users') return [];
    if (path === '/creator-network/content/tenant/items') return [];
    if (path === '/creator-network/operations/tenant/overview') return { status: 'ACTIVE', total: 0 };
    if (path.startsWith('/creator-network/operations/tenant/analytics')) return { views: 0, total: 0 };
    throw new Error(`Rota não simulada: ${path}`);
  });
}

beforeEach(() => {
  mockProfile = {
    id: 'owner-1',
    name: 'Proprietário QA',
    email: 'owner@example.com',
    roles: ['OWNER'],
    permissions: [],
  };
  mockFeatureSet = [];
  mockApi.mockReset();
  mockLogout.mockClear();
  installApi();
});

test('botão Adicionar à equipe explica validação e executa cadastro válido', async () => {
  const view = render(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByTestId('team-add')).toBeTruthy());

  fireEvent.press(view.getByTestId('team-add'));
  expect(view.getByText('Informe o nome do membro da equipe.')).toBeTruthy();

  fireEvent.changeText(view.getByLabelText('Nome'), 'Professor QA');
  fireEvent.changeText(view.getByLabelText('E-mail'), 'professor@example.com');
  fireEvent.changeText(view.getByLabelText('Senha inicial'), 'Senha-Forte-2026!');
  fireEvent.press(view.getByTestId('team-add'));

  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/users' && options?.method === 'POST');
    expect(call).toBeTruthy();
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body).toMatchObject({
      name: 'Professor QA',
      email: 'professor@example.com',
      roleName: 'TRAINER',
    });
  }, { timeout: 12000 });
}, 15000);

test('perfil de recepção não recebe superfícies administrativas sensíveis', async () => {
  mockProfile = {
    id: 'reception-1',
    name: 'Recepção QA',
    email: 'recepcao@example.com',
    roles: ['RECEPTION'],
    permissions: [],
  };

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-overview')).toBeTruthy());

  expect(view.queryByTestId('nav-team')).toBeNull();
  expect(view.queryByTestId('nav-financial')).toBeNull();
  expect(view.queryByTestId('nav-saasBilling')).toBeNull();
  expect(view.queryByTestId('nav-entitlements')).toBeNull();
  expect(view.queryByTestId('nav-integrations')).toBeNull();

  await waitFor(() => {
    expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/dashboard/revenue'))).toBe(false);
    expect(mockApi.mock.calls.some(([path]) => path === '/dashboard/overdue')).toBe(false);
  });
});

test('Creator Network usa descrições em português e superfície compacta', async () => {
  mockFeatureSet = [
    { featureKey: 'content.tenant_private', kind: 'FEATURE', value: true, source: 'PLAN' },
  ];
  const view = render(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('nav-creator')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-creator'));

  await waitFor(() => expect(view.getByText('Indicadores')).toBeTruthy());
  expect(view.getAllByText('Visão geral').length).toBeGreaterThan(0);
  expect(view.getAllByText('Conteúdo').length).toBeGreaterThan(0);
  expect(view.queryByText('Analytics')).toBeNull();
  expect(view.getByText(/Conteúdo, utilização e desempenho/)).toBeTruthy();
});
