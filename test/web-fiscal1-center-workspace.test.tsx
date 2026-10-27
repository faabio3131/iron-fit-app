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
});
