import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessCenterPanel } from '../src/components/AccessCenterPanel';

const mockApi = jest.fn();
const onUpdated = jest.fn(async () => undefined);
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string, _token?: unknown, opts?: { method?: string }) => {
    if (path === '/access/devices' && opts?.method === 'POST')
      return { id: 'device-new', active: false };
    throw new Error('Unexpected API: ' + path);
  });
});

function mount(canEnrollDevices: boolean) {
  return render(<AccessCenterPanel students={[]} credentials={[]} events={[]} devices={[]}
    canManageDevices canEnrollDevices={canEnrollDevices} onUpdated={onUpdated} />);
}

test('device registration is not displayed without owner/admin permission', () => {
  const ui = mount(false);
  expect(ui.queryByTestId('access-hardware-enrollment')).toBeNull();
  expect(ui.getByText('Dispositivos de acesso')).toBeTruthy();
});

test('owner enrollment submits brand/model to canonical backend, without gymId or secrets', async () => {
  const ui = mount(true);
  fireEvent.press(ui.getByTestId('access-hardware-brand-TOPDATA'));
  fireEvent.changeText(ui.getByTestId('access-hardware-name'), 'Entrada principal');
  fireEvent.changeText(ui.getByTestId('access-hardware-model'), 'Fit 4');
  fireEvent.press(ui.getByTestId('access-hardware-create'));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  const call = mockApi.mock.calls.find(([path, , options]) => path === '/access/devices' && options?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({
    name: 'Entrada principal', model: 'Fit 4',
    manufacturer: 'TOPDATA', type: 'QR_CODE',
  });
  expect(call[2].body).not.toContain('gymId');
  expect(call[2].body).not.toContain('deviceToken');
  expect(ui.getByText(/Dispositivo cadastrado em estado inativo/)).toBeTruthy();
});

test('failed enrollment does not claim success or invent a physical activation', async () => {
  mockApi.mockRejectedValueOnce(new Error('Servidor indisponível'));
  const ui = mount(true);
  fireEvent.changeText(ui.getByTestId('access-hardware-name'), 'Catraca');
  fireEvent.changeText(ui.getByTestId('access-hardware-model'), 'iDBlock');
  fireEvent.press(ui.getByTestId('access-hardware-create'));
  await waitFor(() => expect(ui.getByTestId('access-hardware-error')).toBeTruthy());
  expect(onUpdated).not.toHaveBeenCalled();
  expect(ui.queryByText(/Dispositivo cadastrado em estado inativo/)).toBeNull();
});
