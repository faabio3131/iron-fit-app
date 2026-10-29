import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AcademyChargesPanel } from '../src/components/AcademyChargesPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

const charge = {
  id: '11111111-1111-4111-8111-111111111111',
  studentId: 'student-a',
  amount: 10990,
  status: 'PENDING',
  dueDate: '2026-11-05T00:00:00.000Z',
  student: { user: { name: 'Aluno teste' } },
};
const props = {
  charges: [charge],
  accounts: [{ id: 'account-a', name: 'Caixa', active: true }],
  selectedAccountId: 'account-a',
  saving: false,
  onPay: jest.fn(),
};

beforeEach(() => { mockApi.mockReset(); props.onPay.mockReset(); });

test('lists only backend-supplied tenant payment gateway choices and creates hosted checkout', async () => {
  mockApi.mockImplementation(async (path: string, _locale: unknown, options?: { method?: string; body?: string }) => {
    if (path === '/financial/payment-providers') return [
      { connectionId: 'connection-a', providerCode: 'mercado_pago' },
      { connectionId: 'connection-b', providerCode: 'provider_b' },
    ];
    if (path === '/financial/charges/' + charge.id + '/payment-session' && options?.method === 'POST') {
      return { checkoutUrl: 'https://pay.example.com/link', pixQrCode: null };
    }
    throw new Error('Unexpected API path');
  });
  const screen = render(<AcademyChargesPanel {...props} />);
  await waitFor(() => expect(screen.getByTestId('academy-payment-provider-connection-b')).toBeTruthy());
  fireEvent.press(screen.getByTestId('academy-payment-provider-connection-b'));
  fireEvent.press(screen.getByTestId('academy-charge-online-' + charge.id));
  await waitFor(() => expect(screen.getByTestId('academy-charge-checkout-link-' + charge.id)).toBeTruthy());
  const post = mockApi.mock.calls.find((call) => call[2]?.method === 'POST');
  expect(post).toBeTruthy();
  expect(JSON.parse(post[2].body)).toEqual({
    requestId: charge.id,
    providerConnectionId: 'connection-b',
  });
  expect(props.onPay).not.toHaveBeenCalled();
});

test('no gateway means no online checkout action and no false payment', async () => {
  mockApi.mockResolvedValue([]);
  const screen = render(<AcademyChargesPanel {...props} />);
  await waitFor(() => expect(screen.getByText(/Nenhum gateway de pagamento habilitado/)).toBeTruthy());
  expect(screen.queryByTestId('academy-charge-online-' + charge.id)).toBeNull();
  expect(mockApi.mock.calls.some((call) => call[2]?.method === 'POST')).toBe(false);
  expect(props.onPay).not.toHaveBeenCalled();
});

test('provider reconciliation updates financial workspace only after verified PAID receipt', async () => {
  const onUpdated = jest.fn();
  mockApi.mockImplementation(async (path: string, _locale: unknown, options?: { method?: string; body?: string }) => {
    if (path === '/financial/payment-providers') return [{ connectionId: 'connection-a', providerCode: 'stripe' }];
    if (path === '/financial/charges/' + charge.id + '/reconcile-payment' && options?.method === 'POST') {
      return { status: 'PAID', booked: true };
    }
    throw new Error('Unexpected API path');
  });
  const screen = render(<AcademyChargesPanel {...props}
    charges={[{ ...charge, gatewayConnectionId: 'connection-a' }]}
    onUpdated={onUpdated} />);
  fireEvent.press(screen.getByTestId('academy-charge-verify-gateway-' + charge.id));
  await waitFor(() => expect(screen.getByText(/Pagamento confirmado pelo gateway/)).toBeTruthy());
  expect(onUpdated).toHaveBeenCalledTimes(1);
  expect(props.onPay).not.toHaveBeenCalled();
});

test('unpaid provider result does not book receipt or refresh financial ledger', async () => {
  const onUpdated = jest.fn();
  mockApi.mockImplementation(async (path: string, _locale: unknown, options?: { method?: string }) => {
    if (path === '/financial/payment-providers') return [];
    if (path === '/financial/charges/' + charge.id + '/reconcile-payment' && options?.method === 'POST') {
      return { status: 'PENDING', booked: false };
    }
    throw new Error('Unexpected API path');
  });
  const screen = render(<AcademyChargesPanel {...props}
    charges={[{ ...charge, gatewayConnectionId: 'connection-a' }]}
    onUpdated={onUpdated} />);
  fireEvent.press(screen.getByTestId('academy-charge-verify-gateway-' + charge.id));
  await waitFor(() => expect(screen.getByText(/gateway ainda não confirmou/)).toBeTruthy());
  expect(onUpdated).not.toHaveBeenCalled();
  expect(props.onPay).not.toHaveBeenCalled();
});

test('manual receipt action is hidden when charge is already bound to provider checkout', async () => {
  mockApi.mockResolvedValue([]);
  const screen = render(<AcademyChargesPanel {...props} charges={[{ ...charge, gatewayConnectionId: 'connection-a' }]} />);
  await waitFor(() => expect(screen.getByTestId('academy-charge-verify-gateway-' + charge.id)).toBeTruthy());
  expect(screen.queryByTestId('academy-charge-prepare-' + charge.id)).toBeNull();
});
