import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import * as SecureStore from 'expo-secure-store';
import { api } from '../src/services/api';
import { clearSession, saveSession } from '../src/storage/token-storage';
import { API_URL } from '../src/config/env';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const liveTest = process.env.IRON_LIVE_E2E === 'true' ? test : test.skip;

type FetchLikeResponse = {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<any>;
};

async function liveHttpFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<FetchLikeResponse> {
  const target =
    typeof input === 'string' || input instanceof URL
      ? new URL(input.toString())
      : new URL(input.url);
  const transport = target.protocol === 'https:' ? https : http;
  const body =
    typeof init.body === 'string' || Buffer.isBuffer(init.body)
      ? init.body
      : init.body == null
        ? undefined
        : String(init.body);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: init.method ?? 'GET',
        headers: init.headers as http.OutgoingHttpHeaders | undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          const payload = Buffer.concat(chunks).toString('utf8');
          const status = response.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            text: async () => payload,
            json: async () => (payload ? JSON.parse(payload) : null),
          });
        });
      },
    );
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

liveTest(
  'frontend API client persists and reads canonical backend state against live Block 6 runtime',
  async () => {
    const previousFetch = global.fetch;
    global.fetch = liveHttpFetch as unknown as typeof fetch;

    try {
      const id = randomUUID();
      const email = `b6-web-${id.slice(0, 8)}@example.com`;
      const password = 'B6-Web-Strong!2026';

      const trialResponse = await liveHttpFetch(`${API_URL}/commercial/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          email,
          password,
          name: 'B6 Web Owner',
          gymName: `B6 Web ${id.slice(0, 8)}`,
          timezone: 'America/Sao_Paulo',
        }),
      });
      expect(trialResponse.status).toBe(201);
      const trial = await trialResponse.json();
      expect(typeof trial.gymId).toBe('string');

      const loginResponse = await liveHttpFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(loginResponse.status).toBe(200);
      const login = await loginResponse.json();
      expect(typeof login.access_token).toBe('string');
      expect(typeof login.refresh_token).toBe('string');

      await saveSession({
        accessToken: login.access_token,
        refreshToken: login.refresh_token,
      });

      const before = await api('/commercial/onboarding');
      expect(before.nextStep).toBe('ACADEMY_PROFILE');

      await api('/commercial/onboarding', undefined, {
        method: 'PATCH',
        body: JSON.stringify({
          step: 'ACADEMY_PROFILE',
          data: {
            name: 'B6 Web Canonical Academy',
            timezone: 'America/Sao_Paulo',
          },
        }),
      });

      const studentEmail = `student-${id.slice(0, 8)}@example.com`;
      const created = await api('/students', undefined, {
        method: 'POST',
        body: JSON.stringify({
          name: 'B6 Web Student',
          email: studentEmail,
          goal: 'CONDICIONAMENTO',
          level: 'INICIANTE',
        }),
      });
      expect(created.email).toBe(studentEmail);

      const students = await api('/students');
      expect(Array.isArray(students)).toBe(true);
      expect(students.some((student: any) => student.email === studentEmail)).toBe(true);

      const features = await api('/product-entitlements/tenant/features');
      expect(Array.isArray(features)).toBe(true);
      expect(
        features.some(
          (feature: any) =>
            feature.featureKey === 'equipment.inventory' && feature.value === true,
        ),
      ).toBe(true);

      const prices = await api('/saas-billing/prices');
      expect(Array.isArray(prices)).toBe(true);
      expect(prices.some((price: any) => price.priceCode === 'IRON_B6_BASIC_MONTHLY')).toBe(true);

      await clearSession();

      expect(SecureStore.setItemAsync).toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    } finally {
      global.fetch = previousFetch;
    }
  },
  30000,
);
