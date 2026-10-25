import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CommunicationCenterPanel } from '../src/components/CommunicationCenterPanel';

const mockApi = jest.fn();
let mockConsent = true;
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

beforeEach(() => {
  mockConsent = true;
  mockApi.mockReset();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/students') return [{ id: 'student-a', name: 'Aluno A', status: 'ACTIVE' }];
    if (path === '/students/student-a') return { id: 'student-a', status: 'ACTIVE', consentComm: mockConsent };
    if (path === '/communication/templates') return [{ id: 'template-a', name: 'Aviso', channel: 'WHATSAPP', body: 'Lembrete' }];
    if (path === '/communication/messages') return [
      { id: 'message-a', status: 'QUEUED', channel: 'WHATSAPP', body: 'Aguardando envio', student: { user: { name: 'Aluno A' } } },
    ];
    if (path === '/communication/automations') return [{ id: 'automation-a', name: 'Lembretes', triggerEvent: 'WORKOUT_DUE', active: true }];
    return { status: 'QUEUED' };
  });
});

test('C02 Communication Center renders queued state as distinct from delivered and restricts automation reads', async () => {
  const reception = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(reception.getByText(/Na fila/)).toBeTruthy());
  expect(reception.queryByText('Automações cadastradas')).toBeNull();
  expect(mockApi).not.toHaveBeenCalledWith('/communication/automations');
  reception.unmount();

  mockApi.mockClear();
  const manager = render(<CommunicationCenterPanel canManageAutomations />);
  await waitFor(() => expect(manager.getByText('Lembretes')).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/communication/automations');
});

test('C02 WhatsApp queue refuses absent consent without queuing or claiming delivery', async () => {
  mockConsent = false;
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-student-student-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('communication-student-student-a'));
  fireEvent.changeText(view.getByTestId('communication-message-body'), 'Sua aula começa amanhã');
  fireEvent.press(view.getByTestId('communication-prepare-queue'));
  fireEvent.press(view.getByTestId('communication-confirm-queue'));

  await waitFor(() => expect(view.getByText(/sem matrícula ativa ou consentimento/)).toBeTruthy());
  expect(mockApi).toHaveBeenCalledWith('/students/student-a');
  const queued = mockApi.mock.calls.filter(([path, , options]) => path === '/communication/messages' && options?.method === 'POST');
  expect(queued).toHaveLength(0);
});


test('C02 queued message uses canonical POST only after consent check and explicit confirmation', async () => {
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-student-student-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('communication-student-student-a'));
  fireEvent.changeText(view.getByTestId('communication-message-body'), 'Confirmação de aula');
  fireEvent.press(view.getByTestId('communication-prepare-queue'));
  expect(mockApi.mock.calls.filter(([path, , options]) => path === '/communication/messages' && options?.method === 'POST')).toHaveLength(0);

  fireEvent.press(view.getByTestId('communication-confirm-queue'));
  await waitFor(() => expect(view.getByText(/Isso não confirma entrega/)).toBeTruthy());
  const post = mockApi.mock.calls.find(([path, , options]) => path === '/communication/messages' && options?.method === 'POST');
  expect(post).toBeTruthy();
  expect(JSON.parse(post[2].body)).toEqual({
    studentId: 'student-a', channel: 'WHATSAPP', body: 'Confirmação de aula',
  });
  expect(JSON.parse(post[2].body)).not.toHaveProperty('gymId');
});

test('C02 template creation binds to canonical communication API without tenant spoofing', async () => {
  const view = render(<CommunicationCenterPanel canManageAutomations={false} />);
  await waitFor(() => expect(view.getByTestId('communication-template-name')).toBeTruthy());
  fireEvent.changeText(view.getByTestId('communication-template-name'), 'Aula remarcada');
  fireEvent.changeText(view.getByTestId('communication-template-body'), 'Aula alterada para amanhã');
  fireEvent.press(view.getByTestId('communication-template-create'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path, , options]) => path === '/communication/templates' && options?.method === 'POST')).toBe(true));
  const post = mockApi.mock.calls.find(([path, , options]) => path === '/communication/templates' && options?.method === 'POST');
  expect(JSON.parse(post[2].body)).toEqual({
    name: 'Aula remarcada', channel: 'WHATSAPP', body: 'Aula alterada para amanhã',
  });
});
