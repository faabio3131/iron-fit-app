import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: any[]) => mockApi(...args) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ profile: { roles: ['OWNER'] }, activeTenantId: 'gym-a' }) }));
import { ManagerAlertBell, ManagerAlertsPanel } from '../src/components/ManagerAlertsPanel';

function installApi() {
  mockApi.mockImplementation(async (path: string, _query?: unknown, options?: { method?: string }) => {
    if (path === '/manager-alerts/counters') return { unread: 3, open: 2, critical: 1 };
    if (path.startsWith('/manager-alerts?')) return { items: [{ id: 'alert-a', category: 'SECURITY', severity: 'CRITICAL', status: 'OPEN', title: 'Acesso suspeito', message: 'Verifique o acesso.', occurredAt: '2026-10-29T00:00:00.000Z', recipient: { readAt: null } }], page: { unread: 1, total: 1 } };
    if (path === '/manager-alerts/preferences') return [{ category: 'SECURITY', emailEnabled: false, pushEnabled: false, whatsappEnabled: false, minimumSeverity: 'INFO' }];
    if (path === '/integrations/evolution/status') return { configured: false, status: 'DISCONNECTED' };
    if (path === '/manager-alerts/alert-a/acknowledge' && options?.method === 'PATCH') return { id: 'alert-a', status: 'ACKNOWLEDGED' };
    if (path === '/manager-alerts/preferences/SECURITY' && options?.method === 'PUT') return { category: 'SECURITY', emailEnabled: true };
    if (path === '/integrations/evolution/connect' && options?.method === 'POST') return { status: 'QR_PENDING', qr: { base64: 'ZmFrZQ==' } };
    throw new Error(`Unexpected API ${options?.method ?? 'GET'} ${path}`);
  });
}

beforeEach(() => { mockApi.mockReset(); installApi(); });

test('bell exposes the canonical unread count and opens the inbox', async () => {
  const onOpen = jest.fn();
  const view = render(<ManagerAlertBell onOpen={onOpen} />);
  await waitFor(() => expect(view.getByLabelText('3 alertas não lidos')).toBeTruthy());
  fireEvent.press(view.getByTestId('manager-alert-bell'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('owner can inspect, acknowledge and opt into channels without exposing a key', async () => {
  const view = render(<ManagerAlertsPanel />);
  await waitFor(() => expect(view.getByText('Acesso suspeito')).toBeTruthy());
  fireEvent.press(view.getByText('Reconhecer'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/manager-alerts/alert-a/acknowledge', undefined, { method: 'PATCH' }));
  fireEvent.press(view.getByText('E-mail'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/manager-alerts/preferences/SECURITY', undefined, expect.objectContaining({ method: 'PUT' })));
  fireEvent.press(view.getByTestId('evolution-connect'));
  await waitFor(() => expect(view.getByLabelText('QR Code para conectar o WhatsApp')).toBeTruthy());
  expect(view.queryByText(/api.?key/i)).toBeNull();
});

test('unavailable push is explicit and cannot promise activation', async () => {
  const view = render(<ManagerAlertsPanel />);
  await waitFor(() => expect(view.getByText('Push indisponível')).toBeTruthy());
  fireEvent.press(view.getByText('Push indisponível'));
  expect(mockApi.mock.calls.some(([, , options]) => options?.body?.includes('pushEnabled'))).toBe(false);
});

test('optional Evolution and preference failures cannot hide the canonical inbox', async () => {
  const baseline = mockApi.getMockImplementation()!;
  mockApi.mockImplementation((path: string, ...args: unknown[]) => {
    if (path === '/integrations/evolution/status' || path === '/manager-alerts/preferences') return Promise.reject(new Error('Canal indisponível'));
    return baseline(path, ...args);
  });
  const view = render(<ManagerAlertsPanel />);
  await waitFor(() => expect(view.getByText('Acesso suspeito')).toBeTruthy());
  expect(view.queryByText('Tudo em ordem por aqui')).toBeNull();
  expect(view.getByText(/Situação: Indisponível/)).toBeTruthy();
});

test('a pending provider request does not hold the mandatory inbox in loading state', async () => {
  const baseline = mockApi.getMockImplementation()!;
  mockApi.mockImplementation((path: string, ...args: unknown[]) => path === '/integrations/evolution/status' ? new Promise(() => {}) : baseline(path, ...args));
  const view = render(<ManagerAlertsPanel />);
  await waitFor(() => expect(view.getByText('Acesso suspeito')).toBeTruthy());
  expect(view.queryByText('Carregando alertas autorizados…')).toBeNull();
});

test('failed inbox is unavailable rather than a false empty success', async () => {
  const baseline = mockApi.getMockImplementation()!;
  mockApi.mockImplementation((path: string, ...args: unknown[]) => path.startsWith('/manager-alerts?') ? Promise.reject(new Error('Falha no inbox')) : baseline(path, ...args));
  const view = render(<ManagerAlertsPanel />);
  await waitFor(() => expect(view.getByText('Falha no inbox')).toBeTruthy());
  expect(view.getByText(/Contagem indisponível/)).toBeTruthy();
  expect(view.queryByText('Tudo em ordem por aqui')).toBeNull();
  expect(view.queryByText(/Nenhum alerta não lido/)).toBeNull();
});

test('counter failure is unknown and never presented as zero alerts', async () => {
  mockApi.mockRejectedValue(new Error('Sem conexão'));
  const view = render(<ManagerAlertBell onOpen={jest.fn()} />);
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/manager-alerts/counters'));
  expect(view.getByLabelText('Alertas: contagem indisponível')).toBeTruthy();
  expect(view.getByText('!')).toBeTruthy();
});
