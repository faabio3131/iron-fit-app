let mockSession: { accessToken: string; refreshToken: string } | null = null;

jest.mock('../src/storage/token-storage', () => ({
  getSession: jest.fn(() => mockSession),
  saveSession: jest.fn(async (session) => { mockSession = session; }),
  clearSession: jest.fn(async () => { mockSession = null; }),
}));

// eslint-disable-next-line import/first
import { api, logoutSession } from '../src/services/api';
// eslint-disable-next-line import/first
import { clearSession } from '../src/storage/token-storage';

function response(status: number, payload: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: jest.fn(async () => payload == null ? '' : JSON.stringify(payload)),
  } as unknown as Response;
}

describe('auth session lifecycle', () => {
  beforeEach(() => {
    mockSession = { accessToken: 'access-old', refreshToken: 'refresh-old' };
    (global as any).fetch = jest.fn();
  });

  test('renews through /auth/refresh on 401 and retries the original request', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(response(200, { access_token: 'access-new', refresh_token: 'refresh-new' }))
      .mockResolvedValueOnce(response(200, { id: 'profile-1' }));

    await expect(api('/me/profile')).resolves.toEqual({ id: 'profile-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refreshToken: 'refresh-old' });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access-new');
  });

  test('logout revokes the refresh token and clears local session', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(response(200, { revoked: true }));

    await logoutSession();
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/logout');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-old' });
    expect(clearSession).toHaveBeenCalled();
    expect(mockSession).toBeNull();
  });
});
