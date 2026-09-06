import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const SESSION_STORAGE_KEY = 'ironcloud.auth.session.v1';
let currentSession: AuthSession | null = null;

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return typeof session.accessToken === 'string' && session.accessToken.length > 0
    && typeof session.refreshToken === 'string' && session.refreshToken.length > 0;
}

export function getSession(): AuthSession | null {
  return currentSession;
}

export async function restoreSession(): Promise<AuthSession | null> {
  if (Platform.OS === 'web') return currentSession;

  try {
    const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      currentSession = null;
      return null;
    }
    currentSession = parsed;
    return currentSession;
  } catch {
    currentSession = null;
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  if (!isSession(session)) throw new Error('Sessão de autenticação inválida.');
  currentSession = { ...session };
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
  }
}

export async function clearSession(): Promise<void> {
  currentSession = null;
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY).catch(() => undefined);
  }
}
