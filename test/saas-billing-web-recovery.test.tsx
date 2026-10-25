import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { readFile } from 'node:fs/promises';
import { SaasBillingPanel } from '../src/components/SaasBillingPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));

const authority = {
  billingAuthority: 'FM_COMMAND', productCode: 'IRON_FIT_CORE',
  localMutationsEnabled: false, providerWebhooksAccepted: false,
  mode: 'COMMAND_CENTRALIZED',
};
const state = {
  agreement: {
    status: 'ACTIVE', nextBillingAt: '2026-11-20T12:00:00.000Z',
    price: { planVersion: { productPlan: { name: 'IRON Profissional' } } },
  },
  invoices: [{
    id: 'invoice-a', status: 'PAID', amountDueMinor: 10900,
    amountPaidMinor: 10900, currency: 'BRL', dueAt: '2026-10-20T12:00:00.000Z',
  }],
  authority,
  projection: 'LEGACY_READ_ONLY',
};

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return state;
    throw new Error('Rota inesperada: ' + path);
  });
});

test('C03 IRON billing is read-only under proven FM Command authority, with no obsolete checkout action', async () => {
  const view = render(<SaasBillingPanel />);
  await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/saas-billing/authority');
  expect(mockApi).toHaveBeenCalledWith('/saas-billing/current');
  expect(mockApi.mock.calls.some(([path]) => path === '/saas-billing/prices' || path === '/saas-billing/checkout' ||
    path === '/saas-billing/change-plan' || path === '/saas-billing/cancel')).toBe(false);
  expect(view.queryByTestId('saas-billing-cancel-period-end')).toBeNull();
  expect(view.queryByTestId('saas-billing-open-checkout')).toBeNull();
  expect(view.getByText(/não podem ser executados pelo antigo billing local/)).toBeTruthy();
});

test('C03 translates historical invoice and agreement, preserving minor units and not exposing raw JSON', async () => {
  const view = render(<SaasBillingPanel />);
  await waitFor(() => expect(view.getByText('IRON Profissional')).toBeTruthy());
  expect(view.getByTestId('saas-billing-state')).toBeTruthy();
  expect(view.getByText('R$ 109,00') || view.getByText('R$ 109,00')).toBeTruthy();
  expect(view.getByText(/Histórico local de leitura/)).toBeTruthy();
  expect(view.queryByText('LEGACY_READ_ONLY')).toBeNull();
  expect(view.queryByText('FM_COMMAND')).toBeNull();
  expect(view.queryByText('invoice-a')).toBeNull();
});

test('C03 missing authority or conflicting backend status fails closed and does not show legacy projection', async () => {
  mockApi.mockImplementation(async (path: string) => path === '/saas-billing/authority'
    ? { ...authority, localMutationsEnabled: true } : state);
  const view = render(<SaasBillingPanel />);
  await waitFor(() => expect(view.getByTestId('saas-billing-authority-error')).toBeTruthy());
  expect(view.queryByTestId('saas-billing-command-authority')).toBeNull();
  expect(view.queryByText('IRON Profissional')).toBeNull();
});

test('C03 billing refresh performs only canonical GET queries and notifies the commercial shell', async () => {
  const onChanged = jest.fn(async () => undefined);
  const view = render(<SaasBillingPanel onCommercialStateChanged={onChanged} />);
  await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());
  fireEvent.press(view.getByTestId('saas-billing-refresh'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(mockApi.mock.calls.filter(([path]) => path === '/saas-billing/current')).toHaveLength(2);
  expect(mockApi.mock.calls.filter(([path]) => path === '/saas-billing/authority')).toHaveLength(2);
  expect(mockApi.mock.calls.some(([, , opts]) => opts?.method === 'POST')).toBe(false);
});

test('C03 blocked subscription still exposes protected recovery and privacy without operational data', async () => {
  const source = await readFile('src/web/CommercialWebApp.tsx', 'utf8');
  expect(source).toContain("item.key === 'saasBilling' || item.key === 'security'");
  expect(source).toContain('A superfície operacional permanece fail-closed');
  expect(source).toContain('<SaasBillingPanel onCommercialStateChanged={loadShell} />');
  expect(source).toContain("key: 'saasBilling'");
  expect(source).not.toContain('blocked ? [] : modules.filter');
});
