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

test('guided progression honors prescribed rest, does not autoplay a video, and only finishes after all sets', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-15T20:00:00Z'));
  const videoSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    const view = render(<GuidedWorkoutSession session={session} onClose={jest.fn()} />);
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
    expect(view.getByText(/não registra presença nem histórico/)).toBeTruthy();
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
    const view = render(<GuidedWorkoutSession session={session} onClose={jest.fn()} />);
    fireEvent.press(view.getByTestId('guided-complete-set'));
    fireEvent.press(view.getByTestId('guided-skip-rest'));
    expect(view.getByText('Série 2 de 2 · 10')).toBeTruthy();
    expect(view.queryByTestId('guided-rest-countdown')).toBeNull();
    view.unmount();
  } finally { jest.useRealTimers(); }
});

test('student can launch a guided session only for an ACTIVE plan with a complete prescription', async () => {
  mockedApi.mockResolvedValue([
    { id: 'active', status: 'ACTIVE', goal: 'Ativo', sessions: [session] },
    { id: 'approved', status: 'APPROVED', goal: 'Aguardando', sessions: [{ ...session, id: 'session-b' }] },
    { id: 'incomplete', status: 'ACTIVE', goal: 'Sem prescrição', sessions: [{ id: 'session-c', name: 'Treino C', exercises: [{ id: 'x', sets: null, exercise: { name: 'Agachamento' } }] }] },
  ]);
  const view = render(<WorkoutsScreen />);
  await waitFor(() => expect(view.getByTestId('guided-launch-session-a')).toBeTruthy());
  expect(view.queryByTestId('guided-launch-session-b')).toBeNull();
  expect(view.queryByTestId('guided-launch-session-c')).toBeNull();
  fireEvent.press(view.getByTestId('guided-launch-session-a'));
  expect(view.getByTestId('guided-workout')).toBeTruthy();
  fireEvent.press(view.getByTestId('guided-back'));
  expect(view.getByTestId('guided-launch-session-a')).toBeTruthy();
  expect(mockedApi).toHaveBeenCalledWith('/me/workouts');
  expect(mockedApi.mock.calls.every(([, , options]) => options?.method === undefined)).toBe(true);
});
