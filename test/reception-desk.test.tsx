import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReceptionDesk, ReceptionDeskAdmin } from '../src/web/ReceptionDesk';
import { api } from '../src/services/api';
jest.mock('../src/services/api', () => ({ api: jest.fn() }));
const mocked = api as jest.Mock;
const plan = { id: 'plan', name: 'Mensal', amount: 15990, intervalMonths: 1, active: true };
const closing = { count: 0, totalMinor: 0, byMethod: {}, receipts: [] };
beforeEach(() => {
  jest.clearAllMocks();
  mocked.mockImplementation(async (path: string) => {
    if (path === '/reception/catalog') return { enabled: true, plans: [plan] };
    if (path.startsWith('/reception/closing')) return closing;
    if (path.includes('/students/')) return [];
    if (path === '/reception/admin/settings') return { policy: null, plans: [] };
    return {};
  });
});
test('desk requires student, plan and explicit confirmed payment before sending canonical enrollment', async () => {
  const view = render(<ReceptionDesk students={[{ id: 'student', name: 'Ana' }]} />);
  await waitFor(() => expect(view.getByTestId('desk-enroll')).toBeTruthy());
  fireEvent.press(view.getByTestId('desk-enroll'));
  expect(mocked.mock.calls.some(([path]) => path === '/reception/enroll')).toBe(false);
  fireEvent.press(view.getByTestId('desk-student-student'));
  fireEvent.press(view.getByTestId('desk-plan-plan'));
  fireEvent.press(view.getByTestId('desk-confirm'));
  mocked.mockImplementation(async (path: string) => path === '/reception/enroll' ? { id: 'receipt', charge: { status: 'PAID', amount: 15990 } } : path.includes('/students/') ? [] : closing);
  fireEvent.press(view.getByTestId('desk-enroll'));
  await waitFor(() => expect(view.getByTestId('desk-success')).toBeTruthy());
  const call = mocked.mock.calls.find(([path]) => path === '/reception/enroll');
  const body = JSON.parse(call![2].body);
  expect(body).toMatchObject({ studentId: 'student', planId: 'plan', paymentMethod: 'CASH', receivedConfirmed: true });
  expect(body.amount).toBeUndefined();
  expect(body.gymId).toBeUndefined();
  expect(body.accountId).toBeUndefined();
});
test('disabled policy does not expose a working enrollment button or fabricate a successful sale', async () => {
  mocked.mockImplementation(async (path: string) => path === '/reception/catalog' ? { enabled: false, plans: [plan] } : closing);
  const view = render(<ReceptionDesk students={[]} />);
  await waitFor(() => expect(view.getByText(/Caixa desabilitado/)).toBeTruthy());
  expect(view.queryByTestId('desk-enroll')).toBeNull();
  expect(view.queryByTestId('desk-success')).toBeNull();
});
test('owner submits plan price in integer cents and explicit reception authorization with no tenant override', async () => {
  const view = render(<ReceptionDeskAdmin accounts={[{ id: 'account', name: 'Caixa' }]} />);
  await waitFor(() => expect(mocked).toHaveBeenCalledWith('/reception/admin/settings'));
  fireEvent.changeText(view.getByTestId('desk-plan-name'), 'Mensal');
  fireEvent.changeText(view.getByTestId('desk-plan-price'), '159,90');
  fireEvent.press(view.getByTestId('desk-create-plan'));
  await waitFor(() => expect(mocked.mock.calls.some(([path]) => path === '/reception/admin/plans')).toBe(true));
  const call = mocked.mock.calls.find(([path]) => path === '/reception/admin/plans');
  expect(JSON.parse(call![2].body)).toEqual({ name: 'Mensal', amount: 15990, intervalMonths: 1 });
});
