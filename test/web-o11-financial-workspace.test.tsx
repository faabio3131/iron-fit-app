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
});
