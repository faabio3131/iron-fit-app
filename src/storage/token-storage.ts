import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const SESSION_STORAGE_KEY = 'iron-fit.auth.session.v1';
const LEGACY_SESSION_STORAGE_KEY = `iron${'cloud'}.auth.session.v1`;
let currentSession: AuthSession | null = null;

type BrowserSessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function browserSessionStorage(): BrowserSessionStorage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return (globalThis as typeof globalThis & { sessionStorage?: BrowserSessionStorage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return typeof session.accessToken === 'string' && session.accessToken.length > 0
    && typeof session.refreshToken === 'string' && session.refreshToken.length > 0;
}

function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readStoredSession(key: string): Promise<AuthSession | null> {
  const webStorage = browserSessionStorage();
  if (webStorage) return parseStoredSession(webStorage.getItem(key));
  return parseStoredSession(await SecureStore.getItemAsync(key));
}

async function persistStoredSession(key: string, session: AuthSession): Promise<void> {
  const serialized = JSON.stringify(session);
  const webStorage = browserSessionStorage();
  if (webStorage) {
    webStorage.setItem(key, serialized);
    return;
  }
  await SecureStore.setItemAsync(key, serialized);
}

async function removeStoredSession(key: string): Promise<void> {
  const webStorage = browserSessionStorage();
  if (webStorage) {
    webStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export function getSession(): AuthSession | null {
  return currentSession;
}

export async function restoreSession(): Promise<AuthSession | null> {
  try {
    const primary = await readStoredSession(SESSION_STORAGE_KEY);
    if (primary) {
      currentSession = primary;
      return currentSession;
    }

    const legacy = await readStoredSession(LEGACY_SESSION_STORAGE_KEY);
    if (legacy) {
      currentSession = legacy;
      await persistStoredSession(SESSION_STORAGE_KEY, legacy);
      await removeStoredSession(LEGACY_SESSION_STORAGE_KEY);
      return currentSession;
    }

    await removeStoredSession(SESSION_STORAGE_KEY);
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
  await persistStoredSession(SESSION_STORAGE_KEY, currentSession);
}

export async function clearSession(): Promise<void> {
  currentSession = null;
  await Promise.all([
    removeStoredSession(SESSION_STORAGE_KEY),
    removeStoredSession(LEGACY_SESSION_STORAGE_KEY),
  ]);
}
