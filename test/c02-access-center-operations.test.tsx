import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessCenterPanel } from '../src/components/AccessCenterPanel';

const mockApi = jest.fn();
const onUpdated = jest.fn(async () => undefined);
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const students = [{ id: 'student-a', name: 'Ana' }];
const credentials = [
  { id: 'cred-a', type: 'QR_CODE', status: 'ACTIVE', active: true,
    expiresAt: null, student: { user: { name: 'Ana' } } },
  { id: 'cred-b', type: 'QR_CODE', status: 'INACTIVE', active: false,
    student: { user: { name: 'Bruno' } } },
];
const devices = [{ id: 'device-a', name: 'Catraca principal', active: true, type: 'QR', protocol: 'HTTP' }];
const events = [
  { id: 'evt-a', allowed: true, occurredAt: '2026-10-24T08:00:00.000Z',
    device: { name: 'Catraca principal' }, student: { user: { name: 'Ana' } } },
  { id: 'evt-b', allowed: false, occurredAt: '2026-10-24T10:00:00.000Z',
    device: { name: 'Catraca principal' }, denialReason: 'Credencial expirada' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string, _token?: string, options?: { method?: string; body?: string }) => {
    if (path === '/access/credentials' && options?.method === 'POST')
      return { credentialId: 'cred-new', qrToken: 'secret-qr-one-time', type: 'QR_CODE' };
    if (path === '/access/credentials/cred-a/revoke' && options?.method === 'PATCH')
      return { id: 'cred-a', active: false };
    if (path.startsWith('/access/events')) return [events[1]];
    throw new Error('Rota inesperada: ' + path);
  });
});

function mount(canManageDevices = true) {
  return render(<AccessCenterPanel students={students} credentials={credentials}
    devices={devices} events={events} canManageDevices={canManageDevices} onUpdated={onUpdated} />);
}

test('C02 Access Center issues only backend credential, holds token one time and does not send gymId', async () => {
  const view = mount();
  fireEvent.press(view.getByTestId('access-student-student-a'));
  fireEvent.press(view.getByTestId('access-credential-create'));
  await waitFor(() => expect(view.getByTestId('access-one-time-credential')).toBeTruthy());
  const call = mockApi.mock.calls.find(([path, , options]) => path === '/access/credentials' && options?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ studentId: 'student-a', type: 'QR_CODE' });
  expect(JSON.parse(call[2].body)).not.toHaveProperty('gymId');
  expect(view.getByText('secret-qr-one-time')).toBeTruthy();
  fireEvent.press(view.getByTestId('access-hide-token'));
  expect(view.queryByText('secret-qr-one-time')).toBeNull();
  expect(mockApi.mock.calls.filter(([path, , options]) => path === '/access/credentials' && options?.method === 'POST')).toHaveLength(1);
});

test('C02 Access Center uses explicit confirmation before revocation and never revokes inactive credential', async () => {
  const view = mount();
  expect(view.queryByTestId('access-revoke-cred-b')).toBeNull();
  fireEvent.press(view.getByTestId('access-revoke-cred-a'));
  expect(view.getByTestId('access-revoke-confirm-cred-a')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/access/credentials/cred-a/revoke', undefined, expect.anything());
  fireEvent.press(view.getByTestId('access-revoke-confirm-cred-a'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/access/credentials/cred-a/revoke', undefined, { method: 'PATCH' }));
  expect(onUpdated).toHaveBeenCalledTimes(1);
});

test('C02 Access Center filters real access events, translating denied decision without tenant spoofing', async () => {
  const view = mount();
  expect(view.getByTestId('access-event-evt-a')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('access-events-from'), '2026-10-01');
  fireEvent.changeText(view.getByTestId('access-events-to'), '2026-10-25');
  fireEvent.press(view.getByText('Negados'));
  fireEvent.press(view.getByTestId('access-events-filter'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path.startsWith('/access/events?'))).toBe(true));
  await waitFor(() => expect(view.queryByTestId('access-event-evt-a')).toBeNull());
  const call = mockApi.mock.calls.find(([path]) => path.startsWith('/access/events?'));
  expect(call[0]).toContain('allowed=false');
  expect(call[0]).toContain('from=2026-10-01');
  expect(call[0]).toContain('to=2026-10-25');
  expect(call[0]).not.toContain('gymId=');
  expect(view.getByText('Motivo: Credencial expirada')).toBeTruthy();
});

test('C02 Access Center denies administrative devices surface for RECEPTION', () => {
  const view = mount(false);
  expect(view.queryByText('Dispositivos de acesso')).toBeNull();
  expect(view.queryByTestId('access-device-device-a')).toBeNull();
  expect(view.getByText('Credenciais dos alunos')).toBeTruthy();
  expect(mockApi).not.toHaveBeenCalledWith('/access/devices');
});

test('C02 Access Center rejects malformed dates without requesting unauthorized history', async () => {
  const view = mount();
  fireEvent.changeText(view.getByTestId('access-events-from'), '2026-13-01');
  fireEvent.press(view.getByTestId('access-events-filter'));
  expect(view.getByTestId('access-events-error')).toBeTruthy();
  expect(mockApi.mock.calls.some(([path]) => path.startsWith('/access/events'))).toBe(false);
});

test('C02 Access Center preserves confirmed one-time token if list refresh fails', async () => {
  onUpdated.mockRejectedValueOnce(new Error('GET failed'));
  const view = mount();
  fireEvent.press(view.getByTestId('access-student-student-a'));
  fireEvent.press(view.getByTestId('access-credential-create'));
  await waitFor(() => expect(view.getByText(/Credencial emitida, mas a lista não foi atualizada/)).toBeTruthy());
  expect(view.getByTestId('access-one-time-credential')).toBeTruthy();
  expect(mockApi.mock.calls.filter(([path, , opts]) => path === '/access/credentials' && opts?.method === 'POST')).toHaveLength(1);
});
