import { randomUUID } from 'node:crypto';
import * as SecureStore from 'expo-secure-store';
import { api } from '../src/services/api';
import { clearSession, saveSession } from '../src/storage/token-storage';
import { API_URL } from '../src/config/env';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const liveTest = process.env.IRON_LIVE_E2E === 'true' ? test : test.skip;

liveTest(
  'frontend API client persists and reads canonical backend state against live Block 6 runtime',
  async () => {
    const id = randomUUID();
    const email = `b6-web-${id.slice(0, 8)}@example.com`;
    const password = 'B6-Web-Strong!2026';

    const trialResponse = await fetch(`${API_URL}/commercial/trial/start`, {
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

    const loginResponse = await fetch(`${API_URL}/auth/login`, {
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
  },
  30000,
);
