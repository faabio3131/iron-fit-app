import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EquipmentIntelligencePanel } from '../src/components/EquipmentIntelligencePanel';
import { ExercisesLibraryPanel } from '../src/components/ExercisesLibraryPanel';

const mockApi = jest.fn();
const mockReload = jest.fn(async () => undefined);
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

const catalog = [
  { id: 'catalog-a', name: 'Leg Press 45°', category: 'MACHINE', selected: true, metadata: { manufacturerName: 'Fabricante A' } },
  { id: 'catalog-b', name: 'Esteira', category: 'CARDIO', selected: false, metadata: { manufacturerName: 'Fabricante B' } },
];
const inventory = [{ id: 'inventory-a', name: 'Leg Press 45°', catalogItemId: 'catalog-a', catalogItem: catalog[0] }];
const exercises = [
  { id: 'exercise-a', name: 'Agachamento livre', muscleGroup: 'Pernas', movement: 'Agachar', level: 'Intermediário',
    contraindications: { notes: 'Evitar em caso de lesão aguda' }, videoUrl: 'https://example.test/treino',
    _count: { workoutExercises: 3 } },
  { id: 'exercise-b', name: 'Remada', muscleGroup: 'Costas', level: 'Iniciante' },
];
beforeEach(() => {
  mockApi.mockReset();
  mockReload.mockClear();
  mockApi.mockImplementation(async (path: string, _token?: string, opts?: { method?: string }) => {
    if (path === '/equipments/catalog/candidates') return [{ id: 'candidate-a', proposedName: 'Novo aparelho', status: 'PENDING' }];
    if (path === '/equipments/catalog/governance/candidates') return [];
    if (path.startsWith('/equipments/exercises/')) return [{ id: 'inventory-a', catalogItem: { name: 'Leg Press 45°' } }];
    if (path.startsWith('/equipments/catalog?')) return catalog;
    if (path.startsWith('/exercises?')) return exercises;
    if (opts?.method === 'POST' || opts?.method === 'DELETE') return { id: 'ok' };
    throw new Error('Rota inesperada: ' + path);
  });
});
function equipment({ canManage = true, canSuggest = true, canGovern = false } = {}) {
  return render(<EquipmentIntelligencePanel inventory={inventory} catalog={catalog} catalogEnabled
    canManage={canManage} canSuggest={canSuggest} canGovern={canGovern} onUpdated={mockReload} />);
}
test('C02 inventory deselection requires explicit confirmation and targets canonical DELETE', async () => {
  const view = equipment();
  expect(view.getByText(/1 equipamento/)).toBeTruthy();
  fireEvent.press(view.getByTestId('equipment-remove-catalog-a'));
  expect(view.getByTestId('equipment-remove-confirm-catalog-a')).toBeTruthy();
  expect(mockApi.mock.calls.filter(([, , options]) => options?.method === 'DELETE')).toHaveLength(0);
  fireEvent.press(view.getByTestId('equipment-remove-confirm-catalog-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith(
    '/equipments/catalog/catalog-a/selection', undefined, { method: 'DELETE' },
  ));
  expect(mockReload).toHaveBeenCalled();
});

test('C02 inventory selection writes only canonical catalogItemIds with backend-derived tenant', async () => {
  const view = equipment();
  fireEvent.press(view.getByTestId('equipment-item-catalog-b'));
  fireEvent.press(view.getByTestId('equipment-catalog-select'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path, , options]) => path === '/equipments/catalog/selection' && options?.method === 'POST')).toBe(true));
  const call = mockApi.mock.calls.find(([path, , options]) => path === '/equipments/catalog/selection' && options?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ catalogItemIds: ['catalog-b'] });
  expect(JSON.parse(call[2].body)).not.toHaveProperty('gymId');
});

test('C02 reception cannot mutate inventory, send candidates or view catalog governance', async () => {
  const view = equipment({ canManage: false, canSuggest: false, canGovern: false });
  expect(view.queryByTestId('equipment-remove-catalog-a')).toBeNull();
  fireEvent.press(view.getByTestId('equipment-item-catalog-b'));
  expect(view.queryByTestId('equipment-catalog-select')).toBeNull();
  expect(view.queryByTestId('equipment-candidate-submit')).toBeNull();
  expect(mockApi).not.toHaveBeenCalledWith('/equipments/catalog/candidates');
  expect(mockApi).not.toHaveBeenCalledWith('/equipments/catalog/governance/candidates');
});

test('C02 trainer may propose candidate but cannot govern catalog', async () => {
  const view = equipment({ canManage: false, canSuggest: true, canGovern: false });
  await waitFor(() => expect(view.getByText(/Novo aparelho/)).toBeTruthy());
  fireEvent.changeText(view.getByTestId('equipment-candidate-name'), 'Máquina abdominal');
  fireEvent.press(view.getByTestId('equipment-candidate-submit'));
  await waitFor(() => expect(mockApi.mock.calls.some(([p, , o]) => p === '/equipments/catalog/candidates' && o?.method === 'POST')).toBe(true));
  const call = mockApi.mock.calls.find(([p, , o]) => p === '/equipments/catalog/candidates' && o?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ proposedName: 'Máquina abdominal' });
  expect(mockApi).not.toHaveBeenCalledWith('/equipments/catalog/governance/candidates');
});

test('C02 exercise library shows contraindications and loads tenant-compatible equipment', async () => {
  const view = render(<ExercisesLibraryPanel exercises={exercises} canCreate={false} onUpdated={mockReload} />);
  expect(view.getByText(/Evitar em caso de lesão aguda/)).toBeTruthy();
  fireEvent.press(view.getByTestId('exercise-compatibility-exercise-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/equipments/exercises/exercise-a/compatible'));
  expect(view.getByText(/Compatibilidade com o inventário/)).toBeTruthy();
  expect(view.queryByTestId('exercise-create')).toBeNull();
  expect(mockApi.mock.calls.filter(([, , options]) => options?.method === 'POST')).toHaveLength(0);
});

test('C02 exercise creation validates secure video URL and uses canonical exercise contract', async () => {
  const view = render(<ExercisesLibraryPanel exercises={exercises} canCreate onUpdated={mockReload} />);
  fireEvent.changeText(view.getByTestId('exercise-name'), 'Puxada alta');
  const input = view.getByPlaceholderText('URL HTTPS do vídeo (opcional)');
  fireEvent.changeText(input, 'http://example.test/video');
  expect(view.getByTestId('exercise-video-error')).toBeTruthy();
  fireEvent.press(view.getByTestId('exercise-create'));
  expect(mockApi.mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);
  fireEvent.changeText(input, 'https://example.test/video');
  fireEvent.press(view.getByTestId('exercise-create'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/exercises', undefined, expect.objectContaining({ method: 'POST' })));
  const call = mockApi.mock.calls.find(([p, , o]) => p === '/exercises' && o?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ name: 'Puxada alta', videoUrl: 'https://example.test/video' });
});
