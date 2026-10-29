import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SaasBillingPanel } from '../src/components/SaasBillingPanel';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

const authority = {
  billingAuthority: 'FM_COMMAND',
  productCode: 'IRON_FIT_CORE',
  localMutationsEnabled: false,
  providerWebhooksAccepted: false,
  mode: 'COMMAND_CENTRALIZED',
};

const prices = [
  {
    id: 'price-pro',
    priceCode: 'IRON_PRO_MONTHLY_INTERNAL',
    currency: 'BRL',
    amountMinor: 14990,
    interval: 'MONTHLY',
    planVersion: {
      version: 2,
      productPlan: { code: 'IRON_PRO', name: 'IRON Pro' },
    },
  },
];

const current = {
  agreement: {
    id: 'agreement-a',
    status: 'PAST_DUE',
    nextBillingAt: '2026-10-05T00:00:00.000Z',
    pastDueSince: '2026-09-20T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    price: prices[0],
  },
  invoices: [
    {
      id: 'invoice-a',
      status: 'PAID',
      amountDueMinor: 14990,
      amountPaidMinor: 14990,
      currency: 'BRL',
      dueAt: '2026-09-20T00:00:00.000Z',
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-10-01T00:00:00.000Z',
      refunds: [],
    },
  ],
  billingPolicy: {
    invoiceDueDays: 5,
    dunningGraceDays: 7,
    gracePeriodEndsAt: '2026-09-27T00:00:00.000Z',
  },
  authority,
  projection: 'LEGACY_READ_ONLY',
};

describe('O12 Billing IRON premium workspace', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/saas-billing/authority') return authority;
      if (path === '/saas-billing/current') return current;
      if (path === '/saas-billing/prices') return prices;
      throw new Error('Unexpected API path: ' + path);
    });
  });

  test('renders the legacy read model under explicit FM Command authority without exposing internal price code', async () => {
    const view = render(<SaasBillingPanel />);

    await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());
    expect(view.getAllByText('IRON Pro').length).toBeGreaterThan(0);
    expect(view.getByText('Pagamento em atraso')).toBeTruthy();
    expect(view.getByText('05/10/2026')).toBeTruthy();
    expect(view.getAllByText(/149,90/).length).toBeGreaterThan(0);
    expect(view.queryByText('IRON_PRO_MONTHLY_INTERNAL')).toBeNull();
    expect(view.queryByText('Reembolsar')).toBeNull();
  });

  test('FM Command authority suppresses local refunds regardless of viewer', async () => {
    const view = render(<SaasBillingPanel />);

    await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());

    expect(view.queryByTestId('saas-billing-refund-invoice-a')).toBeNull();
    expect(view.queryByTestId('saas-billing-refund-panel')).toBeNull();
    expect(mockApi.mock.calls.some(([path]) => path === '/saas-billing/refunds')).toBe(false);
  });
});
