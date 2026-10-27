import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FinancialWorkspace } from '../src/web/FinancialWorkspace';

const students = [
  { id: 'student-1', user: { name: 'Ana Teste', email: 'ana@example.com' } },
];

const accounts = [
  { id: 'account-1', name: 'Conta principal', type: 'BANK', initialBalance: 10000 },
];

const subscriptions = [
  {
    id: 'subscription-1',
    studentId: 'student-1',
    planName: 'Plano mensal',
    amount: 14990,
    status: 'ACTIVE',
    nextBillingAt: '2026-10-10T00:00:00.000Z',
    student: { user: { name: 'Ana Teste' } },
  },
];

const charges = [
  {
    id: 'charge-overdue',
    studentId: 'student-1',
    amount: 14990,
    status: 'PENDING',
    dueDate: '2026-09-01T00:00:00.000Z',
    paymentMethod: 'PIX',
    student: { user: { name: 'Ana Teste' } },
  },
];

const transactions = [
  {
    id: 'tx-1',
    studentId: 'student-1',
    accountId: 'account-1',
    type: 'INCOME',
    status: 'PAID',
    description: 'Mensalidade',
    amount: 14990,
    paidAt: '2026-09-20T12:00:00.000Z',
    paymentMethod: 'PIX',
    account: { id: 'account-1', name: 'Conta principal', type: 'BANK' },
  },
];

