import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { CommercialWebApp } from '../src/web/CommercialWebApp';

const mockApi = jest.fn();
const mockLogout = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'owner-1',
      name: 'Owner IRON',
      email: 'owner@example.com',
      roles: ['OWNER'],
      permissions: ['gym.read'],
    },
    activeTenantId: 'gym-1',
    logout: mockLogout,
  }),
}));
jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

function payloadFor(path: string) {
  if (path === '/product-entitlements/tenant/features') {
    return [
      { featureKey: 'equipment.catalog', kind: 'FEATURE', value: true, source: 'PLAN_ENTITLEMENT' },
      { featureKey: 'equipment.inventory', kind: 'FEATURE', value: true, source: 'PLAN_ENTITLEMENT' },
      { featureKey: 'ai.workout_generation', kind: 'FEATURE', value: true, source: 'PLAN_ENTITLEMENT' },
      { featureKey: 'content.tenant_private', kind: 'FEATURE', value: false, source: 'PLAN_ENTITLEMENT' },
    ];
  }
  if (path === '/product-entitlements/tenant/current') return { id: 'sub-1', status: 'ACTIVE' };
  if (path === '/commercial/trial/status') return { status: 'TRIALING' };
  if (path === '/commercial/onboarding') return { status: 'IN_PROGRESS', completedSteps: [], nextStep: 'ACADEMY_PROFILE' };
  if (path === '/dashboard/summary') return { students: { total: 2 } };
  if (path.startsWith('/dashboard/')) return [];
  if (path === '/gyms/gym-1') return { id: 'gym-1', name: 'Academia Teste', timezone: 'America/Sao_Paulo' };
  return [];
}

describe('commercial web shell', () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockLogout.mockReset();
    mockApi.mockImplementation(async (path: string) => payloadFor(path));
  });

  test('renders owner shell and entitlement-gated modules from canonical responses', async () => {
    const view = render(<CommercialWebApp />);
    await waitFor(() => expect(view.getByTestId('commercial-web-app')).toBeTruthy());
    await waitFor(() => expect(view.getByText('Academia Teste')).toBeTruthy());
    expect(view.getByTestId('nav-equipment')).toBeTruthy();
    expect(view.queryByTestId('nav-creator')).toBeNull();
    expect(mockApi).toHaveBeenCalledWith('/product-entitlements/tenant/features');
    expect(mockApi).toHaveBeenCalledWith('/commercial/trial/status');
  });
});
