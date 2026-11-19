import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FiscalCenter } from '../src/web/FiscalCenter';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

const handoff = {
  id: 'handoff-a',
  chargeId: 'charge-a',
  status: 'AUTHORIZED',
  documentKind: 'nfse',
  operationKind: 'membership',
  amountMinor: 26900,
  currency: 'BRL',
  paymentMethod: 'PIX',
  settledAt: '2026-09-30T12:00:00.000Z',
  providerDocumentId: 'doc-a',
  attemptCount: 1,
  createdAt: '2026-09-30T12:00:01.000Z',
  updatedAt: '2026-09-30T12:00:02.000Z',
  charge: {
    student: {
      id: 'student-a',
      user: { name: 'Aluno Fiscal', email: 'aluno@example.com' },
    },
  },
};

describe('FISCAL-1 Fiscal Center', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('loads handoff status even when fiscal binding is not configured', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/financial/fiscal/scope-binding') {
        const error = new Error('not found') as Error & { status?: number };
        error.status = 404;
        throw error;
      }
      if (path === '/financial/fiscal/handoffs') return [handoff];
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<FiscalCenter />);

    await waitFor(() => expect(view.getByText('Vínculo não configurado')).toBeTruthy());
    expect(view.getByText('Aluno Fiscal')).toBeTruthy();
    expect(view.getByText('NFS-e autorizada')).toBeTruthy();
    expect(view.getByText(/269,00/)).toBeTruthy();
  });

  test('opens cancellation only for a canonical cancelable handoff', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/financial/fiscal/scope-binding') {
        return {
          id: 'binding-a',
          environment: 'HOMOLOG',
          externalTenantId: 'tenant-a',
          externalUnitId: 'unit-a',
          active: true,
        };
      }
      if (path === '/financial/fiscal/handoffs') return [handoff];
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<FiscalCenter />);

    await waitFor(() => expect(view.getByTestId('fiscal-cancel-open-handoff-a')).toBeTruthy());
    fireEvent.press(view.getByTestId('fiscal-cancel-open-handoff-a'));

    expect(view.getByText('Solicitar cancelamento da NFS-e')).toBeTruthy();
    expect(view.getByTestId('fiscal-cancel-confirm').props.accessibilityState.disabled).toBe(true);
    expect(view.getByText(/status final depende da confirmação/i)).toBeTruthy();
  });

  test('shows live NFCore readiness without falsely claiming certificate or municipality homologation', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/financial/fiscal/scope-binding') {
        return { environment: 'HOMOLOG', externalTenantId: 'tenant-a', externalUnitId: 'unit-a', active: true };
      }
      if (path === '/financial/fiscal/handoffs') return [];
      if (path === '/financial/fiscal/usage') {
        return {
          periodStart: '2026-11-01T00:00:00.000Z',
          periodEndExclusive: '2026-12-01T00:00:00.000Z',
          timezone: 'UTC',
          authorizedCount: 4,
          cancelledCount: 1,
          source: 'IRON_FISCAL_HANDOFF',
          billingStatus: 'NOT_A_COMMERCIAL_METER',
        };
      }
      if (path === '/financial/fiscal/readiness') {
        return {
          status: 'CAPABILITY_READY',
          environment: 'HOMOLOG',
          bindingConfigured: true,
          bridgeReachable: true,
          capabilityReadiness: 'HOMOLOGATION_READY',
          capabilityVersion: 'v1',
          certificateStatus: 'NOT_VERIFIED',
          municipalityStatus: 'NOT_VERIFIED',
          checkedAt: '2026-11-16T20:00:00.000Z',
        };
      }
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<FiscalCenter />);
    await waitFor(() => expect(view.getByTestId('fiscal-readiness-status').props.children)
      .toBe('Capacidade de NFS-e informada pelo serviço fiscal'));
    expect(view.getByText('Ativação fiscal não concluída')).toBeTruthy();
    expect(view.getByText('A1, município e provedor aguardam verificação')).toBeTruthy();
    expect(view.getByTestId('fiscal-operational-usage')).toBeTruthy();
    expect(view.getByText(/Autorizações confirmadas: 4/)).toBeTruthy();
    expect(view.getByText(/Não é faturamento, franquia contratada nem consumo cobrável/)).toBeTruthy();
    expect(view.getByText(/Certificado A1: sem leitura confirmada nesta sessão/)).toBeTruthy();
    expect(view.getByText(/Município e provedor emissor: homologação não verificada/)).toBeTruthy();
    expect(view.getByText(/capacidade de homologação, não uma autorização/)).toBeTruthy();
    expect(view.queryByText('Emitir NFS-e')).toBeNull();
  });

  test('fails closed visually when the fiscal readiness endpoint is not deployed', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/financial/fiscal/scope-binding') {
        const error = new Error('not found') as Error & { status?: number };
        error.status = 404;
        throw error;
      }
      if (path === '/financial/fiscal/handoffs') return [];
      if (path === '/financial/fiscal/readiness') throw new Error('unavailable');
      throw new Error('Unexpected API path: ' + path);
    });

    const view = render(<FiscalCenter />);
    await waitFor(() =>
      expect(view.getByText('Verificação de ativação indisponível neste servidor')).toBeTruthy(),
    );
    expect(view.getByText(/Certificado A1: sem leitura confirmada nesta sessão/)).toBeTruthy();
  });

});


test('A1 validity is rendered only from a verified unexpired Vault response and cleared on failure', async () => {
  mockApi.mockReset();
  let expired = false;
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/financial/fiscal/scope-binding') return { environment: 'HOMOLOG', externalTenantId: 't', externalUnitId: 'u', active: true };
    if (path === '/financial/fiscal/handoffs') return [];
    if (path === '/financial/fiscal/a1/status') return {
      status: 'STORED', source: 'NFCORE_VAULT_READBACK', officialHomologation: 'NOT_VERIFIED',
      expiresAt: expired ? '2000-01-01T00:00:00.000Z' : '2099-01-01T00:00:00.000Z',
    };
    throw new Error('unavailable');
  });
  const view = render(<FiscalCenter canManageA1 />);
  await waitFor(() => expect(view.getByTestId('fiscal-a1-read-status')).toBeTruthy());
  fireEvent.press(view.getByTestId('fiscal-a1-read-status'));
  await waitFor(() => expect(view.getByTestId('fiscal-a1-expiry')).toBeTruthy());
  expect(view.getByText(/Validade informada pelo cofre/)).toBeTruthy();
  expired = true;
  fireEvent.press(view.getByTestId('fiscal-a1-read-status'));
  await waitFor(() => expect(view.getByTestId('fiscal-a1-error')).toBeTruthy());
  expect(view.queryByTestId('fiscal-a1-expiry')).toBeNull();
  expect(view.getByText('Status ainda não confirmado')).toBeTruthy();
});
