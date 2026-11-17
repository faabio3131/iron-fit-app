import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SaasBillingPanel, validCaktoCheckout, commercialOffersErrorMessage } from '../src/components/SaasBillingPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
const authority = {
  billingAuthority: 'FM_COMMAND', productCode: 'IRON_FIT_CORE',
  localMutationsEnabled: false, providerWebhooksAccepted: false, mode: 'COMMAND_CENTRALIZED',
};
const url = 'https://pay.cakto.com.br/offer-official?sck=fa9c7a11-5725-4495-bc16-f09a86c52d3e';
const offer = { planCode: 'IRON_PRO', name: 'IRON Pro', interval: 'monthly', amountMinor: 26900, currency: 'BRL' };
beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority, projection: 'LEGACY_READ_ONLY', invoices: [] };
    if (path === '/commercial/billing/offers') return { plans: [offer] };
    if (path === '/commercial/billing/checkout') return {
      checkoutUrl: url, provider: 'CAKTO', productCode: 'IRON_FIT_CORE', pendingConfirmation: true,
    };
    throw new Error('unexpected API path: ' + path);
  });
});

test('does not expose checkout outside OWNER purchasing mode', async () => {
  const view = render(<SaasBillingPanel />);
  await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());
  expect(view.queryByTestId('iron-cakto-buy-IRON_PRO')).toBeNull();
  expect(mockApi).not.toHaveBeenCalledWith('/commercial/billing/offers');
});

test('OWNER sees canonical offer and starts invoice-scoped Cakto checkout, no payment trust on redirect', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    const view = render(<SaasBillingPanel canPurchase />);
    await waitFor(() => expect(view.getByTestId('iron-cakto-buy-IRON_PRO')).toBeTruthy());
    expect(view.getByText(/R\$\s*269,00/)).toBeTruthy();
    fireEvent.press(view.getByTestId('iron-cakto-buy-IRON_PRO'));
    await waitFor(() => expect(open).toHaveBeenCalledWith(url));
    const checkout = mockApi.mock.calls.find(([path]) => path === '/commercial/billing/checkout');
    expect(checkout).toBeTruthy();
    expect(checkout[2].method).toBe('POST');
    const body = JSON.parse(checkout[2].body);
    expect(body.planCode).toBe('IRON_PRO');
    expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
    expect(body.amountMinor).toBeUndefined();
    expect(body.gymId).toBeUndefined();
    expect(view.getByTestId('iron-cakto-await-webhook')).toBeTruthy();
    expect(view.queryByText(/pagamento confirmado/i)).toBeNull();
  } finally { open.mockRestore(); }
});

test('invalid Cakto URL or conflicting response fails closed', async () => {
  for (const input of [
    'https://pay.cakto.com.br.evil.example/purchase?sck=fa9c7a11-5725-4495-bc16-f09a86c52d3e',
    'https://pay.cakto.com.br/offer?sck=forged',
    'http://pay.cakto.com.br/offer?sck=fa9c7a11-5725-4495-bc16-f09a86c52d3e',
    'javascript:alert(1)',
  ]) expect(validCaktoCheckout(input)).toBe(false);
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority };
    if (path === '/commercial/billing/offers') return { plans: [offer] };
    if (path === '/commercial/billing/checkout') return {
      checkoutUrl: 'https://evil.example/checkout', provider: 'CAKTO',
      productCode: 'IRON_FIT_CORE', pendingConfirmation: true,
    };
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    const view = render(<SaasBillingPanel canPurchase />);
    await waitFor(() => expect(view.getByTestId('iron-cakto-buy-IRON_PRO')).toBeTruthy());
    fireEvent.press(view.getByTestId('iron-cakto-buy-IRON_PRO'));
    await waitFor(() => expect(view.getByText(/não confirmou um checkout válido/i)).toBeTruthy());
    expect(open).not.toHaveBeenCalled();
  } finally { open.mockRestore(); }
});

test('configured commercial authority absent means no fake purchasable offers', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority };
    if (path === '/commercial/billing/offers') throw new Error('service unavailable');
  });
  const view = render(<SaasBillingPanel canPurchase />);
  await waitFor(() => expect(view.getByTestId('iron-cakto-offers-unavailable')).toBeTruthy());
  expect(view.queryByTestId('iron-cakto-buy-IRON_PRO')).toBeNull();
});

