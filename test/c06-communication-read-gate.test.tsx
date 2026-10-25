import React from 'react';
import fs from 'node:fs';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CommunicationCenterPanel } from '../src/components/CommunicationCenterPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function normal(path: string): unknown {
  if (path === '/students') return [{ id: 'student-a', name: 'Ana', status: 'ACTIVE' }];
  if (path === '/communication/templates') return [{ id: 'template-a', name: 'Boas-vindas', body: 'Olá', channel: 'WHATSAPP' }];
  if (path === '/communication/messages') return [{ id: 'msg-a', body: 'Olá', status: 'QUEUED', channel: 'WHATSAPP' }];
  if (path === '/communication/automations') return [{ id: 'auto-a', name: 'Recepção', triggerEvent: 'ADMISSION', active: true }];
  throw new Error('unexpected path ' + path);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockApi.mockImplementation(async (path: string) => normal(path));
});

test('C06 unavailable GET never masquerades as zero messages or permits queue/template writes', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/communication/messages') throw new Error('HTTP 503 indisponível');
    return normal(path);
  });
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-read-error')).toBeTruthy());
  expect(view.getByText('HTTP 503 indisponível')).toBeTruthy();
  expect(view.queryByText('Nenhuma mensagem registrada.')).toBeNull();
  expect(view.queryByTestId('communication-student-student-a')).toBeNull();
  expect(view.queryByTestId('communication-prepare-queue')).toBeNull();
  expect(view.queryByTestId('communication-template-create')).toBeNull();
  expect(mockApi.mock.calls.some(([, , opts]) => opts?.method === 'POST')).toBe(false);
});

test('C06 retry reenables operations only after authoritative successful reads', async () => {
  let failed = true;
  mockApi.mockImplementation(async (path: string) => {
    if (failed && path === '/communication/messages') throw new Error('Falha temporária');
    return normal(path);
  });
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-read-error')).toBeTruthy());
  failed = false;
  fireEvent.press(view.getByTestId('communication-retry'));
  await waitFor(() => expect(view.getByTestId('communication-student-student-a')).toBeTruthy());
  expect(view.queryByTestId('communication-read-gate')).toBeNull();
  expect(view.getByText(/Na fila/)).toBeTruthy();
});

test('C06 malformed successful payload fails closed instead of fabricating empty lists', async () => {
  mockApi.mockImplementation(async (path: string) => path === '/communication/templates' ? { items: [] } : normal(path));
  const view = render(<CommunicationCenterPanel canManageAutomations />);
  await waitFor(() => expect(view.getByTestId('communication-read-error')).toBeTruthy());
  expect(view.getByText('O servidor retornou dados inválidos de comunicação.')).toBeTruthy();
  expect(view.queryByTestId('communication-template-create')).toBeNull();
  expect(view.queryByText('Nenhuma automação cadastrada.')).toBeNull();
});

test('C06 a failed refresh hides previously loaded names and messages until retry', async () => {
  let failed = false;
  mockApi.mockImplementation(async (path: string) => {
    if (failed && path === '/students') throw new Error('Falha de tenant');
    return normal(path);
  });
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-student-student-a')).toBeTruthy());
  failed = true;
  fireEvent.press(view.getByTestId('communication-refresh'));
  await waitFor(() => expect(view.getByTestId('communication-read-error')).toBeTruthy());
  expect(view.queryByTestId('communication-student-student-a')).toBeNull();
  expect(view.queryByText('Olá')).toBeNull();
  expect(view.queryByTestId('communication-confirm-queue')).toBeNull();
});

test('C06 tenant-scoped communication remounts with canonical active tenant, not a global cache', () => {
  const web = fs.readFileSync('src/web/CommercialWebApp.tsx', 'utf8');
  expect(web).toMatch(/<CommunicationCenterPanel key=\{activeTenantId \?\? 'sem-academia'\}/);
  expect(web).not.toMatch(/communication\/messages\?gymId=/);
});
