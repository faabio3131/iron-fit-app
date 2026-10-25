import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

let mockSession: { accessToken: string; refreshToken: string } | null = null;
const mockApi = jest.fn();
const mockRestoreSession = jest.fn(async () => mockSession);
const mockSaveSession = jest.fn(async (next: { accessToken: string; refreshToken: string }) => { mockSession = next; });
const mockLogoutSession = jest.fn(async () => { mockSession = null; });
const mockSetInvalidation = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  logoutSession: () => mockLogoutSession(),
  setSessionInvalidatedHandler: (fn: unknown) => mockSetInvalidation(fn),
}));
jest.mock('../src/storage/token-storage', () => ({
  restoreSession: () => mockRestoreSession(),
  saveSession: (next: { accessToken: string; refreshToken: string }) => mockSaveSession(next),
}));

const authorized = { id: 'owner-a', roles: ['OWNER'], gymId: 'gym-a', permissions: ['gym.read'] };
const reception = { id: 'reception-b', roles: ['RECEPTION'], gymId: 'gym-b', permissions: [] };
const token = { accessToken: 'verified', refreshToken: 'refresh-a' };

function Probe() {
  const { sessionReady, session, profile, activeTenantId, refreshProfile, logout, login } = useAuth();
  return <View>
    <Text testID="ready">{String(sessionReady)}</Text>
    <Text testID="session-present">{session ? 'sim' : 'não'}</Text>
    <Text testID="auth-role">{Array.isArray(profile?.roles) ? profile.roles.join(',') : 'bloqueado'}</Text>
    <Text testID="auth-tenant">{activeTenantId ?? 'nenhum'}</Text>
    <TouchableOpacity testID="auth-retry" onPress={() => { void refreshProfile().catch(() => undefined); }}><Text>Tentar novamente</Text></TouchableOpacity>
    <TouchableOpacity testID="auth-logout" onPress={() => { void logout().catch(() => undefined); }}><Text>Sair</Text></TouchableOpacity>
    <TouchableOpacity testID="auth-login" onPress={() => { void login('owner@example.test', 'password').catch(() => undefined); }}><Text>Entrar</Text></TouchableOpacity>
  </View>;
}
function mount() { return render(<AuthProvider><Probe /></AuthProvider>); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { ...token };
  mockRestoreSession.mockImplementation(async () => mockSession);
  mockLogoutSession.mockImplementation(async () => { mockSession = null; });
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/auth/me') return authorized;
    throw new Error('Unexpected endpoint ' + path);
  });
});

test('C06 restored session only publishes roles/tenant from valid /auth/me', async () => {
  const view = mount();
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  expect(view.getByTestId('auth-role').props.children).toBe('OWNER');
  expect(view.getByTestId('auth-tenant').props.children).toBe('gym-a');
  expect(mockApi).toHaveBeenCalledWith('/auth/me');
});

test('C06 failed initial authority check keeps session recoverable but no role/tenant', async () => {
  mockApi.mockRejectedValueOnce(new Error('Servidor temporariamente indisponível'));
  const view = mount();
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  expect(view.getByTestId('session-present').props.children).toBe('sim');
  expect(view.getByTestId('auth-role').props.children).toBe('bloqueado');
  expect(view.getByTestId('auth-tenant').props.children).toBe('nenhum');
  fireEvent.press(view.getByTestId('auth-retry'));
  await waitFor(() => expect(view.getByTestId('auth-role').props.children).toBe('OWNER'));
});

test('C06 a failed retry revokes previously loaded local UI permissions and tenant', async () => {
  const view = mount();
  await waitFor(() => expect(view.getByTestId('auth-role').props.children).toBe('OWNER'));
  mockApi.mockRejectedValueOnce(new Error('Rejeitado pela autoridade'));
  fireEvent.press(view.getByTestId('auth-retry'));
  await waitFor(() => expect(view.getByTestId('auth-role').props.children).toBe('bloqueado'));
  expect(view.getByTestId('auth-tenant').props.children).toBe('nenhum');
});

test('C06 delayed /auth/me cannot restore old OWNER after logout', async () => {
  const first = deferred<typeof authorized>();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/auth/me') return first.promise;
    throw new Error('Unexpected endpoint');
  });
  const view = mount();
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/auth/me'));
  fireEvent.press(view.getByTestId('auth-logout'));
  await waitFor(() => expect(view.getByTestId('session-present').props.children).toBe('não'));
  await act(async () => { first.resolve(authorized); await first.promise; });
  expect(view.getByTestId('auth-role').props.children).toBe('bloqueado');
  expect(view.getByTestId('auth-tenant').props.children).toBe('nenhum');
});

test('C06 slow prior response cannot overwrite more recent tenant/role validation', async () => {
  const first = deferred<typeof authorized>();
  let requests = 0;
  mockApi.mockImplementation(async (path: string) => {
    if (path !== '/auth/me') throw new Error('Unexpected endpoint');
    return ++requests === 1 ? first.promise : reception;
  });
  const view = mount();
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(1));
  fireEvent.press(view.getByTestId('auth-retry'));
  await waitFor(() => expect(view.getByTestId('auth-role').props.children).toBe('RECEPTION'));
  await act(async () => { first.resolve(authorized); await first.promise; });
  expect(view.getByTestId('auth-tenant').props.children).toBe('gym-b');
  expect(view.getByTestId('auth-role').props.children).toBe('RECEPTION');
});

test('C06 session login cannot display unverified roles from login payload while /auth/me is pending', async () => {
  mockSession = null;
  const lookup = deferred<typeof reception>();
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/auth/login') return { access_token: 'new-access', refresh_token: 'new-refresh',
      user: authorized };
    if (path === '/auth/me') return lookup.promise;
    throw new Error('Unexpected endpoint');
  });
  const view = mount();
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  fireEvent.press(view.getByTestId('auth-login'));
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/auth/me'));
  expect(view.getByTestId('auth-role').props.children).toBe('bloqueado');
  expect(view.getByTestId('auth-tenant').props.children).toBe('nenhum');
  await act(async () => { lookup.resolve(reception); await lookup.promise; });
  await waitFor(() => expect(view.getByTestId('auth-role').props.children).toBe('RECEPTION'));
  expect(view.getByTestId('auth-tenant').props.children).toBe('gym-b');
});

test('C06 empty role response is never accepted as a valid authority', async () => {
  mockApi.mockResolvedValueOnce({ roles: [], gymId: 'gym-a' });
  const view = mount();
  await waitFor(() => expect(view.getByTestId('ready').props.children).toBe('true'));
  expect(view.getByTestId('auth-role').props.children).toBe('bloqueado');
  expect(view.getByTestId('auth-tenant').props.children).toBe('nenhum');
});
