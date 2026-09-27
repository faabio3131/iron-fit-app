import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { readFile } from 'node:fs/promises';
import { SaasBillingPanel } from '../src/components/SaasBillingPanel';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

function currentState() {
  return {
    agreement: null,
    invoices: [],
  };
}

const prices = [
  {
    id: 'price-basic',
    priceCode: 'IRON_B6_BASIC_MONTHLY',
    currency: 'BRL',
    amountMinor: 10000,
    interval: 'MONTHLY',
    planVersion: {
      version: 1,
      productPlan: { code: 'IRON_B6_BASIC', name: 'IRON Basic' },
    },
  },
];

describe('SaaS billing Web recovery surface', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/saas-billing/current') return currentState();
      if (path === '/saas-billing/prices') return prices;
      if (path === '/saas-billing/checkout') {
        return {
          id: 'checkout-1',
          status: 'READY',
          sandboxOnly: true,
          checkoutUrl: null,
        };
      }
      throw new Error('Unexpected API path: ' + path);
    });
  });

  test('loads canonical billing state and initiates checkout without browser-provided tenant', async () => {
    const view = render(<SaasBillingPanel />);

    await waitFor(() => expect(view.getByTestId('saas-billing-panel')).toBeTruthy());
    await waitFor(() =>
      expect(view.getByTestId('saas-billing-action-IRON_B6_BASIC_MONTHLY')).toBeTruthy(),
    );

    fireEvent.press(view.getByTestId('saas-billing-action-IRON_B6_BASIC_MONTHLY'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/saas-billing/checkout',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const call = mockApi.mock.calls.find(([path]) => path === '/saas-billing/checkout');
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body.priceCode).toBe('IRON_B6_BASIC_MONTHLY');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(20);
    expect(body).not.toHaveProperty('gymId');
    expect(body).not.toHaveProperty('amountMinor');
  });

  test('commercial shell keeps only billing/security recovery paths when subscription is blocked', async () => {
    const source = await readFile('src/web/CommercialWebApp.tsx', 'utf8');

    expect(source).toContain("item.key === 'saasBilling' || item.key === 'security'");
    expect(source).toContain('A superfície operacional permanece fail-closed');
    expect(source).toContain('<SaasBillingPanel onCommercialStateChanged={loadShell} />');
    expect(source).toContain("key: 'saasBilling'");
    expect(source).not.toContain("blocked ? [] : modules.filter");
  });
});
