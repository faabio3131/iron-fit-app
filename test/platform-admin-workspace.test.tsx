import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PlatformAdminWorkspace } from '../src/web/PlatformAdminWorkspace';
import { CommercialWebApp } from '../src/web/CommercialWebApp';

const mockApi = jest.fn();
const mockAuth: { current: any } = { current: null };

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuth.current,
}));

const superAdmin = {
  activeTenantId: null,
  logout: jest.fn(),
  profile: { id: 'u-root', name: 'Administrador FM Tecnologia', roles: ['SUPER_ADMIN'], permissions: [] },
};

describe('Plataforma FM (SUPER_ADMIN sem academia)', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockAuth.current = superAdmin;
  });

  test('SUPER_ADMIN sem academia vê a área de plataforma e não consulta dados de tenant', async () => {
    mockApi.mockResolvedValue([]);
    const view = render(<CommercialWebApp />);
    await waitFor(() => expect(view.getByTestId('platform-admin-workspace')).toBeTruthy());
    expect(view.getByText('Plataforma FM Tecnologia')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Não configurada')).toBeTruthy());
    const paths = mockApi.mock.calls.map((call) => String(call[0]));
    expect(paths.every((path) => path.startsWith('/admin/integrations/connections'))).toBe(true);
    expect(paths.some((path) => path.includes('entitlements'))).toBe(false);
  });

  test('registra a Evolution com confirmação de senha e limpa os campos sensíveis', async () => {
    mockApi.mockImplementation(async (path: string, _l: unknown, options?: any) => {
      if (path === '/admin/integrations/connections' && !options) return [];
      if (path === '/admin/integrations/connections' && options?.method === 'POST') return { id: 'c1' };
      throw new Error('Unexpected API path: ' + path);
    });
    const view = render(<PlatformAdminWorkspace />);
    await waitFor(() => expect(view.getByText('Não configurada')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('platform-evolution-key'), 'chave-secreta-da-evolution');
    fireEvent.changeText(view.getByTestId('platform-evolution-password'), 'SenhaDoAdmin#2026');
    fireEvent.press(view.getByTestId('platform-evolution-register'));

    await waitFor(() => expect(view.getByText(/Conexão registrada no Cofre/)).toBeTruthy());
    const post = mockApi.mock.calls.find((call) => call[2]?.method === 'POST')!;
    const body = JSON.parse(post[2].body);
    expect(body).toMatchObject({
      providerCode: 'evolution',
      authModel: 'API_KEY',
      capabilities: ['evolution.whatsapp'],
      secret: 'chave-secreta-da-evolution',
      currentPassword: 'SenhaDoAdmin#2026',
    });
    expect(body.publicConfiguration.baseUrl).toBe('https://api.atendevendeia.com.br');
    expect(view.getByTestId('platform-evolution-key').props.value).toBe('');
    expect(view.getByTestId('platform-evolution-password').props.value).toBe('');
    expect(view.getByTestId('platform-evolution-key').props.secureTextEntry).toBe(true);
  });

  test('exige HTTPS e senha antes de habilitar o registro', async () => {
    mockApi.mockResolvedValue([]);
    const view = render(<PlatformAdminWorkspace />);
    await waitFor(() => expect(view.getByText('Não configurada')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('platform-evolution-key'), 'x');
    fireEvent.changeText(view.getByTestId('platform-evolution-password'), 'SenhaDoAdmin#2026');
    fireEvent.changeText(view.getByTestId('platform-evolution-base-url'), 'http://inseguro.example');
    fireEvent.press(view.getByTestId('platform-evolution-register'));
    expect(mockApi.mock.calls.some((call) => call[2]?.method === 'POST')).toBe(false);
  });

  test('com chave já no Cofre mostra substituir e verificar, sem expor segredo', async () => {
    mockApi.mockImplementation(async (path: string, _l: unknown, options?: any) => {
      if (path === '/admin/integrations/connections' && !options) {
        return [{ id: 'c1', providerCode: 'evolution', status: 'ACTIVE', credentialConfigured: true, publicConfiguration: { baseUrl: 'https://evo.example.com', webhookUrl: 'https://api.example.com/api/v1/webhooks/evolution' }, secretRotatedAt: '2026-10-29T12:00:00Z', lastVerifiedAt: null }];
      }
      if (path === '/admin/integrations/connections/c1/verify' && options?.method === 'POST') return { ok: true };
      throw new Error('Unexpected API path: ' + path);
    });
    const view = render(<PlatformAdminWorkspace />);
    await waitFor(() => expect(view.getByText('Chave no Cofre')).toBeTruthy());
    expect(view.getByTestId('platform-evolution-base-url').props.value).toBe('https://evo.example.com');
    expect(view.getByTestId('platform-evolution-replace')).toBeTruthy();

    fireEvent.changeText(view.getByTestId('platform-evolution-password'), 'SenhaDoAdmin#2026');
    fireEvent.press(view.getByTestId('platform-evolution-verify'));
    await waitFor(() => expect(view.getByText('Verificação concluída.')).toBeTruthy());
  });
});
