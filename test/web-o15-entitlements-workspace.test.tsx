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

  test('FEATURE can only be narrowed, LIMIT is capped by plan and reset inherits plan', async () => {
    const setConfig = jest.fn().mockResolvedValue(undefined);
    const resetConfig = jest.fn().mockResolvedValue(undefined);
    const view = render(
      <EntitlementsWorkspace
        subscription={subscription}
        features={features}
        saving={false}
        onSetConfiguration={setConfig}
        onResetConfiguration={resetConfig}
      />,
    );

    fireEvent.press(view.getByTestId('entitlement-disable-equipment.catalog'));
    await waitFor(() =>
      expect(setConfig).toHaveBeenCalledWith('equipment.catalog', {
        featureEnabled: false,
      }),
    );

    const limit = view.getByLabelText('Limite de Limite de conteúdo privado');
    fireEvent.changeText(limit, '60');
    fireEvent.press(view.getByTestId('entitlement-limit-apply-content.private_items_max'));
    expect(setConfig).not.toHaveBeenCalledWith(
      'content.private_items_max',
      expect.anything(),
    );

    fireEvent.changeText(limit, '30');
    fireEvent.press(view.getByTestId('entitlement-limit-apply-content.private_items_max'));
    await waitFor(() =>
      expect(setConfig).toHaveBeenCalledWith('content.private_items_max', {
        limitValue: 30,
      }),
    );
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
