import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { IntegrationCredentialsPanel } from '../src/components/IntegrationCredentialsPanel';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('O13 Integration Center interactions', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('starts least-privilege OAuth without browser-provided tenant or scopes', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/integrations/providers') {
        return {
          environment: 'HOMOLOG',
          providers: [{
            providerCode: 'meta',
            capabilities: ['meta.facebook', 'meta.instagram'],
            authModels: ['OAUTH2'],
            environments: ['DEV', 'HOMOLOG', 'PROD'],
            supportsWebhook: true,
            supportsOAuth: true,
            tenantEntitlementFeatureKey: 'integration.meta',
          }],
        };
      }
      if (path === '/integrations/connections') return [];
      if (path === '/integrations/oauth/meta/start') {
        return { authorizationUrl: 'https://provider.example.com/authorize' };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const view = render(<IntegrationCredentialsPanel canStartOAuth />);

    await waitFor(() => expect(view.getByTestId('integration-oauth-start')).toBeTruthy());
    fireEvent.changeText(
      view.getByTestId('integration-oauth-current-password'),
      'test-step-up-value',
    );
    fireEvent.press(view.getByTestId('integration-oauth-start'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/integrations/oauth/meta/start',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const call = mockApi.mock.calls.find(([path]) => path === '/integrations/oauth/meta/start');
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body.currentPassword).toBe('test-step-up-value');
    expect(body.capabilities).toEqual(['meta.facebook', 'meta.instagram']);
    expect(body.redirectUri).toContain('/integrations/oauth/meta/callback');
    expect(body).not.toHaveProperty('gymId');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('scopes');
    expect(openUrl).toHaveBeenCalledWith('https://provider.example.com/authorize');

    openUrl.mockRestore();
  });

  test('creates a manual credential without choosing environment or tenant', async () => {
    mockApi.mockImplementation(async (path: string, _legacy: unknown, options?: any) => {
      if (path === '/integrations/providers') {
        return {
          environment: 'HOMOLOG',
          providers: [{
            providerCode: 'fm-fiscal-core',
            capabilities: ['fiscal.bridge'],
            authModels: ['ACCESS_TOKEN'],
            environments: ['HOMOLOG', 'PROD'],
            supportsWebhook: true,
            supportsOAuth: false,
            tenantEntitlementFeatureKey: null,
          }],
        };
      }
      if (path === '/integrations/connections' && !options) return [];
      if (path === '/integrations/connections' && options?.method === 'POST') {
        return { id: 'connection-a' };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<IntegrationCredentialsPanel canStartOAuth />);

    await waitFor(() => expect(view.getByTestId('integration-create')).toBeTruthy());
    expect(view.getByText('FM Fiscal Core')).toBeTruthy();

    fireEvent.changeText(view.getByTestId('integration-create-secret'), 'test-write-only-value');
    fireEvent.changeText(
      view.getByTestId('integration-create-current-password'),
      'test-step-up-value',
    );
    fireEvent.press(view.getByTestId('integration-create'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/integrations/connections',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const call = mockApi.mock.calls.find(
      ([path, _legacy, options]) => path === '/integrations/connections' && options?.method === 'POST',
    );
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body.providerCode).toBe('fm-fiscal-core');
    expect(body.authModel).toBe('ACCESS_TOKEN');
    expect(body.capabilities).toEqual(['fiscal.bridge']);
    expect(body.secret).toBe('test-write-only-value');
    expect(body.currentPassword).toBe('test-step-up-value');
    expect(body.publicConfiguration).toEqual({});
    expect(body).not.toHaveProperty('environment');
    expect(body).not.toHaveProperty('gymId');
  });
});
