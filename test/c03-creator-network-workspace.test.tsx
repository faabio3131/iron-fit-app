import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CreatorNetworkWorkspace } from '../src/components/CreatorNetworkWorkspace';

const mockApi = jest.fn();
const onRefresh = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const items = [
  { id: 'content-a', title: 'Exercício de mobilidade', description: 'Alongamento para iniciantes',
    lifecycleStatus: 'PUBLISHED', creator: { displayName: 'Ana' },
    mediaAssets: [{ id: 'asset-a', kind: 'VIDEO', mimeType: 'video/mp4' }] },
  { id: 'content-b', title: 'Aquecimento', description: 'Vídeo de aquecimento', lifecycleStatus: 'DRAFT', mediaAssets: [] },
];
const overview = {
  rights: { effectiveActive: 2, expiringWithinDays: { days: 30, count: 1 }, expiredButStillActiveRecords: 1 },
  content: { byLifecycle: { PUBLISHED: 1, DRAFT: 1 } },
};
const analytics = {
  usage: { totalSessions: 4, totalEvents: 7 },
  commercial: { accrualsByConsumptionCurrency: [{ currency: 'BRL', accrualCount: 2, totalAmountMinor: '1000' }] },
};
beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (p: string) => {
    if (p === '/creator-network/content/tenant/items/content-a') return items[0];
    if (p === '/creator-network/content/tenant/items/content-b') return items[1];
    throw new Error('Rota não disponível: ' + p);
  });
});
function mount() {
  return render(<CreatorNetworkWorkspace items={items} overview={overview} analytics={analytics}
    refreshing={false} onRefresh={onRefresh} />);
}
test('C03 Creator lists tenant catalog with meaningful labels, rights alert and observed-only metrics', () => {
  const view = mount();
  expect(view.getByText('Rede de Criadores')).toBeTruthy();
  expect(view.getByTestId('creator-rights-alert')).toBeTruthy();
  expect(view.getByTestId('creator-total-items')).toBeTruthy();
  expect(view.getByText('Exercício de mobilidade')).toBeTruthy();
  expect(view.getByText(/Montante em unidades mínimas: 1000/)).toBeTruthy();
  expect(view.getByText(/Acúmulos registrados não equivalem/)).toBeTruthy();
});
test('C03 Creator search and lifecycle filter affect only existing tenant records', () => {
  const view = mount();
  fireEvent.changeText(view.getByTestId('creator-search'), 'aquec');
  expect(view.queryByTestId('creator-item-content-a')).toBeNull();
  expect(view.getByTestId('creator-item-content-b')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('creator-search'), '');
  fireEvent.press(view.getByTestId('creator-filter-PUBLISHED'));
  expect(view.getByTestId('creator-item-content-a')).toBeTruthy();
  expect(view.queryByTestId('creator-item-content-b')).toBeNull();
});
test('C03 Creator details fetch uses real tenant path and never leaks global scope', async () => {
  const view = mount();
  fireEvent.press(view.getByTestId('creator-details-content-a'));
  await waitFor(() => expect(view.getByTestId('creator-detail-panel-content-a')).toBeTruthy());
  await waitFor(() => expect(view.getByText(/Arquivo: Vídeo/)).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/creator-network/content/tenant/items/content-a');
  expect(mockApi.mock.calls.some(([p]) => p.includes('/global/') || p.includes('gymId='))).toBe(false);
});
test('C03 Creator fails closed on missing detail without inventing content or publication', async () => {
  mockApi.mockRejectedValueOnce(new Error('Conteúdo sem acesso'));
  const view = mount();
  fireEvent.press(view.getByTestId('creator-details-content-a'));
  await waitFor(() => expect(view.getByTestId('creator-detail-error')).toBeTruthy());
  expect(view.queryByText(/Arquivo: Vídeo/)).toBeNull();
});
test('C03 Creator refresh button invokes canonical refresh and clears stale details', () => {
  const view = mount();
  fireEvent.press(view.getByTestId('creator-refresh'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
test('C03 Creator does not invent zero for unavailable rights and usage metrics', () => {
  const view = render(<CreatorNetworkWorkspace items={[]} overview={null} analytics={null}
    onRefresh={onRefresh} refreshing={false} />);
  expect(view.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  expect(view.getByText(/Nenhum conteúdo corresponde/)).toBeTruthy();
  expect(view.queryByTestId('creator-rights-alert')).toBeNull();
});
