import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FinancialScreen } from '../src/screens/FinancialScreen';

const mockApi = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));

beforeEach(() => { mockApi.mockReset(); });

test('C04 displays genuine student charges with working pending/paid filters', async () => {
  mockApi.mockResolvedValue([
    { id: 'charge-1', description: 'Mensalidade Outubro', amount: 120, status: 'PENDING', dueDate: '2026-10-20' },
    { id: 'charge-2', description: 'Mensalidade Setembro', amount: 90, status: 'PAID', dueDate: '2026-09-20' },
  ]);
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByTestId('student-charge-charge-1')).toBeTruthy());
  expect(view.getByTestId('student-charge-charge-2')).toBeTruthy();
  fireEvent.press(view.getByTestId('student-charges-filter-paid'));
  expect(view.queryByTestId('student-charge-charge-1')).toBeNull();
  expect(view.getByTestId('student-charge-charge-2')).toBeTruthy();
  fireEvent.press(view.getByTestId('student-charges-filter-pending'));
  expect(view.getByTestId('student-charge-charge-1')).toBeTruthy();
  expect(view.queryByTestId('student-charge-charge-2')).toBeNull();
  expect(mockApi).toHaveBeenCalledWith('/me/charges');
});

test('C04 failed API never misrepresents an outage as empty/no charges and can retry', async () => {
  mockApi.mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValueOnce([]);
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByTestId('student-charges-error')).toBeTruthy());
  expect(view.getByText(/Falha de rede/)).toBeTruthy();
  expect(view.queryByText('Nenhuma cobrança')).toBeNull();
  fireEvent.press(view.getByTestId('student-charges-retry'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(view.getByText('Nenhuma cobrança')).toBeTruthy());
  expect(view.queryByTestId('student-charges-error')).toBeNull();
  expect(view.getByText('Nenhuma cobrança')).toBeTruthy();
  expect(mockApi).toHaveBeenCalledTimes(2);
});

test('C04 previously returned charges must not be displayed as current after refresh failure', async () => {
  mockApi.mockResolvedValueOnce([{ id: 'charge-a', status: 'PENDING', amount: 100 }])
    .mockRejectedValueOnce(new Error('Sessão expirada'));
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByTestId('student-charge-charge-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('student-charges-refresh'));
  await waitFor(() => expect(view.getByTestId('student-charges-error')).toBeTruthy());
  expect(view.queryByTestId('student-charge-charge-a')).toBeNull();
});

test('C04 absent amount renders unknown rather than fabricated R$ 0 and no fake PIX CTA', async () => {
  mockApi.mockResolvedValue([{ id: 'unknown-charge', status: null, amount: null, value: null }]);
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByText('Valor indisponível')).toBeTruthy());
  expect(view.getByText('Situação indisponível')).toBeTruthy();
  expect(view.queryByText(/Pagamento via PIX chegando em breve/)).toBeNull();
});

test('C04 rejects invalid payload shape instead of silently declaring zero charges', async () => {
  mockApi.mockResolvedValue({ items: [] });
  const view = render(<FinancialScreen />);
  await waitFor(() => expect(view.getByTestId('student-charges-error')).toBeTruthy());
  expect(view.queryByText('Nenhuma cobrança')).toBeNull();
});
