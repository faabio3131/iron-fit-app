import React from 'react';
import { render } from '@testing-library/react-native';
import { CreatorNetworkWorkspace } from '../src/web/CreatorNetworkWorkspace';

const overview = {
  generatedAt: '2026-09-30T12:00:00.000Z',
  rights: {
    effectiveActive: 3,
    expiringWithinDays: { days: 30, count: 1 },
  },
  content: {
    byLifecycle: { ACTIVE: 2, DRAFT: 1 },
  },
};

const analytics = {
  generatedAt: '2026-09-30T12:00:00.000Z',
  window: { days: 30 },
  usage: {
    totalSessions: 14,
    totalEvents: 22,
    sessionsByDeliveryKind: {
      MANAGED_CONTENT: 4,
      EXTERNAL_REFERENCE: 10,
    },
    eventsByType: {
      CONTENT_OPENED: 12,
      CONTENT_COMPLETED: 5,
    },
  },
};

const items = [
  { id: 'licensed-1', title: 'Conteúdo licenciado', relationKind: 'LICENSED_CONTENT', lifecycleStatus: 'ACTIVE', mediaAssets: [] },
  { id: 'iron-1', title: 'Conteúdo IRON', relationKind: 'IRON_OWNED', lifecycleStatus: 'ACTIVE', mediaAssets: [] },
  { id: 'tenant-1', title: 'Conteúdo privado', relationKind: 'TENANT_OWNED', lifecycleStatus: 'ACTIVE', mediaAssets: [] },
];

describe('O16 Creator Network V1', () => {
  test('hides managed/private items when capabilities are OUT', () => {
    const view = render(
      <CreatorNetworkWorkspace
        items={items}
        overview={overview}
        analytics={analytics}
        externalYoutubeEnabled
        ironManagedEnabled={false}
        tenantPrivateEnabled={false}
      />,
    );

    expect(view.getByText('Conteúdo externo do YouTube')).toBeTruthy();
    expect(view.getAllByText('Não disponível no plano').length).toBe(2);
    expect(view.queryByText('Conteúdo licenciado')).toBeNull();
    expect(view.queryByText('Conteúdo IRON')).toBeNull();
    expect(view.queryByText('Conteúdo privado')).toBeNull();
    expect(view.getByText('14')).toBeTruthy();
    expect(view.getByText('22')).toBeTruthy();
  });

  test('shows authorized managed/private items only when each capability is active', () => {
    const view = render(
      <CreatorNetworkWorkspace
        items={items}
        overview={overview}
        analytics={analytics}
        externalYoutubeEnabled
        ironManagedEnabled
        tenantPrivateEnabled
      />,
    );

    expect(view.getByText('Conteúdo licenciado')).toBeTruthy();
    expect(view.getByText('Conteúdo IRON')).toBeTruthy();
    expect(view.getByText('Conteúdo privado')).toBeTruthy();
  });
});
