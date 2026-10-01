import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  items: any[];
  overview: any;
  analytics: any;
  externalYoutubeEnabled: boolean;
  ironManagedEnabled: boolean;
  tenantPrivateEnabled: boolean;
};

const lifecycleLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  DRAFT: 'Em preparação',
  SUSPENDED: 'Suspenso',
  RETIRED: 'Arquivado',
};

const relationLabels: Record<string, string> = {
  LICENSED_CONTENT: 'Conteúdo licenciado',
  IRON_OWNED: 'Conteúdo gerenciado pelo IRON',
  TENANT_OWNED: 'Conteúdo privado da academia',
};

const eventLabels: Record<string, string> = {
  DELIVERY_RESOLVED: 'Entregas resolvidas',
  CONTENT_OPENED: 'Aberturas',
  CONTENT_PROGRESS: 'Progresso',
  CONTENT_COMPLETED: 'Conclusões',
  CONTENT_DISMISSED: 'Dispensas',
};

function recordCount(record: unknown, key: string) {
  if (!record || typeof record !== 'object') return 0;
  const value = Number((record as Record<string, unknown>)[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function recordTotal(record: unknown) {
  if (!record || typeof record !== 'object') return 0;
  return Object.values(record as Record<string, unknown>).reduce<number>(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function Capability({
  title,
  enabled,
  description,
}: {
  title: string;
  enabled: boolean;
  description: string;
}) {
  return (
    <View style={[styles.capabilityCard, !enabled && styles.disabledCard]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={enabled ? styles.enabledBadge : styles.disabledBadge}>
        {enabled ? 'Disponível' : 'Não disponível no plano'}
      </Text>
      <Text style={styles.muted}>{description}</Text>
    </View>
  );
}

export function CreatorNetworkWorkspace({
  items,
  overview,
  analytics,
  externalYoutubeEnabled,
  ironManagedEnabled,
  tenantPrivateEnabled,
}: Props) {
  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items : []).filter((item) => {
      const relation = String(item?.relationKind ?? '');
      if (relation === 'TENANT_OWNED') return tenantPrivateEnabled;
      if (relation === 'IRON_OWNED' || relation === 'LICENSED_CONTENT') {
        return ironManagedEnabled;
      }
      return false;
    }),
    [ironManagedEnabled, items, tenantPrivateEnabled],
  );

  const contentLifecycle = overview?.content?.byLifecycle ?? {};
  const usage = analytics?.usage ?? {};
  const activeContent = recordCount(contentLifecycle, 'ACTIVE');
  const totalContent = recordTotal(contentLifecycle);
  const totalSessions = Number(usage?.totalSessions ?? 0) || 0;
  const totalEvents = Number(usage?.totalEvents ?? 0) || 0;
  const effectiveRights = Number(overview?.rights?.effectiveActive ?? 0) || 0;
  const rightsAttention = Number(overview?.rights?.expiringWithinDays?.count ?? 0) || 0;
  const rightsAttentionDays = Number(overview?.rights?.expiringWithinDays?.days ?? 30) || 30;
  const eventRows = Object.entries(
    usage?.eventsByType && typeof usage.eventsByType === 'object'
      ? usage.eventsByType
      : {},
  ).sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <View testID="creator-network-workspace">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>CREATOR NETWORK</Text>
          <Text style={styles.heroTitle}>Conteúdo e utilização</Text>
          <Text style={styles.muted}>
            Conteúdo, utilização e desempenho da rede de criadores vinculada à sua academia, sem expor consoles internos de governança.
          </Text>
        </View>
        <View style={styles.periodCard}>
          <Text style={styles.kicker}>Período dos indicadores</Text>
          <Text style={styles.periodValue}>
            {analytics?.window?.days ? String(analytics.window.days) + ' dias' : '30 dias'}
          </Text>
          <Text style={styles.meta}>
            Atualizado em {formatDate(analytics?.generatedAt ?? overview?.generatedAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionHeading}>Visão geral</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Conteúdos ativos</Text>
          <Text style={styles.bigValue}>{activeContent}</Text>
          <Text style={styles.meta}>{totalContent} registros no escopo atual</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Sessões de uso</Text>
          <Text style={styles.bigValue}>{totalSessions}</Text>
          <Text style={styles.meta}>Consumo observado no período</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Interações</Text>
          <Text style={styles.bigValue}>{totalEvents}</Text>
          <Text style={styles.meta}>Eventos de uso e engajamento</Text>
        </View>
        <View style={[styles.summaryCard, rightsAttention > 0 && styles.alertCard]}>
          <Text style={styles.kicker}>Direitos vigentes</Text>
          <Text style={styles.bigValue}>{effectiveRights}</Text>
          <Text style={styles.meta}>
            {rightsAttention > 0
              ? String(rightsAttention) + ' exigem atenção nos próximos ' + String(rightsAttentionDays) + ' dias'
              : 'Nenhum alerta de validade no período'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capacidades do seu plano</Text>
        <Text style={styles.muted}>
          Recursos não autorizados permanecem bloqueados. Esta tela nunca amplia o que o plano permite.
        </Text>
        <View style={styles.capabilityGrid}>
          <Capability
            title="Conteúdo externo do YouTube"
            enabled={externalYoutubeEnabled}
            description="Referências externas permitidas pela política de conteúdo."
          />
          <Capability
            title="Conteúdo gerenciado pelo IRON"
            enabled={ironManagedEnabled}
            description="Biblioteca gerenciada e publicada pelo ecossistema IRON."
          />
          <Capability
            title="Conteúdo privado da academia"
            enabled={tenantPrivateEnabled}
            description="Materiais privados vinculados exclusivamente a esta academia."
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conteúdo</Text>
        <Text style={styles.muted}>
          Apenas itens compatíveis com as capacidades comerciais ativas são exibidos.
        </Text>
        {visibleItems.length ? (
          <View style={styles.contentGrid}>
            {visibleItems.map((item) => (
              <View key={item.id} style={styles.contentCard}>
                <View style={styles.rowHead}>
                  <Text style={styles.cardTitle}>{item.title ?? 'Conteúdo'}</Text>
                  <Text style={styles.statusBadge}>
                    {lifecycleLabels[String(item.lifecycleStatus ?? '')] ?? 'Disponível'}
                  </Text>
                </View>
                {item.description ? <Text style={styles.muted}>{String(item.description)}</Text> : null}
                <Text style={styles.meta}>
                  {relationLabels[String(item.relationKind ?? '')] ?? 'Conteúdo autorizado'}
                  {item.creator?.displayName ? ' · ' + String(item.creator.displayName) : ''}
                </Text>
                <Text style={styles.meta}>
                  {Array.isArray(item.mediaAssets)
                    ? String(item.mediaAssets.length) + ' mídia(s) vinculada(s)'
                    : 'Sem mídia gerenciada'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            Nenhum conteúdo gerenciado está disponível para as capacidades ativas deste plano.
          </Text>
        )}
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Utilização</Text>
          <Text style={styles.muted}>Como o conteúdo foi entregue no período.</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Sessões</Text>
            <Text style={styles.metricValue}>{totalSessions}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Interações</Text>
            <Text style={styles.metricValue}>{totalEvents}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Conteúdo gerenciado</Text>
            <Text style={styles.metricValue}>
              {recordCount(usage?.sessionsByDeliveryKind, 'MANAGED_CONTENT')}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Referências externas</Text>
            <Text style={styles.metricValue}>
              {recordCount(usage?.sessionsByDeliveryKind, 'EXTERNAL_REFERENCE')}
            </Text>
          </View>
        </View>

        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Indicadores</Text>
          <Text style={styles.muted}>Eventos observados no período.</Text>
          {eventRows.length ? eventRows.map(([key, value]) => (
            <View key={key} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{eventLabels[key] ?? key}</Text>
              <Text style={styles.metricValue}>{Number(value) || 0}</Text>
            </View>
          )) : (
            <Text style={styles.empty}>Ainda não há eventos de engajamento no período.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', marginTop: 3, marginBottom: 4 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  periodCard: { minWidth: 180, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  kicker: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  periodValue: { color: '#eef7ff', fontSize: 15, fontWeight: '900', marginTop: 3 },
  meta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  sectionHeading: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 6 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 210, minWidth: 180, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 10 },
  alertCard: { borderColor: '#7f2d3a', backgroundColor: '#1a1018' },
  bigValue: { color: '#eef7ff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  capabilityCard: { flexGrow: 1, flexBasis: 220, minWidth: 200, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  disabledCard: { opacity: 0.62 },
  cardTitle: { color: '#eef7ff', fontSize: 12, fontWeight: '900' },
  enabledBadge: { alignSelf: 'flex-start', color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800', marginVertical: 6 },
  disabledBadge: { alignSelf: 'flex-start', color: '#b3c3d5', backgroundColor: '#101722', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800', marginVertical: 6 },
  contentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  contentCard: { flexGrow: 1, flexBasis: 280, minWidth: 240, maxWidth: 430, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  rowHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' },
  statusBadge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '800' },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 9 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  column: { flexGrow: 1, flexBasis: 380, minWidth: 0, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: '#17263a', paddingVertical: 8 },
  metricLabel: { color: '#9fb0c5', fontSize: 10, fontWeight: '700' },
  metricValue: { color: '#eef7ff', fontSize: 11, fontWeight: '900' },
});
