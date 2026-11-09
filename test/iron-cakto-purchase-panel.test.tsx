import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SaasBillingPanel, validCaktoCheckout } from '../src/components/SaasBillingPanel';

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
