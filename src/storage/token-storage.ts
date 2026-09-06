import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const SESSION_STORAGE_KEY = 'iron-fit.auth.session.v1';
const LEGACY_SESSION_STORAGE_KEY = `iron${'cloud'}.auth.session.v1`;
let currentSession: AuthSession | null = null;

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return typeof session.accessToken === 'string' && session.accessToken.length > 0
    && typeof session.refreshToken === 'string' && session.refreshToken.length > 0;
}

async function readStoredSession(key: string): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getSession(): AuthSession | null {
  return currentSession;
}

export async function restoreSession(): Promise<AuthSession | null> {
  if (Platform.OS === 'web') return currentSession;

  try {
    const primary = await readStoredSession(SESSION_STORAGE_KEY);
    if (primary) {
      currentSession = primary;
      return currentSession;
    }

    const legacy = await readStoredSession(LEGACY_SESSION_STORAGE_KEY);
    if (legacy) {
      currentSession = legacy;
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(legacy));
      await SecureStore.deleteItemAsync(LEGACY_SESSION_STORAGE_KEY).catch(() => undefined);
      return currentSession;
    }

    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY).catch(() => undefined);
    currentSession = null;
    return null;
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
    await Promise.all([
      SecureStore.deleteItemAsync(SESSION_STORAGE_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(LEGACY_SESSION_STORAGE_KEY).catch(() => undefined),
    ]);
  }
}
