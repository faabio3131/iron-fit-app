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
