import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReceptionAccessTerminal } from '../src/components/ReceptionAccessTerminal';
import { StudentAccessQrCard } from '../src/components/StudentAccessQrCard';
import { api } from '../src/services/api';
jest.mock('../src/services/api', () => ({ api: jest.fn() }));
const mocked = api as jest.Mock;
beforeEach(() => jest.clearAllMocks());
const allowed = { eventId: 'event', allowed: true, status: 'REVIEW', denialReason: null, warning: 'Avaliacao fisica nao cadastrada', occurredAt: '2026-11-04T12:00:00Z', student: { id: 'student', name: 'Ana' } };
test('manual terminal uses authenticated API and server warning without client financial authority', async () => {
  mocked.mockResolvedValue(allowed);
  const view = render(<ReceptionAccessTerminal students={[{ id: 'student', cpf: '52998224725', user: { name: 'Ana' } }]} />);
  fireEvent.changeText(view.getByTestId('terminal-search'), '529982');
  fireEvent.press(view.getByTestId('terminal-check-student'));
  await waitFor(() => expect(view.getByText('Entrada permitida com aviso')).toBeTruthy());
  expect(mocked.mock.calls[0][0]).toBe('/access/terminal/check-in');
  const body = JSON.parse(mocked.mock.calls[0][2].body);
  expect(body.studentId).toBe('student'); expect(body.gymId).toBeUndefined(); expect(body.allowed).toBeUndefined();
});
test('lost response retains request identity; retry confirms one canonical result and no false green', async () => {
  mocked.mockRejectedValueOnce(new Error('network')).mockResolvedValue(allowed);
  const view = render(<ReceptionAccessTerminal students={[{ id: 'student', name: 'Ana' }]} />);
  fireEvent.changeText(view.getByTestId('terminal-search'), 'Ana');
  fireEvent.press(view.getByTestId('terminal-check-student'));
  await waitFor(() => expect(view.getByTestId('terminal-retry')).toBeTruthy());
  expect(view.queryByTestId('terminal-decision')).toBeNull();
  fireEvent.press(view.getByTestId('terminal-retry'));
  await waitFor(() => expect(view.getByTestId('terminal-decision')).toBeTruthy());
  expect(mocked.mock.calls[0][2].body).toBe(mocked.mock.calls[1][2].body);
});
test('keyboard wedge submits actual native text and renders backend denial', async () => {
  mocked.mockResolvedValue({ ...allowed, status: 'DENIED', allowed: false, warning: null, denialReason: 'Credencial invalida ou expirada', student: null });
  const view = render(<ReceptionAccessTerminal students={[]} />);
  fireEvent(view.getByTestId('terminal-qr'), 'submitEditing', { nativeEvent: { text: 'real-scanner-token-123456' } });
  await waitFor(() => expect(view.getByText('Entrada negada')).toBeTruthy());
  expect(JSON.parse(mocked.mock.calls[0][2].body).qrToken).toBe('real-scanner-token-123456');
});
test('student QR comes from own portal API and fails closed without success content', async () => {
  mocked.mockRejectedValueOnce(new Error('QR indisponivel'));
  const view = render(<StudentAccessQrCard />);
  fireEvent.press(view.getByTestId('student-qr-generate'));
  await waitFor(() => expect(view.getByText('QR indisponivel')).toBeTruthy());
  expect(view.queryByLabelText('Seu QR temporário de entrada')).toBeNull();
  mocked.mockResolvedValue({ credentialId: 'own', imageDataUrl: 'data:image/png;base64,iVBOR', expiresAt: new Date(Date.now() + 120000).toISOString() });
  fireEvent.press(view.getByTestId('student-qr-generate'));
  await waitFor(() => expect(view.getByLabelText('Seu QR temporário de entrada')).toBeTruthy());
  expect(mocked.mock.calls[0]).toEqual(['/me/access/qr-code', undefined, { method: 'POST' }]);
  view.unmount();
});