test('commercial offer failures are classified without inventing a missing plan configuration', () => {
  expect(commercialOffersErrorMessage(Object.assign(new Error('expired'), { status: 401 })))
    .toMatch(/sessão não está válida/i);
  expect(commercialOffersErrorMessage(Object.assign(new Error('step-up'), { status: 403 })))
    .toMatch(/reautenticação/i);
  expect(commercialOffersErrorMessage(Object.assign(new Error('down'), { status: 503 })))
    .toMatch(/temporariamente indisponível/i);
  expect(commercialOffersErrorMessage(new Error('INVALID_COMMERCIAL_CATALOG')))
    .toMatch(/catálogo inválido/i);
  expect(commercialOffersErrorMessage(new Error('network')))
    .toMatch(/não foi possível consultar/i);
});

test('legacy read-model absence does not imply no FM Command subscription', async () => {
  const view = render(<SaasBillingPanel canPurchase />);
  await waitFor(() => expect(view.getByTestId('saas-billing-legacy-absence')).toBeTruthy());
  expect(view.getByText(/não significa que sua academia não tenha assinatura no FM Command/i)).toBeTruthy();
  expect(view.queryByText('Não registrado')).toBeNull();
  expect(view.getByTestId('iron-cakto-buy-IRON_PRO')).toBeTruthy();
});

test('OWNER with expired step-up sees authorization reason instead of fake missing plans', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority, projection: 'LEGACY_READ_ONLY' };
    if (path === '/commercial/billing/offers')
      throw Object.assign(new Error('forbidden'), { status: 403 });
    throw new Error('Unexpected path ' + path);
  });
  const view = render(<SaasBillingPanel canPurchase />);
  await waitFor(() => expect(view.getByTestId('iron-cakto-offers-unavailable')).toBeTruthy());
  expect(view.getByText(/necessário acesso de proprietário e reautenticação/i)).toBeTruthy();
  expect(view.queryByTestId('iron-cakto-buy-IRON_PRO')).toBeNull();
});

test('OWNER sees canonical FM Command subscription and invoices instead of mistaking legacy for current', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority, projection: 'LEGACY_READ_ONLY', invoices: [] };
    if (path === '/commercial/billing/current') return {
      source: 'FM_COMMAND_CANONICAL', authority: 'FM_COMMAND',
      checkedAt: '2026-11-17T15:00:00.000Z', settlementConfirmedByThisView: false,
      subscription: { planCode: 'IRON_PRO_MONTHLY', planName: 'IRON Pro',
        interval: 'monthly', status: 'pending', paidThrough: null },
      invoices: [{ status: 'pending', amountMinor: 26900, currency: 'BRL', periodEnd: null }],
    };
    if (path === '/commercial/billing/offers') return { plans: [offer] };
    throw new Error('Unexpected path ' + path);
  });
  const view = render(<SaasBillingPanel canPurchase />);
  await waitFor(() => expect(view.getByTestId('saas-billing-canonical-plan')).toBeTruthy());
  expect(view.getByText(/IRON Pro/)).toBeTruthy();
  expect(view.getByTestId('saas-billing-canonical-status')).toBeTruthy();
  expect(view.getByText('Faturas no FM Command')).toBeTruthy();
  expect(view.queryByText('Não registrado')).toBeNull();
  expect(view.queryByTestId('saas-billing-legacy-absence')).toBeNull();
  expect(view.getByTestId('iron-cakto-buy-IRON_PRO')).toBeTruthy();
});

test('Command status mismatch fails closed with explicit warning and no fictional license', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/saas-billing/authority') return authority;
    if (path === '/saas-billing/current') return { authority, projection: 'LEGACY_READ_ONLY', invoices: [] };
    if (path === '/commercial/billing/current') return {
      source: 'FORGED_SOURCE', authority: 'FM_COMMAND', checkedAt:'2026-11-17T15:00:00.000Z',
      settlementConfirmedByThisView: true, subscription: null, invoices: [],
    };
    if (path === '/commercial/billing/offers') return { plans: [] };
    throw new Error('Unexpected path ' + path);
  });
  const view = render(<SaasBillingPanel canPurchase />);
  await waitFor(() => expect(view.getByTestId('saas-billing-command-unavailable')).toBeTruthy());
  expect(view.queryByTestId('saas-billing-canonical-status')).toBeNull();
  expect(view.queryByText(/licença ativa/i)).toBeNull();
});
