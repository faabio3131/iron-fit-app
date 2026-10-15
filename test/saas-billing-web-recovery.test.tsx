import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
    projection: 'LEGACY_READ_ONLY',
    authority: {
      billingAuthority: 'FM_COMMAND',
      productCode: 'IRON_FIT_CORE',
      localMutationsEnabled: false,
      providerWebhooksAccepted: false,
      mode: 'COMMAND_CENTRALIZED',
    },
  };
}

const authority = {
  billingAuthority: 'FM_COMMAND',
  productCode: 'IRON_FIT_CORE',
  localMutationsEnabled: false,
  providerWebhooksAccepted: false,
  mode: 'COMMAND_CENTRALIZED',
};

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

describe('SaaS billing Web authority surface', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/saas-billing/authority') return authority;
      if (path === '/saas-billing/current') return currentState();
      if (path === '/saas-billing/prices') return prices;
      throw new Error('Unexpected API path: ' + path);
    });
  });

  test('renders FM Command authority and never offers local checkout under centralized mode', async () => {
    const view = render(<SaasBillingPanel />);

    await waitFor(() => expect(view.getByTestId('saas-billing-panel')).toBeTruthy());
    await waitFor(() => expect(view.getByTestId('saas-billing-command-authority')).toBeTruthy());

    expect(view.queryByTestId('saas-billing-action-IRON_B6_BASIC_MONTHLY')).toBeNull();
    expect(view.queryByTestId('saas-billing-cancel-period-end')).toBeNull();
    expect(mockApi).not.toHaveBeenCalledWith(
      '/saas-billing/checkout',
      expect.anything(),
      expect.anything(),
    );
    expect(mockApi).not.toHaveBeenCalledWith(
      '/saas-billing/change-plan',
      expect.anything(),
      expect.anything(),
    );
    expect(mockApi).not.toHaveBeenCalledWith(
      '/saas-billing/cancel',
      expect.anything(),
      expect.anything(),
    );
  });

  test('commercial shell keeps only billing/security recovery paths when subscription is blocked', async () => {
    const source = await readFile('src/web/CommercialWebApp.tsx', 'utf8');

    expect(source).toContain("item.key === 'saasBilling' || item.key === 'security'");
    expect(source).toContain('Seu acesso operacional está limitado.');
    expect(source).toContain("<SaasBillingPanel onCommercialStateChanged={loadShell} canAdministerBilling={can('SUPER_ADMIN')} />");
    expect(source).toContain("key: 'saasBilling'");
    expect(source).not.toContain("blocked ? [] : modules.filter");
  });
});
