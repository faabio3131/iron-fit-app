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
    if (path === '/access/devices/d-a/provision' && opts?.method === 'POST')
      return { deviceId: 'd-a', deviceToken: 'secret-for-installer' };
    if (path === '/access/devices/d-a/firmware' && opts?.method === 'PATCH')
      return { id: 'd-a', firmwareVersion: 'firmware-1', certificationStatus: 'NOT_HOMOLOGATED' };
    throw new Error('Unexpected API: ' + path);
  });
});

function mount(canEnrollDevices: boolean, devices: any[] = []) {
  return render(<AccessCenterPanel students={[]} credentials={[]} events={[]} devices={devices}
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

test('owner provisions inactive device token one time without storing it in form fields', async () => {
  const ui = mount(true, [{ id: 'd-a', name: 'Entrada', active: false }]);
  fireEvent.press(ui.getByTestId('access-hardware-provision-d-a'));
  await waitFor(() => expect(ui.getByTestId('access-hardware-one-time-token')).toBeTruthy());
  expect(ui.getByText('secret-for-installer')).toBeTruthy();
  expect(mockApi).toHaveBeenCalledWith('/access/devices/d-a/provision', undefined, { method: 'POST' });
  fireEvent.press(ui.getByTestId('access-hardware-hide-token'));
  expect(ui.queryByText('secret-for-installer')).toBeNull();
});

test('manager can see existing devices but cannot provision installation credentials', () => {
  const ui = mount(false, [{ id: 'd-a', name: 'Entrada', active: false }]);
  expect(ui.getByTestId('access-device-d-a')).toBeTruthy();
  expect(ui.queryByTestId('access-hardware-provision-d-a')).toBeNull();
});

test('owner configures real firmware and receives explicit loss of prior homologation', async () => {
  const ui = mount(true, [{ id: 'd-a', name: 'Entrada', active: false }]);
  fireEvent.changeText(ui.getByTestId('access-hardware-firmware-d-a'), 'firmware-1');
  fireEvent.press(ui.getByTestId('access-hardware-save-firmware-d-a'));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  expect(mockApi).toHaveBeenCalledWith('/access/devices/d-a/firmware', undefined, {
    method: 'PATCH', body: JSON.stringify({ firmwareVersion: 'firmware-1' }),
  });
  expect(ui.getByText(/A homologação anterior foi invalidada/)).toBeTruthy();
});

test('non-owner cannot configure physical device firmware', () => {
  const ui = mount(false, [{ id: 'd-a', name: 'Entrada', active: false }]);
  expect(ui.queryByTestId('access-hardware-save-firmware-d-a')).toBeNull();
});
