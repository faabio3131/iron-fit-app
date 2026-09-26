import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockApi = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));

// eslint-disable-next-line import/first
import { AIInsightCard } from '../src/components/AIInsightCard';
// eslint-disable-next-line import/first
import { chatWithWorkoutAssistant, getWorkoutInsights } from '../src/services/ai';

const validInsight = {
  summary: 'Boa consistência nesta semana.',
  recommendations: [
    { title: 'Progressão controlada', detail: 'Mantenha a execução estável antes de aumentar a carga.' },
  ],
  projection: { label: 'Projeção de evolução', value: 'Tendência positiva', detail: 'Continue registrando seus treinos.' },
};

beforeEach(() => {
  mockApi.mockReset();
});

test('valid AI response renders recommendations', async () => {
  mockApi.mockResolvedValueOnce(validInsight);

  const view = render(React.createElement(AIInsightCard, {
    workoutCount: 2,
    weeklyFrequency: 4,
    onOpenAssistant: () => undefined,
  }));

  await waitFor(() => {
    expect(view.getByText('Progressão controlada')).toBeTruthy();
    expect(view.getByText('Boa consistência nesta semana.')).toBeTruthy();
  }, { timeout: 3000 });
  expect(mockApi).toHaveBeenCalledWith('/me/ai/workout-insights', undefined, expect.objectContaining({ method: 'POST' }));
}, 15000);

test('5xx or offline activates graceful fallback without breaking the UI', async () => {
  mockApi.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }));
  const insight = await getWorkoutInsights({ workoutCount: 1 }, 25);

  expect(insight.source).toBe('fallback');
  expect(insight.recommendations[0].title).toBe('Consistência primeiro');

  mockApi.mockRejectedValueOnce(new Error('offline'));
  const view = render(React.createElement(AIInsightCard, {
    workoutCount: 1,
    weeklyFrequency: 3,
    onOpenAssistant: () => undefined,
  }));

  await waitFor(() => {
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(view.getByText('Consistência primeiro')).toBeTruthy();
  });
});

test('timeout activates the same safe fallback', async () => {
  mockApi.mockImplementationOnce(() => new Promise(() => undefined));
  const insight = await getWorkoutInsights({ workoutCount: 3 }, 5);

  expect(insight.source).toBe('fallback');
  expect(insight.summary).toContain('modo seguro');
});

test('AI payload strips credentials and financial secrets', async () => {
  mockApi.mockResolvedValueOnce(validInsight);

  await getWorkoutInsights({
    workoutCount: 3,
    accessToken: 'ACCESS_SECRET',
    refresh_token: 'REFRESH_SECRET',
    password: 'PASSWORD_SECRET',
    financial: { cardNumber: '4111111111111111', cvv: '123' },
    note: 'Bearer BEARER_SECRET senha=INLINE_PASSWORD',
  });

  const options = mockApi.mock.calls[0][2] as { body?: string };
  const body = options.body ?? '';
  expect(body).toContain('"workoutCount":3');
  expect(body).not.toContain('ACCESS_SECRET');
  expect(body).not.toContain('REFRESH_SECRET');
  expect(body).not.toContain('PASSWORD_SECRET');
  expect(body).not.toContain('4111111111111111');
  expect(body).not.toContain('BEARER_SECRET');
  expect(body).not.toContain('INLINE_PASSWORD');
});

test('assistant chat uses governed endpoint and also fails open', async () => {
  mockApi.mockResolvedValueOnce({ message: 'Mantenha a execução controlada.' });
  const reply = await chatWithWorkoutAssistant('Como melhorar minha execução?', { workoutCount: 2 });
  expect(reply).toEqual({ source: 'ai', message: 'Mantenha a execução controlada.' });
  expect(mockApi).toHaveBeenCalledWith('/me/ai/chat', undefined, expect.objectContaining({ method: 'POST' }));

  mockApi.mockRejectedValueOnce(new Error('offline'));
  const fallback = await chatWithWorkoutAssistant('E agora?', {}, 10);
  expect(fallback.source).toBe('fallback');
  expect(fallback.message).toContain('continua funcionando normalmente');
});
