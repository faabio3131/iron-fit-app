import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../App';
import { clearSession } from '../src/storage/token-storage';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.setTimeout(15000);

type LoginMode = 'direct' | 'multi';

type FetchScenario = {
  loginMode?: LoginMode;
  workouts?: any[];
  charges?: any[];
  aiStatus?: number;
};

const API_ROOT = 'https://example.invalid/api/v1';
const E2E_WAIT_MS = 10000;
const secureGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const secureSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const secureDelete = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

function response(status: number, payload: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    text: async () => payload == null ? '' : JSON.stringify(payload),
  } as Response);
}

function installFetchScenario({
  loginMode = 'direct',
  workouts = [],
  charges = [],
  aiStatus = 503,
}: FetchScenario = {}) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.startsWith(API_ROOT) ? url.slice(API_ROOT.length) : url;

    if (path === '/auth/login') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (loginMode === 'multi' && !body.gymId) {
        return response(200, {
          requires_tenant_selection: true,
          tenants: [
            { id: 'gym-a', name: 'Unidade Centro' },
            { id: 'gym-b', name: 'Unidade Norte' },
          ],
        });
      }
      const gymId = body.gymId ?? 'gym-a';
      return response(200, {
        access_token: `access-${gymId}`,
        refresh_token: `refresh-${gymId}`,
        user: {
          id: 'student-1',
          name: 'Ana Silva',
          email: 'ana@example.com',
          gymId,
          gym: { id: gymId, name: gymId === 'gym-b' ? 'Unidade Norte' : 'Unidade Centro' },
          goal: 'Hipertrofia',
          level: 'Intermediário',
          status: 'ATIVO',
        },
      });
    }

    if (path === '/me/profile') {
      return response(200, {
        id: 'student-1',
        name: 'Ana Silva',
        email: 'ana@example.com',
        activeGymId: loginMode === 'multi' ? 'gym-b' : 'gym-a',
        gym: { id: loginMode === 'multi' ? 'gym-b' : 'gym-a', name: loginMode === 'multi' ? 'Unidade Norte' : 'Unidade Centro' },
        goal: 'Hipertrofia',
        level: 'Intermediário',
        status: 'ATIVO',
      });
    }

    if (path === '/me/workouts') return response(200, workouts);
    if (path === '/me/charges') return response(200, charges);
    if (path === '/me/ai/workout-insights') return response(aiStatus, { message: 'AI unavailable for smoke fallback' });
    if (path === '/auth/logout') return response(204, null);

    return response(404, { message: `Unhandled smoke route: ${path}` });
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function fillAndSubmitLogin(view: ReturnType<typeof render>) {
  await waitFor(() => expect(view.getByTestId('login-email')).toBeTruthy(), { timeout: E2E_WAIT_MS });
  fireEvent.changeText(view.getByTestId('login-email'), 'ana@example.com');
  fireEvent.changeText(view.getByTestId('login-password'), 'senha-segura');
  fireEvent.press(view.getByTestId('login-submit'));
}

async function loginDirect(view: ReturnType<typeof render>) {
  await fillAndSubmitLogin(view);
  await waitFor(() => expect(view.getByText('Olá, Ana')).toBeTruthy(), { timeout: E2E_WAIT_MS });
}

describe('student end-to-end smoke journey', () => {
  beforeEach(async () => {
    secureGet.mockReset();
    secureSet.mockReset();
    secureDelete.mockReset();
    secureGet.mockResolvedValue(null);
    secureSet.mockResolvedValue(undefined);
    secureDelete.mockResolvedValue(undefined);
    await clearSession();
  });

  test('flow 1: successful login persists access and refresh tokens in secure storage', async () => {
    installFetchScenario();
    const view = render(<App />);

    await loginDirect(view);

    expect(secureSet).toHaveBeenCalledWith(
      'iron-fit.auth.session.v1',
      JSON.stringify({ accessToken: 'access-gym-a', refreshToken: 'refresh-gym-a' }),
    );
  });

  test('flow 2: multi-tenant selection hydrates the active tenant context', async () => {
    const fetchMock = installFetchScenario({ loginMode: 'multi' });
    const view = render(<App />);

    await fillAndSubmitLogin(view);
    await waitFor(() => expect(view.getByText('Escolha sua unidade')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    fireEvent.press(view.getByTestId('tenant-gym-b'));
    fireEvent.press(view.getByTestId('tenant-confirm'));

    await waitFor(() => expect(view.getByText('Olá, Ana')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    fireEvent.press(view.getByText('Perfil'));
    await waitFor(() => expect(view.getByText('Unidade Norte')).toBeTruthy(), { timeout: E2E_WAIT_MS });

    const loginBodies = fetchMock.mock.calls
      .filter(([input]) => String(input).endsWith('/auth/login'))
      .map(([, init]) => JSON.parse(String(init?.body ?? '{}')));
    expect(loginBodies).toEqual(expect.arrayContaining([expect.objectContaining({ gymId: 'gym-b' })]));
  });

  test('flow 3: workouts render while Iron Intelligence fails over gracefully', async () => {
    const fetchMock = installFetchScenario({
      workouts: [{
        id: 'workout-1',
        goal: 'Hipertrofia',
        weeklyFrequency: 4,
        status: 'ACTIVE',
        sessions: [{
          id: 'session-a',
          name: 'Treino A',
          exercises: [{
            id: 'item-1',
            sets: 4,
            reps: 10,
            restSeconds: 60,
            exercise: { name: 'Supino reto' },
          }],
        }],
      }],
      aiStatus: 503,
    });
    const view = render(<App />);

    await loginDirect(view);
    await waitFor(() => expect(view.getByText('Hipertrofia')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    expect(view.getByText('Supino reto')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Modo seguro')).toBeTruthy(), { timeout: E2E_WAIT_MS });

    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/me/workouts'))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/me/ai/workout-insights'))).toBe(true);
  });

  test('flow 4: charges load, profile navigation works and logout clears the secure session', async () => {
    const fetchMock = installFetchScenario({
      charges: [{ id: 'charge-1', description: 'Mensalidade Setembro', amount: 199.9, dueDate: '2026-09-10', status: 'PENDING' }],
    });
    const view = render(<App />);

    await loginDirect(view);
    fireEvent.press(view.getByText('Plano'));
    await waitFor(() => expect(view.getByText('Mensalidade Setembro')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    expect(view.getByText('R$ 199,90')).toBeTruthy();

    fireEvent.press(view.getByText('Perfil'));
    await waitFor(() => expect(view.getByText('Ana Silva')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    fireEvent.press(view.getByTestId('logout-submit'));

    await waitFor(() => expect(view.getByTestId('login-submit')).toBeTruthy(), { timeout: E2E_WAIT_MS });
    expect(secureDelete).toHaveBeenCalledWith('iron-fit.auth.session.v1');
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/auth/logout'))).toBe(true);
  });
});
