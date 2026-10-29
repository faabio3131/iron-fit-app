import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { qrImageUri, WhatsAppConnectCard } from '../src/components/WhatsAppConnectCard';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('WhatsApp por QR Code (Evolution)', () => {
  beforeEach(() => mockApi.mockReset());

  test('mostra o QR Code ao conectar, sem pedir chave de API', async () => {
    mockApi.mockImplementation(async (path: string, _l: unknown, options?: any) => {
      if (path === '/integrations/evolution/status') return { configured: false, status: 'DISCONNECTED' };
      if (path === '/integrations/evolution/connect' && options?.method === 'POST') {
        return { configured: true, status: 'QR_PENDING', expiresInSeconds: 60, qr: { base64: 'data:image/png;base64,QUJD', pairingCode: 'ABCD-1234' } };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<WhatsAppConnectCard />);
    await waitFor(() => expect(view.getByText('Desconectado')).toBeTruthy());
    expect(view.queryByText(/chave de api/i)).toBeNull();

    fireEvent.press(view.getByTestId('whatsapp-connect'));
    await waitFor(() => expect(view.getByTestId('whatsapp-qr')).toBeTruthy());
    expect(view.getByText('Aguardando leitura')).toBeTruthy();
    expect(view.getByText(/ABCD-1234/)).toBeTruthy();
    expect(String(view.getByTestId('whatsapp-qr-countdown').props.children)).toMatch(/^Expira em \d+s$/);
  });

  test('mostra conectado e permite desconectar', async () => {
    mockApi.mockImplementation(async (path: string, _l: unknown, options?: any) => {
      if (path === '/integrations/evolution/status') return { configured: true, status: 'CONNECTED' };
      if (path === '/integrations/evolution/connection' && options?.method === 'DELETE') return { ok: true };
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<WhatsAppConnectCard />);
    await waitFor(() => expect(view.getByText('Conectado')).toBeTruthy());
    expect(view.queryByTestId('whatsapp-connect')).toBeNull();

    fireEvent.press(view.getByTestId('whatsapp-disconnect'));
    await waitFor(() => expect(view.getByText('Desconectado')).toBeTruthy());
    expect(mockApi).toHaveBeenCalledWith('/integrations/evolution/connection', undefined, expect.objectContaining({ method: 'DELETE' }));
  });

  test('exibe erro legível quando a Evolution da FM não está disponível', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/integrations/evolution/status') return { configured: false, status: 'DISCONNECTED' };
      throw new Error('Serviço de WhatsApp indisponível');
    });
    const view = render(<WhatsAppConnectCard />);
    await waitFor(() => expect(view.getByText('Desconectado')).toBeTruthy());
    fireEvent.press(view.getByTestId('whatsapp-connect'));
    await waitFor(() => expect(view.getByText('Serviço de WhatsApp indisponível')).toBeTruthy());
    expect(view.queryByTestId('whatsapp-qr')).toBeNull();
  });

  test('qrImageUri só aceita imagem base64 válida', () => {
    expect(qrImageUri('data:image/png;base64,QUJD')).toBe('data:image/png;base64,QUJD');
    expect(qrImageUri('QUJD')).toBe('data:image/png;base64,QUJD');
    expect(qrImageUri('javascript:alert(1)')).toBeNull();
    expect(qrImageUri('data:text/html;base64,QUJD')).toBeNull();
    expect(qrImageUri(undefined)).toBeNull();
  });
});
