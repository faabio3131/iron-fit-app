import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CommunicationCenter } from '../src/web/CommunicationCenter';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('COM-1 Communication Center', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('RECEPTION surface does not request automations or integration administration and blocks queue without consent', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/communication/templates') return [];
      if (path === '/communication/messages') return [];
      if (path === '/students') return [{ id: 'student-a', name: 'Aluno A' }];
      if (path === '/students/student-a') return { id: 'student-a', name: 'Aluno A', consentComm: false };
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<CommunicationCenter />);

    await waitFor(() => expect(view.getByText('Aluno A')).toBeTruthy());
    fireEvent.press(view.getByText('Aluno A'));

    await waitFor(() => expect(view.getByText('Comunicação não autorizada')).toBeTruthy());
    expect(view.getByTestId('communication-queue-message').props.accessibilityState.disabled).toBe(true);

    const paths = mockApi.mock.calls.map(([path]) => path);
    expect(paths).not.toContain('/communication/automations');
    expect(paths).not.toContain('/integrations/connections');
    expect(paths).not.toContain('/integrations/providers');
  });

  test('queues WhatsApp through canonical backend without tenant/provider authority in payload', async () => {
    mockApi.mockImplementation(async (path: string, _legacy?: unknown, options?: any) => {
      if (path === '/communication/templates') return [];
      if (path === '/communication/messages' && !options) return [];
      if (path === '/students') return [{ id: 'student-a', name: 'Aluno A' }];
      if (path === '/students/student-a') return { id: 'student-a', name: 'Aluno A', consentComm: true };
      if (path === '/communication/messages' && options?.method === 'POST') {
        return { id: 'message-a', status: 'QUEUED' };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<CommunicationCenter />);

    await waitFor(() => expect(view.getByText('Aluno A')).toBeTruthy());
    fireEvent.press(view.getByText('Aluno A'));
    await waitFor(() => expect(view.getByText('Comunicação autorizada')).toBeTruthy());

    fireEvent.changeText(view.getByLabelText('Mensagem'), 'Lembrete de treino');
    fireEvent.press(view.getByTestId('communication-queue-message'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/communication/messages',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const call = mockApi.mock.calls.find(
      ([path, _legacy, options]) => path === '/communication/messages' && options?.method === 'POST',
    );
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body).toEqual({
      studentId: 'student-a',
      channel: 'WHATSAPP',
      body: 'Lembrete de treino',
    });
    expect(body).not.toHaveProperty('gymId');
    expect(body).not.toHaveProperty('providerCode');
    expect(body).not.toHaveProperty('credential');
  });

  test('OWNER surface can inspect governed Meta connection and automation list without exposing secrets', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/communication/templates') return [];
      if (path === '/communication/messages') return [];
      if (path === '/students') return [];
      if (path === '/communication/automations') {
        return [{ id: 'auto-a', name: 'Lembrete', triggerEvent: 'SCHEDULE_REMINDER', active: true }];
      }
      if (path === '/integrations/connections') {
        return [{ providerCode: 'meta', status: 'ACTIVE', capabilities: ['meta.whatsapp'] }];
      }
      if (path === '/integrations/providers') return { environment: 'HOMOLOG', providers: [] };
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(
      <CommunicationCenter canManageAutomations canInspectIntegrations />,
    );

    await waitFor(() => expect(view.getByText('Conexão Meta ativa')).toBeTruthy());
    expect(view.getByTestId('communication-automations')).toBeTruthy();
    expect(view.getByText('Lembrete')).toBeTruthy();
    expect(view.getByText('Ativa')).toBeTruthy();
  });
});
