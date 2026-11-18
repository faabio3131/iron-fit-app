import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { canGuideSession, GuidedWorkoutSession, type GuidedSession } from '../src/components/GuidedWorkoutSession';
import { WorkoutsScreen } from '../src/screens/WorkoutsScreen';
import { api } from '../src/services/api';

jest.mock('../src/services/api', () => ({ api: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ profile: { name: 'Ana' } }) }));
jest.mock('../src/components/AIWorkoutAssistant', () => ({ AIWorkoutAssistant: () => null }));
jest.mock('../src/components/AIInsightCard', () => ({ AIInsightCard: () => null }));
const mockedApi = api as jest.Mock;

const session: GuidedSession = {
  id: 'session-a',
  name: 'Treino A',
  exercises: [
    { id: 'first', sets: 2, reps: '10', restSeconds: 90, suggestedLoad: '40 kg',
      exercise: { name: 'Supino reto', videoUrl: 'https://www.youtube.com/watch?v=example' } },
    { id: 'second', sets: 1, reps: '12', restSeconds: 60,
      exercise: { name: 'Remada baixa' } },
  ],
};

beforeEach(() => { jest.clearAllMocks(); });

test('no invented default: incomplete prescription cannot start guided execution', () => {
  expect(canGuideSession(session)).toBe(true);
  expect(canGuideSession({ id: 'a', name: 'Sem séries', exercises: [{ id: 'x', exercise: { name: 'Supino' } }] })).toBe(false);
  expect(canGuideSession({ id: 'b', name: 'Descanso inválido', exercises: [{ id: 'x', sets: 2, restSeconds: -10, exercise: { name: 'Supino' } }] })).toBe(false);
  expect(canGuideSession({ id: 'c', name: 'Sem exercícios', exercises: [] })).toBe(false);
});

test('guided progression honors prescribed rest and confirms only after server completion', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-15T20:00:00Z'));
  const videoSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    const onComplete = jest.fn().mockResolvedValue(undefined);
    const view = render(<GuidedWorkoutSession session={session} onClose={jest.fn()} onComplete={onComplete} />);
    expect(view.getByText('Série 1 de 2 · 10')).toBeTruthy();
    expect(view.getByText('Carga: 40 kg')).toBeTruthy();
    expect(videoSpy).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('guided-complete-set'));
    expect(view.getByTestId('guided-rest-countdown').props.children.join('')).toBe('01:30');
    expect(view.queryByTestId('guided-complete-set')).toBeNull();
    act(() => { jest.advanceTimersByTime(89000); });
    expect(view.getByTestId('guided-rest-countdown').props.children.join('')).toBe('00:01');
    act(() => { jest.advanceTimersByTime(1000); });
    expect(view.getByTestId('guided-rest-ready')).toBeTruthy();
    fireEvent.press(view.getByTestId('guided-start-next'));
    expect(view.getByText('Série 2 de 2 · 10')).toBeTruthy();
    fireEvent.press(view.getByTestId('guided-complete-set'));
    expect(view.getByTestId('guided-exercise-name').props.children).toBe('Remada baixa');
    expect(view.getByText('Série 1 de 1 · 12')).toBeTruthy();
    expect(view.queryByTestId('guided-rest-countdown')).toBeNull();
    fireEvent.press(view.getByTestId('guided-complete-set'));
    expect(view.getByTestId('guided-finished')).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(view.getByText('Sessão salva no histórico')).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatch(/^guided_[A-Za-z0-9_]+$/);
    expect(view.getByText(/Não equivale a check-in presencial/i)).toBeTruthy();
    expect(videoSpy).not.toHaveBeenCalled();
    expect(mockedApi).not.toHaveBeenCalled();
    view.unmount();
  } finally {
    videoSpy.mockRestore();
    jest.useRealTimers();
  }
});

test('student can explicitly skip prescribed rest without changing the prescription', () => {
  jest.useFakeTimers();
  try {
    const view = render(<GuidedWorkoutSession session={session} onClose={jest.fn()}
      onComplete={jest.fn().mockResolvedValue(undefined)} />);
    fireEvent.press(view.getByTestId('guided-complete-set'));
    fireEvent.press(view.getByTestId('guided-skip-rest'));
    expect(view.getByText('Série 2 de 2 · 10')).toBeTruthy();
    expect(view.queryByTestId('guided-rest-countdown')).toBeNull();
    view.unmount();
  } finally { jest.useRealTimers(); }
});

