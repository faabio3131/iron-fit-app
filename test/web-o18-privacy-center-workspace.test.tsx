import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PrivacyCenter } from '../src/web/PrivacyCenter';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('O18 Privacy Center', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('self-service loads only personal privacy resources and creates DSR without operational authority', async () => {
    mockApi.mockImplementation(async (path: string, _legacy?: unknown, options?: any) => {
      if (path === '/privacy/dsr' && !options) return [];
      if (path === '/privacy/legal-documents') return [];
      if (path === '/privacy/legal-acceptances') return [];
      if (path === '/privacy/dsr' && options?.method === 'POST') {
        return { id: 'request-a', type: 'ACCESS', status: 'OPEN' };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<PrivacyCenter />);

    await waitFor(() => expect(view.getByTestId('privacy-create-request')).toBeTruthy());
    fireEvent.press(view.getByTestId('privacy-create-request'));

    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        '/privacy/dsr',
        undefined,
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const paths = mockApi.mock.calls.map(([path]) => path);
    expect(paths).not.toContain('/privacy/operations/dsr');
    expect(paths).not.toContain('/privacy/operations/governance');

    const createCall = mockApi.mock.calls.find(
      ([path, _legacy, options]) => path === '/privacy/dsr' && options?.method === 'POST',
    );
    expect(JSON.parse(String(createCall?.[2]?.body ?? '{}'))).toEqual({ type: 'ACCESS' });
  });

  test('SUPER_ADMIN mode loads governance and operational DSR queue', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/privacy/dsr') return [];
      if (path === '/privacy/legal-documents') return [];
      if (path === '/privacy/legal-acceptances') return [];
      if (path === '/privacy/operations/dsr') {
        return [{ id: 'ops-a', type: 'ACCESS', status: 'OPEN', requestedAt: '2026-09-30T12:00:00.000Z' }];
      }
      if (path === '/privacy/operations/governance') {
        return {
          openRequests: 1,
          gate: {
            retentionApproved: false,
            subprocessorsReviewed: false,
            privacyPolicyApproved: false,
            termsApproved: false,
          },
        };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<PrivacyCenter canOperatePrivacy />);

    await waitFor(() => expect(view.getByTestId('privacy-operations')).toBeTruthy());
    expect(view.getByText('Operação de privacidade')).toBeTruthy();
    expect(view.getAllByText('Não').length).toBeGreaterThan(0);
    expect(view.getByText('Pendência jurídica')).toBeTruthy();
  });
});
