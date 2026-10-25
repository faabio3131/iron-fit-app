import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AcademyChargesPanel } from '../src/components/AcademyChargesPanel';

const onPay = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const accounts = [{ id: 'account-a', name: 'Caixa', active: true }, { id: 'account-b', name: 'Banco', active: true }];
const charges = [
  { id: 'charge-1', status: 'PENDING', amount: 150, dueDate: '2026-10-15',
    student: { user: { name: 'Ana' } } },
  { id: 'charge-2', status: 'PAID', amount: 80, student: { user: { name: 'Bruno' } } },
];
beforeEach(() => onPay.mockReset());
function mount(account = 'account-a', props: Partial<React.ComponentProps<typeof AcademyChargesPanel>> = {}) {
  return render(<AcademyChargesPanel charges={charges} accounts={accounts} selectedAccountId={account}
    saving={false} onPay={onPay} {...props} />);
}

test('C04 never marks a charge as paid on initial click; requires explicit confirmation', () => {
  const view = mount();
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  expect(view.getByTestId('academy-charge-confirmation')).toBeTruthy();
  expect(onPay).not.toHaveBeenCalled();
  expect(view.getByText(/Confirme somente se o pagamento realmente foi recebido/)).toBeTruthy();
  expect(view.getByTestId('academy-payment-method-required')).toBeTruthy();
  fireEvent.press(view.getByTestId('academy-charge-confirm-pay'));
  expect(onPay).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('academy-payment-method-PIX'));
  fireEvent.press(view.getByTestId('academy-charge-confirm-pay'));
  expect(onPay).toHaveBeenCalledWith('charge-1', 'account-a', 'PIX');
  expect(onPay).toHaveBeenCalledTimes(1);
});

test('C04 cancel does not call PATCH and disables already-paid charges', () => {
  const view = mount();
  expect(view.queryByTestId('academy-charge-prepare-charge-2')).toBeNull();
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  fireEvent.press(view.getByTestId('academy-charge-cancel-pay'));
  expect(view.queryByTestId('academy-charge-confirmation')).toBeNull();
  expect(onPay).not.toHaveBeenCalled();
});

test('C04 prevents settlement without an active selected financial account', () => {
  const view = mount('');
  expect(view.getByText(/Selecione uma conta financeira ativa/)).toBeTruthy();
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  expect(view.queryByTestId('academy-charge-confirmation')).toBeNull();
  expect(onPay).not.toHaveBeenCalled();
});

test('C04 switching account after review invalidates confirmation', () => {
  const view = mount();
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  expect(view.getByTestId('academy-charge-confirmation')).toBeTruthy();
  fireEvent.press(view.getByTestId('academy-payment-method-PIX'));
  view.rerender(<AcademyChargesPanel charges={charges} accounts={accounts} selectedAccountId="account-b"
    saving={false} onPay={onPay} />);
  expect(view.getByTestId('academy-charge-account-changed')).toBeTruthy();
  fireEvent.press(view.getByTestId('academy-charge-confirm-pay'));
  expect(onPay).not.toHaveBeenCalled();
});

test('C04 filters and payment completion do not allow double payment of PAID state', () => {
  const view = mount();
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  view.rerender(<AcademyChargesPanel charges={[{ ...charges[0], status: 'PAID' }, charges[1]]}
    accounts={accounts} selectedAccountId="account-a" saving={false} onPay={onPay} />);
  expect(view.queryByTestId('academy-charge-confirm-pay')).toBeNull();
  expect(onPay).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('academy-charges-pending'));
  expect(view.queryByTestId('academy-charge-charge-1')).toBeNull();
  fireEvent.press(view.getByTestId('academy-charges-paid'));
  expect(view.getByTestId('academy-charge-charge-2')).toBeTruthy();
});

test('C04 saving flag blocks settlement while previous request is in progress', () => {
  const view = mount('account-a', { saving: true });
  fireEvent.press(view.getByTestId('academy-charge-prepare-charge-1'));
  expect(view.queryByTestId('academy-charge-confirmation')).toBeNull();
  expect(onPay).not.toHaveBeenCalled();
});
