import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AggregatorHubPanel } from '../src/components/AggregatorHubPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/aggregator/operations/summary') return {
      visits: { CONFIRMED: 3, PROVISIONAL: 1 },
      connections: { ACTIVE: 1 }, unresolvedRiskCases: 2,
      generatedAt: '2026-10-25T12:00:00Z',
    };
    if (path === '/aggregator/operations/reception-queue?limit=25') return {
      items: [{ visitAuthorizationId: 'visit-a', providerCode: 'WELLHUB', visitStatus: 'PROVISIONAL',
        attentionCode: 'REVALIDATION_REQUIRED', providerConnectionStatus: 'DISABLED' }],
    };
    if (path === '/aggregator/operations/risk-queue?limit=25') return [
      { id: 'risk-a', status: 'OPEN', type: 'DUPLICATE_ENTRY', connection: { providerCode: 'TOTALPASS' } },
    ];
    if (path === '/aggregator/operations/settlement-queue?limit=25') return [
      { id: 'settlement-a', status: 'DIVERGENT', currency: 'BRL', amountExpected: 100, amountConfirmed: 50,
        connection: { providerCode: 'TOTALPASS' } },
    ];
    if (path.startsWith('/aggregator/intelligence/overview')) return {
      totals: { visits: 4, settlements: 1, reconciliations: 1, riskCases: 2, unresolvedRiskCases: 2 },
      rates: { confirmedVisitRate: 0.75, reconciledRate: 0.5 },
      signals: [{ code: 'PROVISIONAL_VISITS', count: 1, advisory: true }],
    };
    if (path.startsWith('/aggregator/intelligence/providers')) return {
      items: [{ providerCode: 'WELLHUB', visits: { CONFIRMED: 3 }, rates: { confirmedVisitRate: 0.75 } }],
    };
    if (path.startsWith('/aggregator/intelligence/trends')) return {
      points: [{ date: '2026-10-25', visits: 4, confirmedVisits: 3, provisionalVisits: 1 }],
    };
    throw new Error('Rota inesperada: ' + path);
  });
});

test('C02 reception Aggregator Hub loads only operational summary and queue, never financial risk or analytics', async () => {
  const view = render(<AggregatorHubPanel canManage={false} />);
  await waitFor(() => expect(view.getByText('Fila de atendimento da recepção')).toBeTruthy());
  expect(view.getByText(/Revalidação necessária/)).toBeTruthy();
  expect(view.getByText(/4/)).toBeTruthy();
  expect(view.queryByText('Riscos e conciliação')).toBeNull();
  expect(view.queryByText('Repasses e divergências')).toBeNull();
  expect(view.queryByText('Intelligence operacional — leitura consultiva')).toBeNull();
  const paths = mockApi.mock.calls.map(([p]) => p);
  expect(paths).toEqual([
    '/aggregator/operations/summary',
    '/aggregator/operations/reception-queue?limit=25',
  ]);
});

test('C02 owner Aggregator Hub consumes real tenant-scoped queues and advisory analytics without claiming homologation', async () => {
  const view = render(<AggregatorHubPanel canManage />);
  await waitFor(() => expect(view.getByText('Riscos e conciliação')).toBeTruthy());
  expect(view.getByText('Repasses e divergências')).toBeTruthy();
  expect(view.getByText(/Taxa de conciliação/)).toBeTruthy();
  expect(view.getByText(/Exceções de repasse/)).toBeNull();
  expect(view.getByText(/Visitas provisórias/)).toBeTruthy();
  expect(view.getByText(/adapter implementado não comprova integração externa homologada/)).toBeTruthy();
  expect(mockApi).toHaveBeenCalledWith('/aggregator/intelligence/overview?days=30');
  expect(mockApi).toHaveBeenCalledWith('/aggregator/operations/risk-queue?limit=25');
  expect(mockApi).toHaveBeenCalledWith('/aggregator/operations/settlement-queue?limit=25');
  expect(mockApi.mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);
});

test('C02 changing analytics window never writes to provider or physical-access authorization', async () => {
  const view = render(<AggregatorHubPanel canManage />);
  await waitFor(() => expect(view.getByTestId('aggregator-days-7')).toBeTruthy());
  fireEvent.press(view.getByTestId('aggregator-days-7'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/aggregator/intelligence/overview?days=7'));
  expect(mockApi.mock.calls.every(([, , opts]) => !opts?.method || opts.method === 'GET')).toBe(true);
});

test('C02 Aggregator Hub failure shows real error and retry, never zero-filled operational metrics', async () => {
  mockApi.mockRejectedValue(new Error('503 indisponível'));
  const view = render(<AggregatorHubPanel canManage={false} />);
  await waitFor(() => expect(view.getByTestId('aggregator-error')).toBeTruthy());
  expect(view.queryByText('0')).toBeNull();
  expect(view.queryByText('Sem atendimentos pendentes.')).toBeNull();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/aggregator/operations/summary') return { visits: {}, connections: {}, unresolvedRiskCases: 0 };
    if (path.includes('reception-queue')) return { items: [] };
    throw new Error('Unexpected');
  });
  fireEvent.press(view.getByTestId('aggregator-refresh'));
  await waitFor(() => expect(view.getByText('Sem atendimentos pendentes.')).toBeTruthy());
});
