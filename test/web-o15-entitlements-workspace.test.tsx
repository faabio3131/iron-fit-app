import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { EntitlementsWorkspace } from '../src/web/EntitlementsWorkspace';

const subscription = {
  status: 'ACTIVE',
  effectiveFrom: '2026-09-01T00:00:00.000Z',
  planVersion: {
    version: 3,
    productPlan: {
      name: 'IRON Pro',
      code: 'IRON_PRO',
    },
  },
};

const features = [
  {
    featureKey: 'equipment.catalog',
    kind: 'FEATURE',
    value: true,
    planValue: true,
    source: 'PLAN_ENTITLEMENT',
    reason: null,
    definition: {
      domain: 'EQUIPMENT',
      description: 'Catálogo canônico de equipamentos.',
      allowedPolicyValues: null,
    },
  },
  {
    featureKey: 'content.private_items_max',
    kind: 'LIMIT',
    value: 20,
    planValue: 50,
    source: 'TENANT_CONFIGURATION',
    reason: null,
    definition: {
      domain: 'CONTENT',
      description: 'Limite de itens privados.',
      allowedPolicyValues: null,
    },
  },
  {
    featureKey: 'content.delivery_mode',
    kind: 'POLICY',
    value: ['IRON_FIRST'],
    planValue: ['IRON_FIRST', 'YOUTUBE_EXTERNAL'],
    source: 'TENANT_CONFIGURATION',
    reason: null,
    definition: {
      domain: 'CONTENT',
      description: 'Modos de entrega autorizados.',
      allowedPolicyValues: ['IRON_FIRST', 'YOUTUBE_EXTERNAL'],
    },
  },
  {
    featureKey: 'ai.workout_generation',
    kind: 'FEATURE',
    value: true,
    planValue: true,
    source: 'PLAN_ENTITLEMENT',
    reason: null,
    definition: { domain: 'AI', description: 'Sugestões assistidas de treino.', allowedPolicyValues: null },
  },
  {
    featureKey: 'integration.google',
    kind: 'FEATURE',
    value: true,
    planValue: true,
    source: 'PLAN_ENTITLEMENT',
    reason: null,
    definition: { domain: 'INTEGRATION', description: 'Integração opcional da academia.', allowedPolicyValues: null },
  },
  {
    featureKey: 'aggregator.wellhub',
    kind: 'FEATURE',
    value: false,
    planValue: false,
    source: 'FAIL_CLOSED_DEFAULT',
    reason: 'ENTITLEMENT_NOT_GRANTED',
    definition: {
      domain: 'AGGREGATOR',
      description: 'Capacidade de agregador.',
      allowedPolicyValues: null,
    },
  },
];

describe('O15 EntitlementsWorkspace', () => {
  test('renders product language without technical keys as primary UI', () => {
    const view = render(
      <EntitlementsWorkspace
        subscription={subscription}
        features={features}
        saving={false}
        onSetConfiguration={jest.fn()}
        onResetConfiguration={jest.fn()}
      />,
    );

    expect(view.getByText('IRON Pro')).toBeTruthy();
    expect(view.getByText('Catálogo de equipamentos')).toBeTruthy();
    expect(view.getByText('Limite de conteúdo privado')).toBeTruthy();
    expect(view.getByText('Modo de entrega de conteúdo')).toBeTruthy();
    expect(view.getByText('Wellhub')).toBeTruthy();
    expect(view.queryByText('content.private_items_max')).toBeNull();
    expect(view.getByText('Este recurso não faz parte do plano atual.')).toBeTruthy();
  });

  test('commercial limits and integration grants are read-only while operational preferences may be narrowed', async () => {
    const setConfig = jest.fn().mockResolvedValue(undefined);
    const resetConfig = jest.fn().mockResolvedValue(undefined);
    const view = render(<EntitlementsWorkspace
      subscription={subscription} features={features} saving={false}
      onSetConfiguration={setConfig} onResetConfiguration={resetConfig}
    />);

    expect(view.getByText('Limites contratados')).toBeTruthy();
    expect(view.getByText('Integrações autorizadas')).toBeTruthy();
    expect(view.getByText('Preferências da academia')).toBeTruthy();
    expect(view.getByText('Recursos do plano')).toBeTruthy();
    expect(view.getByText(/Limite comercial definido pela FM Tecnologia/)).toBeTruthy();
    expect(view.getByText(/Recurso permitido no plano não significa serviço conectado/)).toBeTruthy();
    expect(view.queryByLabelText('Limite de Limite de conteúdo privado')).toBeNull();
    expect(view.queryByTestId('entitlement-limit-apply-content.private_items_max')).toBeNull();
    expect(view.queryByTestId('entitlement-disable-equipment.catalog')).toBeNull();
    expect(view.queryByTestId('entitlement-disable-integration.google')).toBeNull();
    expect(view.queryByTestId('entitlement-disable-ai.workout_generation')).toBeTruthy();
    fireEvent.press(view.getByTestId('entitlement-disable-ai.workout_generation'));
    await waitFor(() => expect(setConfig).toHaveBeenCalledWith('ai.workout_generation', { featureEnabled: false }));
    expect(setConfig).toHaveBeenCalledTimes(1);
    expect(resetConfig).not.toHaveBeenCalled();
  });

  test('POLICY choices come only from the plan subset', async () => {
    const setConfig = jest.fn().mockResolvedValue(undefined);
    const view = render(
      <EntitlementsWorkspace
        subscription={subscription}
        features={features}
        saving={false}
        onSetConfiguration={setConfig}
        onResetConfiguration={jest.fn()}
      />,
    );

    fireEvent.press(view.getByText('YouTube externo'));
    fireEvent.press(view.getByTestId('entitlement-policy-apply-content.delivery_mode'));

    await waitFor(() =>
      expect(setConfig).toHaveBeenCalledWith('content.delivery_mode', {
        policyValues: ['IRON_FIRST', 'YOUTUBE_EXTERNAL'],
      }),
    );
  });
});