test('student can launch a guided session only for an ACTIVE plan with a complete prescription', async () => {
  mockedApi.mockImplementation((path: string) => path === '/me/workout-executions'
    ? Promise.resolve([])
    : Promise.resolve([
    { id: 'active', status: 'ACTIVE', goal: 'Ativo', sessions: [session] },
    { id: 'approved', status: 'APPROVED', goal: 'Aguardando', sessions: [{ ...session, id: 'session-b' }] },
    { id: 'incomplete', status: 'ACTIVE', goal: 'Sem prescrição', sessions: [{ id: 'session-c', name: 'Treino C', exercises: [{ id: 'x', sets: null, exercise: { name: 'Agachamento' } }] }] },
  ]));
  const view = render(<WorkoutsScreen />);
  await waitFor(() => expect(view.getByTestId('guided-launch-session-a')).toBeTruthy());
  expect(view.queryByTestId('guided-launch-session-b')).toBeNull();
  expect(view.queryByTestId('guided-launch-session-c')).toBeNull();
  fireEvent.press(view.getByTestId('guided-launch-session-a'));
  expect(view.getByTestId('guided-workout')).toBeTruthy();
  fireEvent.press(view.getByTestId('guided-back'));
  expect(view.getByTestId('guided-launch-session-a')).toBeTruthy();
  expect(mockedApi).toHaveBeenCalledWith('/me/workouts');
  expect(mockedApi).toHaveBeenCalledWith('/me/workout-executions');
  expect(mockedApi.mock.calls.every(([, , options]) => options?.method === undefined)).toBe(true);
});

test('failed server write is not shown as success and retry reuses identical idempotency key', async () => {
  const onComplete = jest.fn().mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValueOnce(undefined);
  const view = render(<GuidedWorkoutSession session={session} onClose={jest.fn()} onComplete={onComplete} />);
  fireEvent.press(view.getByTestId('guided-complete-set'));
  fireEvent.press(view.getByTestId('guided-skip-rest'));
  fireEvent.press(view.getByTestId('guided-complete-set'));
  fireEvent.press(view.getByTestId('guided-complete-set'));
  await waitFor(() => expect(view.getByTestId('guided-save-error')).toBeTruthy());
  expect(view.queryByText('Sessão salva no histórico')).toBeNull();
  fireEvent.press(view.getByTestId('guided-retry-save'));
  await waitFor(() => expect(view.getByText('Sessão salva no histórico')).toBeTruthy());
  expect(onComplete).toHaveBeenCalledTimes(2);
  expect(onComplete.mock.calls[0][0]).toBe(onComplete.mock.calls[1][0]);
});

test('student mobile posts a receipt and displays confirmed history', async () => {
  const receipt = {
    id: 'execution-a', workoutId: 'active', sessionId: 'session-a',
    sessionName: 'Treino A', source: 'STUDENT_SELF_REPORTED',
    completedSets: 3, completedAt: '2026-11-18T13:30:00Z', replayed: false,
  };
  mockedApi.mockImplementation((path: string, _legacy: unknown, options: { method?: string }) => {
    if (path === '/me/workouts') return Promise.resolve([
      { id: 'active', status: 'ACTIVE', goal: 'Ativo', sessions: [session] },
    ]);
    if (path === '/me/workout-executions') return Promise.resolve([]);
    if (path.endsWith('/completions') && options?.method === 'POST') return Promise.resolve(receipt);
    return Promise.reject(new Error('Caminho inesperado'));
  });
  const view = render(<WorkoutsScreen />);
  await waitFor(() => expect(view.getByTestId('guided-launch-session-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('guided-launch-session-a'));
  fireEvent.press(view.getByTestId('guided-complete-set'));
  fireEvent.press(view.getByTestId('guided-skip-rest'));
  fireEvent.press(view.getByTestId('guided-complete-set'));
  fireEvent.press(view.getByTestId('guided-complete-set'));
  await waitFor(() => expect(view.getByText('Sessão salva no histórico')).toBeTruthy());
  const call = mockedApi.mock.calls.find(([path]) => path.endsWith('/completions'));
  expect(call?.[0]).toBe('/me/workouts/active/sessions/session-a/completions');
  expect(call?.[2]?.method).toBe('POST');
  expect(JSON.parse(call?.[2]?.body).requestId).toMatch(/^guided_/);
  fireEvent.press(view.getByText('Voltar aos treinos'));
  await waitFor(() => expect(view.getByTestId('workout-execution-history')).toBeTruthy());
  expect(view.getByText('Histórico de treinos realizados')).toBeTruthy();
  expect(view.getByText(/3 séries/)).toBeTruthy();
});
