import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { WorkoutComposer } from '../src/components/WorkoutComposer';
import { IronIntelligencePanel } from '../src/components/IronIntelligencePanel';

const mockApi = jest.fn();
const mockUpdated = jest.fn(async () => undefined);
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

const students = [{ id: 'student-a', name: 'Ana' }];
const exercises = [{ id: 'exercise-a', name: 'Agachamento', muscleGroup: 'Pernas' }];
beforeEach(() => {
  mockApi.mockReset(); mockUpdated.mockClear();
  mockApi.mockImplementation(async (path: string, _token?: string, opts?: { method?: string; body?: string }) => {
    if (path === '/exercises') return exercises;
    if (path === '/students/student-a/assessments') return [{ id: 'assessment-a', createdAt: '2026-10-01T12:00:00Z' }];
    if (path === '/workouts' && opts?.method === 'POST') return { id: 'workout-a', status: 'DRAFT' };
    if (path === '/ai/workout-candidates' && opts?.method === 'POST') return {
      workout: { id: 'workout-ai', status: 'PENDING_REVIEW', createdByAI: true },
      requiresHumanReview: true, provenance: { executionTraceId: 'trace-a', requestId: 'request-a' },
    };
    throw new Error('Rota inesperada: ' + path);
  });
});

test('C02 Workout Studio composes sessions/exercises and stores only DRAFT through canonical POST', async () => {
  const view = render(<WorkoutComposer students={students} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('studio-student-student-a'));
  await waitFor(() => expect(view.getByTestId('studio-exercise-exercise-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('studio-assessment-assessment-a'));
  fireEvent.press(view.getByTestId('studio-exercise-exercise-a'));
  fireEvent.press(view.getByTestId('studio-exercise-add-1'));
  fireEvent.press(view.getByTestId('manual-workout-create'));
  await waitFor(() => expect(mockApi.mock.calls.some(([p, , o]) => p === '/workouts' && o?.method === 'POST')).toBe(true));
  const post = mockApi.mock.calls.find(([p, , o]) => p === '/workouts' && o?.method === 'POST');
  const body = JSON.parse(post[2].body);
  expect(body).toMatchObject({ studentId: 'student-a', assessmentId: 'assessment-a',
    weeklyFrequency: 3, sessions: [{ name: 'Sessão A', order: 1,
      exercises: [{ exerciseId: 'exercise-a', order: 1, sets: 3, reps: '12', restSeconds: 60 }] }] });
  expect(body).not.toHaveProperty('status');
  expect(body).not.toHaveProperty('gymId');
  expect(mockUpdated).toHaveBeenCalledTimes(1);
});

test('C02 Workout Studio rejects empty sessions, invalid weekly frequency and leaves server authority unchanged', async () => {
  const view = render(<WorkoutComposer students={students} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('studio-student-student-a'));
  await waitFor(() => expect(view.getByTestId('studio-exercise-exercise-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('manual-workout-create'));
  expect(mockApi.mock.calls.some(([p, , o]) => p === '/workouts' && o?.method === 'POST')).toBe(false);
  fireEvent.press(view.getByTestId('studio-exercise-exercise-a'));
  fireEvent.press(view.getByTestId('studio-exercise-add-1'));
  fireEvent.changeText(view.getByTestId('studio-frequency'), '99');
  expect(view.getByTestId('studio-validation')).toBeTruthy();
  fireEvent.press(view.getByTestId('manual-workout-create'));
  expect(mockApi.mock.calls.some(([p, , o]) => p === '/workouts' && o?.method === 'POST')).toBe(false);
});

test('C02 Intelligence generates only review-required candidate with tenant resolved by backend', async () => {
  const view = render(<IronIntelligencePanel students={students} workouts={[]} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('intelligence-student-student-a'));
  await waitFor(() => expect(view.getByTestId('intelligence-assessment-assessment-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('intelligence-assessment-assessment-a'));
  fireEvent.changeText(view.getByTestId('intelligence-instructions'), 'Priorize mobilidade e aquecimento');
  fireEvent.press(view.getByTestId('intelligence-generate'));
  await waitFor(() => expect(view.getByTestId('intelligence-result')).toBeTruthy());
  const call = mockApi.mock.calls.find(([p, , o]) => p === '/ai/workout-candidates' && o?.method === 'POST');
  expect(JSON.parse(call[2].body)).toEqual({ studentId: 'student-a', assessmentId: 'assessment-a',
    instructions: 'Priorize mobilidade e aquecimento' });
  expect(JSON.parse(call[2].body)).not.toHaveProperty('gymId');
  expect(view.getByText(/aguardando revisão humana/)).toBeTruthy();
  expect(mockUpdated).toHaveBeenCalledTimes(1);
});

test('C02 Intelligence does not claim completion if API fails or provider is unavailable', async () => {
  mockApi.mockImplementation(async (p: string) => {
    if (p === '/students/student-a/assessments') return [];
    if (p === '/ai/workout-candidates') throw Object.assign(new Error('provider down'), { status: 503 });
    return [];
  });
  const view = render(<IronIntelligencePanel students={students} workouts={[]} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('intelligence-student-student-a'));
  await waitFor(() => expect(view.getByTestId('intelligence-generate').props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByTestId('intelligence-generate'));
  await waitFor(() => expect(view.getByText(/serviço de IA está indisponível/)).toBeTruthy());
  expect(view.queryByTestId('intelligence-result')).toBeNull();
  expect(mockUpdated).not.toHaveBeenCalled();
});

test('C02 Intelligence rejects claims of successful generation without confirmed human-review status', async () => {
  mockApi.mockImplementation(async (p: string) => {
    if (p === '/students/student-a/assessments') return [];
    if (p === '/ai/workout-candidates') return { workout: { id: 'fake', status: 'ACTIVE', createdByAI: true },
      requiresHumanReview: false };
    return [];
  });
  const view = render(<IronIntelligencePanel students={students} workouts={[]} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('intelligence-student-student-a'));
  await waitFor(() => expect(view.getByTestId('intelligence-generate').props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByTestId('intelligence-generate'));
  await waitFor(() => expect(view.getByText(/não confirmou um candidato aguardando revisão/)).toBeTruthy());
  expect(view.queryByTestId('intelligence-result')).toBeNull();
});


test('C02 confirmed manual DRAFT remains saved when follow-up list reload fails', async () => {
  mockUpdated.mockRejectedValueOnce(new Error('GET /workouts unavailable'));
  const view = render(<WorkoutComposer students={students} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('studio-student-student-a'));
  await waitFor(() => expect(view.getByTestId('studio-exercise-exercise-a')).toBeTruthy());
  fireEvent.press(view.getByTestId('studio-exercise-exercise-a'));
  fireEvent.press(view.getByTestId('studio-exercise-add-1'));
  fireEvent.press(view.getByTestId('manual-workout-create'));
  await waitFor(() => expect(view.getByText(/Rascunho registrado no backend/)).toBeTruthy());
  expect(view.queryByTestId('studio-error')).toBeNull();
  expect(mockApi.mock.calls.filter(([p, , o]) => p === '/workouts' && o?.method === 'POST')).toHaveLength(1);
});

test('C02 confirmed AI candidate never invites duplicate generation after reload error', async () => {
  mockUpdated.mockRejectedValueOnce(new Error('GET /workouts unavailable'));
  const view = render(<IronIntelligencePanel students={students} workouts={[]} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('intelligence-student-student-a'));
  await waitFor(() => expect(view.getByTestId('intelligence-generate').props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByTestId('intelligence-generate'));
  await waitFor(() => expect(view.getByTestId('intelligence-refresh-warning')).toBeTruthy());
  expect(view.getByTestId('intelligence-result')).toBeTruthy();
  expect(view.queryByTestId('intelligence-error')).toBeNull();
  expect(mockApi.mock.calls.filter(([p, , o]) => p === '/ai/workout-candidates' && o?.method === 'POST')).toHaveLength(1);
});

test('C02 AI candidate requires backend ID in addition to human-review status', async () => {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/students/student-a/assessments') return [];
    if (path === '/ai/workout-candidates') return {
      workout: { status: 'PENDING_REVIEW', createdByAI: true }, requiresHumanReview: true,
    };
    return [];
  });
  const view = render(<IronIntelligencePanel students={students} workouts={[]} onUpdated={mockUpdated} />);
  fireEvent.press(view.getByTestId('intelligence-student-student-a'));
  await waitFor(() => expect(view.getByTestId('intelligence-generate').props.accessibilityState?.disabled).toBe(false));
  fireEvent.press(view.getByTestId('intelligence-generate'));
  await waitFor(() => expect(view.getByText(/não confirmou um candidato aguardando revisão/)).toBeTruthy());
  expect(view.queryByTestId('intelligence-result')).toBeNull();
  expect(mockUpdated).not.toHaveBeenCalled();
});
