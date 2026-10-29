import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EquipmentOperationControl } from '../src/components/EquipmentOperationControl';
const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
beforeEach(() => mockApi.mockReset());

test('maintenance uses canonical equipment identity without accepting tenant or actor in the payload', async () => {
  mockApi.mockResolvedValue({ operationalStatus: 'MAINTENANCE' });
  const reload = jest.fn(async () => undefined);
  const view = render(<EquipmentOperationControl id="equipment-a" status="OPERATIONAL" canManage onUpdated={reload} />);
  fireEvent.press(view.getByText('Registrar manutenção'));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(mockApi).toHaveBeenCalledWith('/equipments/equipment-a/operational-status', undefined, { method: 'POST', body: JSON.stringify({ status: 'MAINTENANCE' }) });
  expect(view.getByText('Situação operacional atualizada.')).toBeTruthy();
});

test('read-only profiles and unknown backend status cannot submit operational changes', () => {
  const view = render(<EquipmentOperationControl id="e" status="OUT_OF_SERVICE" canManage={false} onUpdated={jest.fn()} />);
  expect(view.getByText('Fora de serviço')).toBeTruthy();
  expect(view.queryByText('Liberar para uso')).toBeNull();
  view.rerender(<EquipmentOperationControl id="e" canManage onUpdated={jest.fn()} />);
  expect(view.getByText('Não informada')).toBeTruthy();
  expect(view.queryByText('Registrar manutenção')).toBeNull();
  expect(mockApi).not.toHaveBeenCalled();
});

test('backend denial keeps the authoritative status and offers retry without claiming success', async () => {
  mockApi.mockRejectedValue(new Error('Sem autorização para alterar este equipamento.'));
  const reload = jest.fn();
  const view = render(<EquipmentOperationControl id="e" status="OPERATIONAL" canManage onUpdated={reload} />);
  fireEvent.press(view.getByText('Marcar fora de serviço'));
  await waitFor(() => expect(view.getByText('Sem autorização para alterar este equipamento.')).toBeTruthy());
  expect(view.getByText('Disponível para uso')).toBeTruthy();
  expect(view.queryByText('Situação operacional atualizada.')).toBeNull();
  expect(reload).not.toHaveBeenCalled();
  mockApi.mockResolvedValue({ operationalStatus: 'OUT_OF_SERVICE' });
  fireEvent.press(view.getByText('Marcar fora de serviço'));
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
});
