import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { brlFromMinor, brlToMinor, positiveBrlToMinor } from '../src/utils/academy-money';
import { FinancialScreen } from '../src/screens/FinancialScreen';
import { AcademyChargesPanel } from '../src/components/AcademyChargesPanel';
import { OperationsCockpitPanel } from '../src/components/OperationsCockpitPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

beforeEach(() => {
  mockApi.mockReset();
});
test.each([
  ['100', 10000], ['100,00', 10000], ['100,5', 10050],
  ['0,01', 1], ['1.234,56', 123456], ['0', 0],
])('C05 BRL input %s is exactly %s centavos', (input, cents) => {
  expect(brlToMinor(input)).toBe(cents);
});
test.each(['', '-100', '1.5', '100.00', '1,999', 'abc', '1,2,3', '0,001', 'Infinity', 'R$ 50,00'])(
  'C05 invalid or ambiguous currency %s fails closed', (input) => {
    expect(brlToMinor(input)).toBeNull();
    expect(positiveBrlToMinor(input)).toBeNull();
  },
);
test('C05 only positive amounts can create paid obligations, without float artifacts', () => {
  expect(positiveBrlToMinor('0,00')).toBeNull();
  expect(positiveBrlToMinor('0,01')).toBe(1);
  expect(positiveBrlToMinor('99,99')).toBe(9999);
  expect(brlToMinor('9999999999999999')).toBeNull();
});
test('C05 formatting uses minor units and never invents zero for absent value', () => {
  expect(brlFromMinor(19990)).toMatch(/R\$\s*199,90/);
  expect(brlFromMinor(100)).toMatch(/R\$\s*1,00/);
  expect(brlFromMinor(0)).toMatch(/R\$\s*0,00/);
  expect(brlFromMinor(null)).toBe('Valor não informado');
  expect(brlFromMinor(1.25)).toBe('Valor não informado');
});
test('C05 student reads a backend centavos charge without inflating R$ 199,90 by 100 times', async () => {
  mockApi.mockResolvedValue([{ id: 'charge-a', amount: 19990, status: 'PENDING', dueDate: '2026-10-25' }]);
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByTestId('student-charge-charge-a')).toBeTruthy());
  expect(view.getByText(/R\$\s*199,90/)).toBeTruthy();
  expect(view.queryByText(/19\.990,00/)).toBeNull();
});
test('C05 academy charge review displays real currency amount, not integer cents', () => {
  const view = render(<AcademyChargesPanel
    charges={[{ id: 'charge-a', status: 'PENDING', amount: 10000 }]}
    accounts={[{ id: 'account-a', name: 'Caixa', active: true }]}
    selectedAccountId="account-a" saving={false} onPay={jest.fn()} />);
  expect(view.getByText(/R\$\s*100,00/)).toBeTruthy();
  expect(view.queryByText(/Valor registrado: 10\.000/)).toBeNull();
});
test('C05 revenue series converts received cents to BRL, not billing SaaS', () => {
  const view = render(<OperationsCockpitPanel
    summary={{ students: { total: 10 } }} attendance={[]} birthdays={[]} overdue={[]}
    revenue={[{ date: '2026-10-25', amount: 12550 }]}
    financialAuthorized availableModules={[]} refreshing={false}
    onNavigate={jest.fn()} onRefresh={jest.fn()} />);
  expect(view.getByText(/Valor recebido: R\$\s*125,50/)).toBeTruthy();
});
