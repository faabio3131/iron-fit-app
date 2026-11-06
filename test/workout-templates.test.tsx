import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { WorkoutComposer } from '../src/components/WorkoutComposer';
import { api } from '../src/services/api';
jest.mock('../src/services/api', () => ({ api: jest.fn() }));
const mocked = api as jest.Mock;
const template = { id: 'adaptation', name: 'Adaptação', ready: true, goal: 'Adaptação geral', level: 'INICIANTE', weeklyFrequency: 3, notes: 'Revisar avaliação', missingExercises: [], missingEquipment: [], sessions: [{ name: 'A — Adaptação', exercises: [{ exerciseId: 'exercise', sets: 2, reps: '10–12', restSeconds: 60 }] }] };
beforeEach(() => { jest.clearAllMocks(); mocked.mockImplementation(async (path: string) => path === '/exercises' ? [{ id: 'exercise', name: 'Agachamento' }] : path === '/workouts/templates' ? [template] : []); });
test('loading a template fills the existing composer without saving or approving a workout', async () => {
  const view = render(<WorkoutComposer students={[{ id: 'student', name: 'Ana' }]} onUpdated={async () => undefined} />);
  await waitFor(() => expect(view.getByTestId('studio-template-adaptation')).toBeTruthy());
  fireEvent.press(view.getByTestId('studio-template-adaptation'));
  expect(view.getByTestId('studio-session-name-1').props.value).toBe('A — Adaptação');
  expect(view.getByTestId('studio-frequency').props.value).toBe('3');
  expect(mocked.mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);
  expect(view.getByTestId('studio-notice').props.children).toMatch(/Revise/);
});
test('missing equipment keeps the template disabled while manual composition remains available', async () => {
  mocked.mockImplementation(async (path: string) => path === '/workouts/templates' ? [{ ...template, ready: false, missingEquipment: ['Leg press'] }] : []);
  const view = render(<WorkoutComposer students={[]} onUpdated={async () => undefined} />);
  await waitFor(() => expect(view.getByTestId('studio-template-adaptation')).toBeTruthy());
  fireEvent.press(view.getByTestId('studio-template-adaptation'));
  expect(view.getByTestId('studio-session-name-1').props.value).toBe('Sessão A');
  expect(view.getByText(/Selecione aparelhos compatíveis/)).toBeTruthy();
});

test('the trainer can prescribe load in the existing composer and it reaches the canonical draft payload', async () => {
  mocked.mockImplementation(async (path: string, _token: unknown, options: any) => options?.method === 'POST' ? { id: 'draft', status: 'DRAFT' } : path === '/exercises' ? [{ id: 'exercise', name: 'Agachamento' }] : path === '/workouts/templates' ? [template] : []);
  const view = render(<WorkoutComposer students={[{ id: 'student', name: 'Ana' }]} onUpdated={async () => undefined} />);
  await waitFor(() => expect(view.getByTestId('studio-template-adaptation')).toBeTruthy());
  fireEvent.press(view.getByTestId('studio-template-adaptation'));
  fireEvent.press(view.getByTestId('studio-student-student'));
  fireEvent.changeText(view.getByTestId('studio-exercise-load-1-0'), 'Peso corporal');
  await waitFor(() => expect(view.getByTestId('manual-workout-create').props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByTestId('manual-workout-create'));
  await waitFor(() => expect(mocked.mock.calls.some(([path, , options]) => path === '/workouts' && options?.method === 'POST')).toBe(true));
  const call = mocked.mock.calls.find(([path, , options]) => path === '/workouts' && options?.method === 'POST');
  expect(JSON.parse(call![2].body).sessions[0].exercises[0].suggestedLoad).toBe('Peso corporal');
  expect(mocked.mock.calls.some(([, , options]) => options?.method === 'PATCH')).toBe(false);
});
