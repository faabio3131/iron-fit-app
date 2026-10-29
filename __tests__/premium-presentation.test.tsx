import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardOverview, money } from '../src/web/DashboardOverview';
import { RecordList } from '../src/web/RecordList';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

test('dashboard distinguishes unavailable metrics from real zero and opens the real module', () => {
  const navigate = jest.fn();
  const view = render(<DashboardOverview data={{ summary: { students: { active: 0, total: 0 }, revenue: { thisMonth: 14990 } }, overdue: [], birthdays: [] }} navigate={navigate} />);
  expect(view.getAllByText('0').length).toBeGreaterThan(0);
  expect(view.getByText(/149,90/)).toBeTruthy();
  expect(view.getByLabelText('Treinos aprovados: —. Abrir detalhes')).toBeTruthy();
  expect(view.getByLabelText('Equipamentos: —. Abrir detalhes')).toBeTruthy();
  expect(view.getByText('Nenhuma cobrança vencida.')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Alunos ativos: 0. Abrir detalhes'));
  expect(navigate).toHaveBeenCalledWith('students');
});

test('daily series has accessible exact values and no invented data', () => {
  const view = render(<DashboardOverview data={{ revenue: [{ date: '2026-09-29', amount: 14990 }], attendance: [{ date: '2026-09-29', count: 3 }] }} navigate={jest.fn()} />);
  expect(view.getByLabelText(/29\/09: R\$.*149,90/)).toBeTruthy();
  expect(view.getByLabelText('29/09: 3 presenças')).toBeTruthy();
  expect(view.getAllByText('Informações indisponíveis.')).toHaveLength(2);
  expect(money(undefined)).toBe('—');
  expect(money(NaN)).toBe('—');
  expect(money(0)).toMatch(/0,00/);
});

test('record presentation only displays opted-in fields and never nested credentials', () => {
  const view = render(<RecordList rows={[{ id: 'internal-id', user: { name: 'Ana', email: 'ana@example.test', passwordHash: 'nested-secret' }, status: 'ACTIVE', amount: 14990, accessToken: 'secret-token', passwordHash: 'hash', vault: { value: 'vault-secret' } }]} />);
  expect(view.getByText('Ana')).toBeTruthy();
  expect(view.getByText('ana@example.test')).toBeTruthy();
  expect(view.getByText('Ativo')).toBeTruthy();
  expect(view.getByText(/149,90/)).toBeTruthy();
  for (const secret of ['internal-id', 'nested-secret', 'secret-token', 'hash', 'vault-secret']) expect(view.queryByText(secret)).toBeNull();
});


test('a real zero-only series is explained without invented chart activity', () => {
  const view = render(<DashboardOverview data={{ revenue: [{ date: '2026-09-29', amount: 0 }], attendance: [{ date: '2026-09-29', count: 0 }] }} navigate={jest.fn()} />);
  expect(view.getByText('Nenhum recebimento no período.')).toBeTruthy();
  expect(view.getByText('Nenhum check-in no período.')).toBeTruthy();
});
