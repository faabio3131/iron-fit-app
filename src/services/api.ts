import { API_URL } from '../config/env';
import { AuthSession, clearSession, getSession, saveSession } from '../storage/token-storage';

export type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshInFlight: Promise<AuthSession | null> | null = null;
let sessionInvalidatedHandler: (() => void) | null = null;

export function setSessionInvalidatedHandler(handler: (() => void) | null) {
  sessionInvalidatedHandler = handler;
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function apiError(status: number, payload: any) {
  const message = typeof payload?.message === 'string'
    ? payload.message
    : typeof payload === 'string' && payload
      ? payload
      : 'Erro inesperado';
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function invalidateSession() {
  await clearSession();
  sessionInvalidatedHandler?.();
}

async function refreshSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = getSession();
    if (!current?.refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const payload = await parseBody(response);
      if (!response.ok
        || typeof payload?.access_token !== 'string'
        || typeof payload?.refresh_token !== 'string') {
        await invalidateSession();
        return null;
      }

      const next = { accessToken: payload.access_token, refreshToken: payload.refresh_token };
      await saveSession(next);
      return next;
    } catch {
      await invalidateSession();
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request(path: string, options: ApiOptions, allowRefresh: boolean): Promise<any> {
  const auth = options.auth !== false;
  const current = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method,
    body: options.body as BodyInit | null | undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      ...(auth && current?.accessToken ? { Authorization: `Bearer ${current.accessToken}` } : {}),
    },
  });

  if (response.status === 401
    && auth
    && allowRefresh
    && options.retryOnUnauthorized !== false
    && current?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, { ...options, retryOnUnauthorized: false }, false);
  }

  const payload = await parseBody(response);
  if (!response.ok) throw apiError(response.status, payload);
  return payload;
}

export async function api(path: string, _legacyAccessToken?: string, options: ApiOptions = {}) {
  return request(path, options, true);
}

export async function logoutSession(): Promise<void> {
  const current = getSession();
  let failure: Error | null = null;

  try {
    if (current?.refreshToken) {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) failure = apiError(response.status, await parseBody(response));
    }
  } catch (error: unknown) {
    failure = error instanceof Error ? error : new Error('Falha ao revogar a sessão no servidor.');
  } finally {
    await invalidateSession();
  }

  if (failure) throw failure;
}
