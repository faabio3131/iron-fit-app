import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SaasBillingPanel } from '../src/components/SaasBillingPanel';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

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
};

describe('O12 Billing IRON premium workspace', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/saas-billing/current') return current;
      if (path === '/saas-billing/prices') return prices;
      if (path === '/saas-billing/refunds') {
        return { id: 'refund-a', status: 'SUCCEEDED' };
      }
      throw new Error('Unexpected API path: ' + path);
    });
  });

  test('renders commercial plan labels, cycle, invoices and approved grace policy without showing internal price code', async () => {
    const view = render(<SaasBillingPanel />);

    await waitFor(() => expect(view.getByText('IRON Pro')).toBeTruthy());
    expect(view.getAllByText('Mensal').length).toBeGreaterThan(0);
    expect(view.getByText('27/09/2026')).toBeTruthy();
    expect(view.getByText('Período de tolerância: 7 dias')).toBeTruthy();
    expect(view.getByTestId('saas-billing-dunning-state')).toBeTruthy();
    expect(view.queryByText('IRON_PRO_MONTHLY_INTERNAL')).toBeNull();
    expect(view.queryByText('Reembolsar')).toBeNull();
  });

  test('refund stays SUPER_ADMIN-only and never sends tenant authority from the browser', async () => {
    const view = render(<SaasBillingPanel canAdministerBilling />);

    await waitFor(() => expect(view.getByTestId('saas-billing-refund-invoice-a')).toBeTruthy());
    fireEvent.press(view.getByTestId('saas-billing-refund-invoice-a'));

    expect(view.getByTestId('saas-billing-refund-panel')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Motivo do reembolso'), 'Cobrança duplicada');
    fireEvent.press(view.getByTestId('saas-billing-confirm-refund'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/saas-billing/refunds',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const call = mockApi.mock.calls.find(([path]) => path === '/saas-billing/refunds');
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body.invoiceId).toBe('invoice-a');
    expect(body.amountMinor).toBe(14990);
    expect(body.reason).toBe('Cobrança duplicada');
    expect(body).not.toHaveProperty('gymId');
  });
});