describe('O11 FinancialWorkspace', () => {
  test('shows finance KPIs and overdue operational state', () => {
    const view = render(
      <FinancialWorkspace
        students={students}
        accounts={accounts}
        subscriptions={subscriptions}
        charges={charges}
        overdueCharges={charges}
        transactions={transactions}
        saving={false}
        onCreateAccount={jest.fn()}
        onCreateSubscription={jest.fn()}
        onCreateCharge={jest.fn()}
        onPayCharge={jest.fn()}
      />,
    );

    expect(view.getByText('Financeiro da academia')).toBeTruthy();
    expect(view.getAllByText('Inadimplência').length).toBeGreaterThan(0);
    expect(view.getAllByText('R$ 149,90').length).toBeGreaterThan(0);
    expect(view.getByText('1 cobranças vencidas')).toBeTruthy();
    expect(view.getByText('Em atraso')).toBeTruthy();
  });

  test('registers payment through a selected academy account', async () => {
    const onPayCharge = jest.fn().mockResolvedValue(undefined);
    const view = render(
      <FinancialWorkspace
        students={students}
        accounts={accounts}
        subscriptions={subscriptions}
        charges={charges}
        overdueCharges={charges}
        transactions={transactions}
        saving={false}
        onCreateAccount={jest.fn()}
        onCreateSubscription={jest.fn()}
        onCreateCharge={jest.fn()}
        onPayCharge={onPayCharge}
      />,
    );

    fireEvent.press(view.getByTestId('financial-tab-charges'));
    fireEvent.press(view.getByText('Conta principal'));
    fireEvent.press(view.getByTestId('financial-pay-charge-overdue'));

    await waitFor(() => expect(onPayCharge).toHaveBeenCalledWith(
      'charge-overdue',
      { accountId: 'account-1', paymentMethod: 'PIX' },
    ));
  });

  test('converts BRL input to canonical minor units when creating a charge', async () => {
    const onCreateCharge = jest.fn().mockResolvedValue(undefined);
    const view = render(
      <FinancialWorkspace
        students={students}
        accounts={accounts}
        subscriptions={subscriptions}
        charges={charges}
        overdueCharges={charges}
        transactions={transactions}
        saving={false}
        onCreateAccount={jest.fn()}
        onCreateSubscription={jest.fn()}
        onCreateCharge={onCreateCharge}
        onPayCharge={jest.fn()}
      />,
    );

    fireEvent.press(view.getByTestId('financial-tab-charges'));
    fireEvent.press(view.getAllByText('Ana Teste').slice(-1)[0]);
    fireEvent.changeText(view.getByLabelText('Valor (R$)'), '199,90');
    fireEvent.changeText(view.getByLabelText('Vencimento'), '2026-10-15');
    fireEvent.press(view.getByTestId('financial-create-charge'));

    await waitFor(() => expect(onCreateCharge).toHaveBeenCalledWith({
      studentId: 'student-1',
      amount: 19990,
      dueDate: '2026-10-15',
      paymentMethod: 'PIX',
    }));
  });
  test('starts academy checkout only on user action via canonical callback and shows hosted link', async () => {
    const priorCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'abcddcba-1234-4abc-8def-0123456789ab' },
    });
    try {
      const onCreatePaymentSession = jest.fn().mockResolvedValue({
        chargeId: 'charge-overdue',
        checkoutUrl: 'https://payments.example.test/checkout/1',
        pixQrCode: null,
        idempotent: false,
      });
      const view = render(<FinancialWorkspace
        students={students} accounts={accounts} subscriptions={subscriptions}
        charges={charges} overdueCharges={charges} transactions={transactions}
        saving={false} onCreateAccount={jest.fn()} onCreateSubscription={jest.fn()}
        onCreateCharge={jest.fn()} onPayCharge={jest.fn()}
        onCreatePaymentSession={onCreatePaymentSession}
      />);
      expect(onCreatePaymentSession).not.toHaveBeenCalled();
      fireEvent.press(view.getByTestId('financial-tab-charges'));
      fireEvent.press(view.getByTestId('financial-checkout-charge-overdue'));
      await waitFor(() => expect(onCreatePaymentSession).toHaveBeenCalledWith(
        'charge-overdue', 'abcddcba-1234-4abc-8def-0123456789ab',
      ));
      await waitFor(() => expect(view.getByTestId('financial-checkout-result')).toBeTruthy());
      expect(view.getByText('Abrir link seguro de pagamento')).toBeTruthy();
    } finally {
      if (priorCrypto) Object.defineProperty(globalThis, 'crypto', priorCrypto);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });

  test('provider failure is fail-closed and never marks charge as paid', async () => {
    const priorCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'abcddcba-1234-4abc-8def-0123456789ab' },
    });
    try {
      const onCreatePaymentSession = jest.fn().mockRejectedValue(new Error('Nenhuma conexão de gateway ativa'));
      const onPayCharge = jest.fn();
      const view = render(<FinancialWorkspace
        students={students} accounts={accounts} subscriptions={subscriptions}
        charges={charges} overdueCharges={charges} transactions={transactions}
        saving={false} onCreateAccount={jest.fn()} onCreateSubscription={jest.fn()}
        onCreateCharge={jest.fn()} onPayCharge={onPayCharge}
        onCreatePaymentSession={onCreatePaymentSession}
      />);
      fireEvent.press(view.getByTestId('financial-tab-charges'));
      fireEvent.press(view.getByTestId('financial-checkout-charge-overdue'));
      await waitFor(() => expect(view.getByText('Nenhuma conexão de gateway ativa')).toBeTruthy());
      expect(view.queryByTestId('financial-checkout-result')).toBeNull();
      expect(onPayCharge).not.toHaveBeenCalled();
    } finally {
      if (priorCrypto) Object.defineProperty(globalThis, 'crypto', priorCrypto);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });


  test('rejects checkout session from another charge without displaying Pix or marking paid', async () => {
    const priorCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'abcddcba-1234-4abc-8def-0123456789ab' },
    });
    try {
      const onCreatePaymentSession = jest.fn().mockResolvedValue({
        chargeId: 'charge-from-another-student',
        checkoutUrl: 'https://payments.example.test/wrong-charge',
        pixQrCode: '00020101021226840014wrong-charge',
      });
      const onPayCharge = jest.fn();
      const view = render(<FinancialWorkspace
        students={students} accounts={accounts} subscriptions={subscriptions}
        charges={charges} overdueCharges={charges} transactions={transactions}
        saving={false} onCreateAccount={jest.fn()} onCreateSubscription={jest.fn()}
        onCreateCharge={jest.fn()} onPayCharge={onPayCharge}
        onCreatePaymentSession={onCreatePaymentSession}
      />);
      fireEvent.press(view.getByTestId('financial-tab-charges'));
      fireEvent.press(view.getByTestId('financial-checkout-charge-overdue'));
      await waitFor(() => expect(view.getByText('A sessão de pagamento não corresponde à cobrança selecionada.')).toBeTruthy());
      expect(view.queryByTestId('financial-checkout-result')).toBeNull();
      expect(onPayCharge).not.toHaveBeenCalled();
    } finally {
      if (priorCrypto) Object.defineProperty(globalThis, 'crypto', priorCrypto);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });

});
