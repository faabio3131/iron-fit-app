import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OperationsCockpitPanel, type CockpitShortcut } from '../src/components/OperationsCockpitPanel';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const onNavigate = jest.fn();
const onRefresh = jest.fn();

const summary = {
  students: { total: 120, active: 110, inactive: 10 },
  equipments: { total: 35 },
  workouts: { total: 40, approved: 30, drafts: 10 },
  charges: { pending: 12, overdue: 3 },
  generatedAt: '2026-10-25T10:00:00.000Z',
};
const attendance = [{ date: '2026-10-20', count: 6 }, { date: '2026-10-21', count: 8 }];
const revenue = [{ date: '2026-10-25', amount: 500 }];
const overdue = [{ id: 'charge-a', dueDate: '2026-10-10', student: { user: { name: 'Ana Silva' } } }];
const birthdays = [{ studentId: 'student-a', name: 'Ana Silva', daysUntil: 2 }];
const shortcuts: CockpitShortcut[] = ['students', 'schedule', 'access', 'financial'];

beforeEach(() => { onNavigate.mockClear(); onRefresh.mockClear(); });

function mount(financialAuthorized: boolean, availableModules = shortcuts,
  data: React.ComponentProps<typeof OperationsCockpitPanel>['summary'] = summary) {
  return render(<OperationsCockpitPanel academyName="Academia A" operatorName="Proprietário"
    summary={data} attendance={attendance} revenue={revenue} overdue={overdue} birthdays={birthdays}
    financialAuthorized={financialAuthorized} availableModules={availableModules} onNavigate={onNavigate}
    onRefresh={onRefresh} refreshing={false} />);
}

test('C03 Cockpit renders canonical KPIs, named academy, real checkins and upcoming birthdays', () => {
  const view = mount(false);
  expect(view.getByText('Academia A')).toBeTruthy();
  expect(view.getByTestId('cockpit-students-total')).toBeTruthy();
  expect(view.getByText('120')).toBeTruthy();
  expect(view.getByTestId('cockpit-attendance-chart')).toBeTruthy();
  expect(view.getByText('Em 2 dia(s)')).toBeTruthy();
  expect(view.queryByText('Cobranças da academia')).toBeNull();
  expect(view.queryByText('Recebimentos — últimos 30 dias')).toBeNull();
});

test('C03 financial data stays hidden from non-stepped-up user even if accidentally present in props', () => {
  const view = mount(false);
  expect(view.queryByTestId('cockpit-financial-pending')).toBeNull();
  expect(view.queryByText('Ana Silva')).toBeTruthy(); // Birthday, not the overdue account.
  expect(view.queryByText('Vencimento: 10/10/2026')).toBeNull();
  expect(view.queryByText('Valor registrado: 500')).toBeNull();
});

test('C03 owner step-up displays only academy-to-student financial indicators', () => {
  const view = mount(true);
  expect(view.getByTestId('cockpit-financial-pending')).toBeTruthy();
  expect(view.getByText('Cobranças da academia')).toBeTruthy();
  expect(view.getByText('Vencimento: 10/10/2026')).toBeTruthy();
  expect(view.getByText('Valor registrado: 500')).toBeTruthy();
  expect(view.getByText(/Financeiro academia/)).toBeTruthy();
});

test('C03 shortcuts are real clickables bound only to authorized modules and refresh triggers actual callback', () => {
  const view = mount(false, ['students', 'schedule']);
  expect(view.queryByTestId('cockpit-shortcut-financial')).toBeNull();
  expect(view.queryByTestId('cockpit-shortcut-access')).toBeNull();
  fireEvent.press(view.getByTestId('cockpit-shortcut-students'));
  expect(onNavigate).toHaveBeenCalledWith('students');
  fireEvent.press(view.getByTestId('cockpit-refresh'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test('C03 missing metric fields are unknown, never invented zero or money amounts', () => {
  const view = mount(false, [], { students: { total: 0 } });
  expect(view.getByText('0')).toBeTruthy();
  expect(view.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  expect(view.queryByText('Acesso rápido')).toBeNull();
});

test('C03 cockpit disables refresh when load is already in progress', () => {
  const view = render(<OperationsCockpitPanel summary={summary} attendance={attendance} revenue={null}
    overdue={null} birthdays={[]} availableModules={[]} financialAuthorized={false}
    onNavigate={onNavigate} onRefresh={onRefresh} refreshing />);
  fireEvent.press(view.getByTestId('cockpit-refresh'));
  expect(onRefresh).not.toHaveBeenCalled();
});
