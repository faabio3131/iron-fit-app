import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type ContentItem = {
  id: string; title: string; description?: string | null; lifecycleStatus?: string;
  relationKind?: string; creator?: { displayName?: string; name?: string } | null;
  mediaAssets?: { id: string; kind?: string; mimeType?: string }[];
};
type Overview = {
  generatedAt?: string; rights?: { effectiveActive?: number; expiringWithinDays?: { count?: number; days?: number }; expiredButStillActiveRecords?: number };
  content?: { byLifecycle?: Record<string, number> }; media?: { ingestionsByStatus?: Record<string, number> };
  publishing?: { mappingsByStatus?: Record<string, number> };
};
type Analytics = {
  usage?: { totalSessions?: number; totalEvents?: number };
  window?: { days?: number };
  commercial?: { accrualsByConsumptionCurrency?: { currency: string; accrualCount: number; totalAmountMinor: string }[] };
};
type Props = {
  items: ContentItem[]; overview: Overview | null; analytics: Analytics | null;
  onRefresh: () => void; refreshing: boolean;
};
const lifecycle: Record<string, string> = {
  DRAFT: 'Rascunho', PENDING_REVIEW: 'Em revisão', IN_REVIEW: 'Em revisão',
  APPROVED: 'Aprovado', ACTIVE: 'Ativo', PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado', SUSPENDED: 'Suspenso', REJECTED: 'Recusado',
};
const delivery: Record<string, string> = {
  VIDEO: 'Vídeo', IMAGE: 'Imagem', AUDIO: 'Áudio',
  DOCUMENT: 'Documento', THUMBNAIL: 'Miniatura',
};
function number(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value) : '—';
}
function Stat({ label, value, testID }: { label: string; value: number | undefined; testID?: string }) {
  return <View style={styles.stat} testID={testID}>
    <Text style={styles.statValue}>{number(value)}</Text><Text style={styles.statLabel}>{label}</Text>
  </View>;
}
function Action({ label, testID, onPress, disabled = false, secondary = false }: {
  label: string; testID?: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}

export function CreatorNetworkWorkspace({ items, overview, analytics, onRefresh, refreshing }: Props) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ContentItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const catalog = Array.isArray(items) ? items : [];
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const states = Array.from(new Set(catalog.map((item) => item.lifecycleStatus).filter((v): v is string => !!v)));
  const filtered = catalog.filter((item) =>
    (stateFilter === 'ALL' || item.lifecycleStatus === stateFilter) &&
    (!normalizedSearch ||
      item.title?.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
      item.description?.toLocaleLowerCase('pt-BR').includes(normalizedSearch)));
  async function consult(item: ContentItem) {
    if (!item.id || detailLoading) return;
    if (selectedId === item.id) { setSelectedId(''); setDetail(null); setDetailError(''); return; }
    setSelectedId(item.id); setDetail(null); setDetailError(''); setDetailLoading(true);
    try {
      const received = await api('/creator-network/content/tenant/items/' + encodeURIComponent(item.id));
      if (!received || received.id !== item.id) throw new Error('O servidor não confirmou o registro solicitado.');
      setDetail(received);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Não foi possível consultar o conteúdo.');
    } finally { setDetailLoading(false); }
  }
  const rights = overview?.rights;
  const usage = analytics?.usage;
  const accruals = analytics?.commercial?.accrualsByConsumptionCurrency;

  return <View>
    <GlowCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Rede de Criadores</Text>
          <Text style={styles.muted}>Conteúdo da academia, direitos de uso, distribuição e acompanhamento. Somente o escopo autorizado do seu tenant.</Text>
        </View>
        <Action testID="creator-refresh" label="Atualizar" secondary disabled={refreshing}
          onPress={() => { setSelectedId(''); setDetail(null); onRefresh(); }} />
      </View>
      <View style={styles.stats}>
        <Stat testID="creator-total-items" label="Conteúdos cadastrados" value={catalog.length} />
        <Stat label="Direitos efetivos" value={rights?.effectiveActive} />
        <Stat label="Direitos próximos do vencimento" value={rights?.expiringWithinDays?.count} />
        <Stat label="Registros de direitos vencidos ainda ativos" value={rights?.expiredButStillActiveRecords} />
      </View>
      {(rights?.expiredButStillActiveRecords ?? 0) > 0 ?
        <Text testID="creator-rights-alert" style={styles.warning}>Atenção: o backend identificou direitos vencidos com registros ainda ativos. Não presuma autorização de distribuição.</Text> : null}
    </GlowCard>

    <GlowCard style={styles.card}>
      <Text style={styles.title}>Biblioteca de conteúdos</Text>
      <Text style={styles.muted}>Pesquise materiais disponíveis nesta academia. A visualização não aprova direitos nem publica conteúdo.</Text>
      <TextInput accessibilityLabel="Pesquisar conteúdo" testID="creator-search" value={search} onChangeText={setSearch}
        style={styles.input} placeholder="Buscar pelo título ou descrição" placeholderTextColor="#8c9ba9" />
      <View style={styles.actions}>
        <Action label="Todos os estados" secondary={stateFilter !== 'ALL'} testID="creator-filter-all"
          onPress={() => setStateFilter('ALL')} />
        {states.map((state) => <Action key={state} testID={'creator-filter-' + state}
          label={lifecycle[state] ?? 'Outro estado'} secondary={stateFilter !== state} onPress={() => setStateFilter(state)} />)}
      </View>
      {filtered.slice(0, 100).map((item) => <View key={item.id} testID={'creator-item-' + item.id} style={styles.item}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{item.title ?? 'Conteúdo sem título'}</Text>
          <Text style={styles.state}>{lifecycle[item.lifecycleStatus ?? ''] ?? 'Estado não informado'}</Text>
        </View>
        {item.description ? <Text style={styles.muted} numberOfLines={2}>{item.description}</Text> : null}
        <Text style={styles.muted}>Criador: {item.creator?.displayName ?? item.creator?.name ?? 'Não vinculado'} · Arquivos cadastrados: {Array.isArray(item.mediaAssets) ? item.mediaAssets.length : '—'}</Text>
        <Action testID={'creator-details-' + item.id} label={selectedId === item.id ? 'Fechar detalhes' : 'Consultar detalhes'} secondary disabled={detailLoading && selectedId !== item.id}
          onPress={() => { void consult(item); }} />
        {selectedId === item.id ? <View style={styles.detail} testID={'creator-detail-panel-' + item.id}>
          {detailLoading ? <ActivityIndicator color="#2BF47A" /> : null}
          {detailError ? <Text testID="creator-detail-error" style={styles.error}>{detailError}</Text> : null}
          {detail ? <>
            <Text style={styles.itemTitle}>Informações verificadas pelo IRON</Text>
            <Text style={styles.muted}>Estado: {lifecycle[detail.lifecycleStatus ?? ''] ?? 'Não informado'}</Text>
            {detail.mediaAssets?.length ? detail.mediaAssets.map((asset) => <Text key={asset.id} style={styles.muted}>
              Arquivo: {delivery[asset.kind ?? ''] ?? 'Mídia'} · {asset.mimeType ?? 'Formato não informado'}
            </Text>) : <Text style={styles.muted}>Nenhum arquivo vinculado.</Text>}
            <Text style={styles.warning}>A presença de um arquivo não comprova ingestão, revisão ou publicação final.</Text>
          </> : null}
        </View> : null}
      </View>)}
      {!filtered.length ? <Text style={styles.muted}>Nenhum conteúdo corresponde à busca ou ao filtro selecionado.</Text> : null}
      {filtered.length > 100 ? <Text style={styles.muted}>Exibindo os primeiros 100 registros. Refine a pesquisa.</Text> : null}
    </GlowCard>

    <GlowCard style={styles.card}>
      <Text style={styles.title}>Uso e distribuição</Text>
      <Text style={styles.muted}>Atividade interna observada na janela consultada pela API. Não é medição de audiência externa certificada.</Text>
      <View style={styles.stats}>
        <Stat label="Sessões de conteúdo" value={usage?.totalSessions} />
        <Stat label="Eventos observados" value={usage?.totalEvents} />
      </View>
      <Text style={styles.subTitle}>Registros comerciais por moeda</Text>
      {Array.isArray(accruals) && accruals.length ?
        accruals.map((a) => <View key={a.currency} style={styles.row}>
          <Text style={styles.itemTitle}>{a.currency}</Text>
          <Text style={styles.muted}>{number(a.accrualCount)} registros · Montante em unidades mínimas: {a.totalAmountMinor}</Text>
        </View>) : <Text style={styles.muted}>Nenhum registro comercial nesta janela.</Text>}
      <Text style={styles.warning}>Acúmulos registrados não equivalem a pagamentos liquidados.</Text>
    </GlowCard>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  heading: { flexBasis: 240, flexGrow: 1, gap: 5 },
  title: { color: '#2BF47A', fontWeight: '800', fontSize: 17 },
  subTitle: { color: '#edf8f1', fontWeight: '800', fontSize: 13 },
  muted: { color: '#a9bbcb', fontSize: 12, lineHeight: 18 },
  warning: { color: '#f5c48b', fontSize: 12, lineHeight: 18 },
  error: { color: '#fca5a5', fontSize: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stat: { backgroundColor: '#12222a', borderWidth: 1, borderColor: '#2e453a', borderRadius: 10, flexGrow: 1, flexBasis: 160, padding: 12, gap: 4 },
  statValue: { color: '#f1faf5', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#a9bdc9', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { backgroundColor: '#2BF47A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  buttonText: { fontWeight: '800', fontSize: 12, color: '#06180c' },
  secondary: { backgroundColor: '#16202e', borderColor: '#304252', borderWidth: 1 },
  secondaryText: { color: '#eaf7ed' },
  disabled: { opacity: 0.45 },
  input: { color: '#f3f7ff', backgroundColor: '#0d1522', borderRadius: 9, borderWidth: 1, borderColor: '#304256', padding: 11 },
  item: { borderTopColor: '#283945', borderTopWidth: 1, paddingVertical: 12, gap: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  itemTitle: { color: '#eef6fb', fontSize: 13, fontWeight: '800' },
  state: { color: '#2BF47A', fontSize: 11, fontWeight: '700' },
  detail: { backgroundColor: '#0e2023', borderRadius: 9, padding: 12, gap: 7 },
  row: { paddingVertical: 7, borderTopColor: '#283945', borderTopWidth: 1, gap: 4 },
});
