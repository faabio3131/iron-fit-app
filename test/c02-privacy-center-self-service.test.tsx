import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PrivacyCenterPanel } from '../src/components/PrivacyCenterPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

let consentAvailable = false;
const dsr = [
  { id: 'dsr-open', type: 'ACCESS', status: 'OPEN', requestedAt: '2026-10-10T12:00:00.000Z' },
  { id: 'dsr-closed', type: 'CORRECTION', status: 'FULFILLED', requestedAt: '2026-09-10T12:00:00.000Z' },
];
const docs = [{ id: 'legal-a', kind: 'PRIVACY_POLICY', version: '1.0', contentUrl: 'https://example.com/privacy' }];

beforeEach(() => {
  jest.clearAllMocks();
  consentAvailable = false;
  mockApi.mockImplementation(async (path: string, _token?: string, options?: { method?: string; body?: string }) => {
    if (path === '/privacy/dsr' && !options?.method) return dsr;
    if (path === '/privacy/legal-documents') return docs;
    if (path === '/privacy/legal-acceptances' && !options?.method) return [];
    if (path === '/privacy/consents' && !options?.method) return {
      available: consentAvailable, consentHealth: false, consentComm: false, consentBiometry: false,
    };
    if (path === '/privacy/dsr' && options?.method === 'POST') return { id: 'new-request', status: 'OPEN' };
    if (path === '/privacy/dsr/cancel' && options?.method === 'POST') return { id: 'dsr-open', status: 'CANCELLED' };
    if (path === '/privacy/legal-acceptances' && options?.method === 'POST') return { id: 'accept-a' };
    if (path === '/privacy/consents' && options?.method === 'PATCH') return { available: true };
    throw new Error('Rota inesperada: ' + path);
  });
});

test('C02 Privacy Center loads only authenticated self-service endpoints, never super-admin operations', async () => {
  const view = render(<PrivacyCenterPanel />);
  await waitFor(() => expect(view.getByText('Política de privacidade · versão 1.0')).toBeTruthy());
  for (const path of ['/privacy/dsr', '/privacy/legal-documents', '/privacy/legal-acceptances', '/privacy/consents']) {
    expect(mockApi).toHaveBeenCalledWith(path);
  }
  expect(mockApi.mock.calls.some(([path]) => path.includes('/operations/'))).toBe(false);
  expect(view.getByText(/Nenhum consentimento de terceiros pode ser alterado aqui/)).toBeTruthy();
  expect(view.queryByTestId('privacy-consent-enable-consentHealth')).toBeNull();
});

test('C02 Privacy Center requires explicit confirmation for own DSR and sends only canonical type', async () => {
  const view = render(<PrivacyCenterPanel />);
  await waitFor(() => expect(view.getByTestId('privacy-request-DELETION')).toBeTruthy());
  fireEvent.press(view.getByTestId('privacy-request-DELETION'));
  expect(mockApi.mock.calls.filter(([path, , options]) => path === '/privacy/dsr' && options?.method === 'POST')).toHaveLength(0);
  fireEvent.press(view.getByTestId('privacy-request-submit'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path, , options]) =>
    path === '/privacy/dsr' && options?.method === 'POST')).toBe(true));
  const sent = mockApi.mock.calls.find(([path, , options]) => path === '/privacy/dsr' && options?.method === 'POST');
  expect(JSON.parse(sent[2].body)).toEqual({ type: 'DELETION' });
  expect(JSON.parse(sent[2].body)).not.toHaveProperty('gymId');
  expect(JSON.parse(sent[2].body)).not.toHaveProperty('userId');
});

test('C02 Privacy Center lets user cancel only an OPEN own request with confirmation', async () => {
  const view = render(<PrivacyCenterPanel />);
  await waitFor(() => expect(view.getByTestId('privacy-cancel-dsr-open')).toBeTruthy());
  expect(view.queryByTestId('privacy-cancel-dsr-closed')).toBeNull();
  fireEvent.press(view.getByTestId('privacy-cancel-dsr-open'));
  expect(mockApi.mock.calls.some(([p]) => p === '/privacy/dsr/cancel')).toBe(false);
  fireEvent.press(view.getByTestId('privacy-cancel-confirm-dsr-open'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/privacy/dsr/cancel', undefined,
    { method: 'POST', body: JSON.stringify({ requestId: 'dsr-open' }) }));
});

test('C02 Privacy Center does not accept legal document before opening its official HTTPS URL', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    const view = render(<PrivacyCenterPanel />);
    await waitFor(() => expect(view.getByTestId('privacy-document-accept-legal-a')).toBeTruthy());
    expect(view.getByTestId('privacy-document-accept-legal-a').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(view.getByTestId('privacy-document-open-legal-a'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://example.com/privacy'));
    await waitFor(() => expect(view.getByTestId('privacy-document-accept-legal-a').props.accessibilityState?.disabled).toBe(false));
    fireEvent.press(view.getByTestId('privacy-document-accept-legal-a'));
    fireEvent.press(view.getByTestId('privacy-document-accept-confirm-legal-a'));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/privacy/legal-acceptances', undefined,
      { method: 'POST', body: JSON.stringify({ legalDocumentId: 'legal-a' }) }));
  } finally { open.mockRestore(); }
});

test('C02 Privacy Center changes only authenticated own consent when student profile exists', async () => {
  consentAvailable = true;
  const view = render(<PrivacyCenterPanel />);
  await waitFor(() => expect(view.getByTestId('privacy-consent-enable-consentComm')).toBeTruthy());
  fireEvent.press(view.getByTestId('privacy-consent-enable-consentComm'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/privacy/consents', undefined,
    { method: 'PATCH', body: JSON.stringify({ consentComm: true }) }));
  const sent = mockApi.mock.calls.find(([p, , o]) => p === '/privacy/consents' && o?.method === 'PATCH');
  expect(JSON.parse(sent[2].body)).not.toHaveProperty('studentId');
  expect(JSON.parse(sent[2].body)).not.toHaveProperty('gymId');
});

test('C02 Privacy Center does not show empty data as success when canonical reads fail', async () => {
  mockApi.mockImplementationOnce(async () => { throw new Error('Servidor indisponível'); });
  const view = render(<PrivacyCenterPanel />);
  await waitFor(() => expect(view.getByTestId('privacy-load-error')).toBeTruthy());
  expect(view.queryByText(/Você ainda não abriu solicitações LGPD/)).toBeNull();
  expect(view.queryByTestId('privacy-request-DELETION')).toBeNull();
});
