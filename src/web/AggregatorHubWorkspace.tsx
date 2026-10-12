import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { iron } from '../design/iron-theme';

type Props = {
  canSeeManagement: boolean;
};

function countMapTotal(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0);
}

function dateTime(value: unknown) {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function pct(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? (value * 100).toFixed(1).replace('.', ',') + '%' : '—';
}

function moneyMinor(value: unknown, currency?: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const code = typeof currency === 'string' && currency ? currency : 'BRL';
  try {
    return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: code });
  } catch {
    return (value / 100).toFixed(2) + ' ' + code;
  }
}

function statusLabel(value: unknown) {
  const words: Record<string, string> = {
    ACTIVE: 'Ativo', INACTIVE: 'Inativo', CONNECTED: 'Conectado', DISCONNECTED: 'Desconectado',
    PENDING: 'Pendente', CONFIRMED: 'Confirmado', PROVISIONAL: 'Provisório', DENIED: 'Negado',
    FAILED: 'Falhou', RECEIVED: 'Recebido', EXPECTED: 'Esperado', DIVERGENT: 'Divergente',
    DISPUTED: 'Em disputa', EXPIRED: 'Expirado', RECONCILED: 'Reconciliado', OPEN: 'Aberto',
    REVIEWING: 'Em análise', RESOLVED: 'Resolvido',
  };
  return typeof value === 'string' ? (words[value] ?? value.replace(/_/g, ' ')) : '—';
}

function Kpi({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return <View style={styles.kpi}><View style={styles.kpiTop}><Text style={styles.kpiLabel}>{label}</Text><Ionicons name={icon} size={19} color={iron.cyan} /></View><Text style={styles.kpiValue}>{value}</Text><Text style={styles.muted}>{detail}</Text></View>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text style={styles.panelTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}<View style={styles.panelBody}>{children}</View></View>;
}

export function AggregatorHubWorkspace({ canSeeManagement }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [reception, setReception] = useState<any>(null);
  const [risk, setRisk] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextSummary, nextReception] = await Promise.all([
        api('/aggregator/operations/summary'),
        api('/aggregator/operations/reception-queue?limit=25'),
      ]);
      setSummary(nextSummary);
      setReception(nextReception);

      if (canSeeManagement) {
        const [nextRisk, nextSettlements, nextOverview, nextProviders, nextTrends] = await Promise.all([
          api('/aggregator/operations/risk-queue?limit=25'),
          api('/aggregator/operations/settlement-queue?limit=25'),
          api('/aggregator/intelligence/overview?days=30'),
          api('/aggregator/intelligence/providers?days=30'),
          api('/aggregator/intelligence/trends?days=30'),
        ]);
        setRisk(Array.isArray(nextRisk) ? nextRisk : []);
        setSettlements(Array.isArray(nextSettlements) ? nextSettlements : []);
        setOverview(nextOverview);
        setProviders(Array.isArray(nextProviders?.items) ? nextProviders.items : []);
        setTrends(Array.isArray(nextTrends?.points) ? nextTrends.points : []);
      } else {
        setRisk([]);
        setSettlements([]);
        setOverview(null);
        setProviders([]);
        setTrends([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o Aggregator Hub.');
    } finally {
      setLoading(false);
    }
  }, [canSeeManagement]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const receptionItems = Array.isArray(reception?.items) ? reception.items : [];
  const signals = Array.isArray(overview?.signals) ? overview.signals : [];
  const latestTrend = useMemo(() => trends.length ? trends[trends.length - 1] : null, [trends]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={iron.primary} /><Text style={styles.muted}>Carregando operação de parceiros…</Text></View>;

  return <View testID="aggregator-hub-workspace">
    <View style={styles.hero}>
      <View style={styles.flex}><Text style={styles.eyebrow}>AGGREGATOR HUB</Text><Text style={styles.heroTitle}>Operação de parceiros em uma única visão</Text><Text style={styles.muted}>Visitas, reconciliação, risco e settlement usam somente fatos canônicos do backend. O Hub não autoriza acesso por conta própria.</Text></View>
      <TouchableOpacity accessibilityRole="button" style={styles.refresh} onPress={() => { void load(); }}><Ionicons name="refresh" size={17} color={iron.text} /><Text style={styles.refreshText}>Atualizar</Text></TouchableOpacity>
    </View>

    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

    <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color={iron.cyan} /><Text style={styles.noticeText}>Wellhub, TotalPass e outros providers só podem aparecer como ativos/homologados quando houver evidência externa real. O status exibido aqui vem das conexões canônicas existentes.</Text></View>

    <View style={styles.kpis}>
      <Kpi label="Conexões" value={String(countMapTotal(summary?.connections))} detail="Conexões de providers no tenant" icon="git-network-outline" />
      <Kpi label="Visitas" value={String(countMapTotal(summary?.visits))} detail="Autorizações registradas" icon="walk-outline" />
      <Kpi label="Settlements" value={String(countMapTotal(summary?.settlements))} detail="Liquidações registradas" icon="cash-outline" />
      <Kpi label="Riscos abertos" value={String(summary?.unresolvedRiskCases ?? 0)} detail="Aberto ou em análise" icon="warning-outline" />
    </View>

    <View style={styles.grid}>
      <Panel title="Fila da recepção" subtitle="Itens que exigem atenção operacional; elegibilidade e autorização continuam no backend.">
        {receptionItems.length ? receptionItems.map((item: any) => <View key={item.visitAuthorizationId} style={styles.row}>
          <View style={styles.rowTop}><Text style={styles.rowTitle}>{item.providerCode ?? 'Provider'} · visita {item.externalVisitId ?? '—'}</Text><Text style={styles.status}>{statusLabel(item.visitStatus)}</Text></View>
          <Text style={styles.muted}>Membro externo: {item.externalMemberId ?? '—'} · Situação no provider: {statusLabel(item.providerMemberStatus)}</Text>
          <Text style={styles.muted}>Atenção: {statusLabel(item.attentionCode)} · solicitado em {dateTime(item.requestedAt)}</Text>
          {item.denialReason ? <Text style={styles.warningText}>Motivo: {String(item.denialReason)}</Text> : null}
        </View>) : <Text style={styles.empty}>Nenhuma pendência na fila da recepção.</Text>}
      </Panel>

      <Panel title="Estado operacional" subtitle="Resumo por estado, sem inferir autoridade inexistente.">
        {['connections', 'visits', 'settlements', 'reconciliations'].map((key) => <View key={key} style={styles.bucket}>
          <Text style={styles.bucketTitle}>{key === 'connections' ? 'Conexões' : key === 'visits' ? 'Visitas' : key === 'settlements' ? 'Settlements' : 'Reconciliações'}</Text>
          <View style={styles.chips}>{Object.entries(summary?.[key] ?? {}).map(([status, value]) => <View key={status} style={styles.chip}><Text style={styles.chipText}>{statusLabel(status)} · {String(value)}</Text></View>)}</View>
          {!Object.keys(summary?.[key] ?? {}).length ? <Text style={styles.muted}>Sem registros.</Text> : null}
        </View>)}
      </Panel>
    </View>

    {canSeeManagement ? <>
      <View style={styles.grid}>
        <Panel title="Intelligence operacional" subtitle="Analytics determinístico e advisory dos últimos 30 dias.">
          <View style={styles.rateGrid}>
            <View style={styles.rate}><Text style={styles.rateValue}>{pct(overview?.rates?.confirmedVisitRate)}</Text><Text style={styles.muted}>Visitas confirmadas</Text></View>
            <View style={styles.rate}><Text style={styles.rateValue}>{pct(overview?.rates?.reconciledRate)}</Text><Text style={styles.muted}>Reconciliação</Text></View>
            <View style={styles.rate}><Text style={styles.rateValue}>{pct(overview?.rates?.settlementExceptionRate)}</Text><Text style={styles.muted}>Exceções settlement</Text></View>
          </View>
          {signals.length ? signals.map((signal: any) => <View key={signal.code} style={styles.signal}><Ionicons name="alert-circle-outline" size={17} color="#fbbf24" /><Text style={styles.signalText}>{statusLabel(signal.code)} · {signal.count}</Text></View>) : <Text style={styles.empty}>Nenhum sinal de atenção no período.</Text>}
          {latestTrend ? <Text style={styles.helper}>Último dia da janela: {latestTrend.date} · {latestTrend.visits ?? 0} visitas · {latestTrend.riskCasesCreated ?? 0} novos casos de risco.</Text> : null}
        </Panel>

        <Panel title="Providers" subtitle="Comparativo provider-neutral; valores nunca são somados entre moedas diferentes.">
          {providers.length ? providers.map((item: any) => <View key={item.providerCode} style={styles.row}>
            <Text style={styles.rowTitle}>{item.providerCode}</Text>
            <Text style={styles.muted}>Confirmação de visitas: {pct(item.rates?.confirmedVisitRate)} · Reconciliação: {pct(item.rates?.reconciledRate)}</Text>
            {Object.entries(item.amountsByCurrency ?? {}).map(([currency, amounts]: [string, any]) => <Text key={currency} style={styles.muted}>{currency}: esperado {moneyMinor(amounts.expected, currency)} · confirmado {moneyMinor(amounts.confirmed, currency)} · risco {moneyMinor(amounts.potentialRisk, currency)}</Text>)}
          </View>) : <Text style={styles.empty}>Nenhum provider com fatos no período.</Text>}
        </Panel>
      </View>

      <View style={styles.grid}>
        <Panel title="Fila de risco" subtitle="Casos abertos ou em análise.">
          {risk.length ? risk.map((item: any) => <View key={item.id} style={styles.row}><View style={styles.rowTop}><Text style={styles.rowTitle}>{item.connection?.providerCode ?? 'Provider'} · {statusLabel(item.type)}</Text><Text style={styles.status}>{statusLabel(item.status)}</Text></View><Text style={styles.muted}>Exposição potencial: {moneyMinor(item.potentialAmount, item.currency)} · criada em {dateTime(item.createdAt)}</Text></View>) : <Text style={styles.empty}>Nenhum caso de risco pendente.</Text>}
        </Panel>

        <Panel title="Fila de settlement" subtitle="Liquidações que ainda exigem acompanhamento.">
          {settlements.length ? settlements.map((item: any) => <View key={item.id} style={styles.row}><View style={styles.rowTop}><Text style={styles.rowTitle}>{item.connection?.providerCode ?? 'Provider'} · {item.externalSettlementId ?? item.externalVisitId ?? 'Settlement'}</Text><Text style={styles.status}>{statusLabel(item.status)}</Text></View><Text style={styles.muted}>Esperado {moneyMinor(item.amountExpected, item.currency)} · confirmado {moneyMinor(item.amountConfirmed, item.currency)}</Text></View>) : <Text style={styles.empty}>Nenhum settlement pendente.</Text>}
        </Panel>
      </View>
    </> : <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={iron.cyan} /><Text style={styles.noticeText}>Seu perfil pode operar a recepção, mas analytics, risco e settlement ficam restritos a Proprietário, Gerente ou Administrador.</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start', backgroundColor: iron.surface, borderWidth: 1, borderColor: iron.line, borderRadius: 16, padding: 17, marginBottom: 10 },
  eyebrow: { color: iron.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { color: iron.text, fontSize: 21, fontWeight: '900', letterSpacing: -.4, marginBottom: 5 },
  muted: { color: iron.muted, fontSize: 12, lineHeight: 18 },
  helper: { color: iron.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  refresh: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: iron.elevated, borderWidth: 1, borderColor: iron.line, borderRadius: 11, paddingHorizontal: 13 },
  refreshText: { color: iron.text, fontWeight: '800', fontSize: 12 },
  notice: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: iron.surface, borderWidth: 1, borderColor: iron.line, borderRadius: 13, padding: 12, marginBottom: 10 },
  noticeText: { flex: 1, color: iron.muted, fontSize: 11, lineHeight: 17 },
  errorBox: { backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#5b2028', borderRadius: 12, padding: 12, marginBottom: 10 },
  errorText: { color: '#fecaca', fontSize: 12 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 10 },
  kpi: { flexGrow: 1, flexShrink: 1, flexBasis: 190, minWidth: 170, backgroundColor: iron.elevated, borderWidth: 1, borderColor: iron.line, borderRadius: 14, padding: 13 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  kpiLabel: { color: iron.muted, fontSize: 11, fontWeight: '700' },
  kpiValue: { color: iron.text, fontSize: 25, fontWeight: '900', marginVertical: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'flex-start' },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 390, minWidth: 0, backgroundColor: iron.surface, borderWidth: 1, borderColor: iron.line, borderRadius: 15, padding: 14, marginBottom: 9 },
  panelTitle: { color: iron.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  panelBody: { marginTop: 9 },
  row: { backgroundColor: iron.base, borderWidth: 1, borderColor: iron.line, borderRadius: 11, padding: 11, marginBottom: 7 },
  rowTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 7, alignItems: 'center', marginBottom: 4 },
  rowTitle: { color: iron.text, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  status: { color: iron.cyan, fontSize: 10, fontWeight: '800' },
  warningText: { color: '#fbbf24', fontSize: 11, marginTop: 5 },
  empty: { color: iron.muted, fontSize: 12, paddingVertical: 10 },
  bucket: { marginBottom: 10 },
  bucketTitle: { color: iron.text, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: iron.base, borderWidth: 1, borderColor: iron.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { color: iron.text, fontSize: 10, fontWeight: '700' },
  rateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  rate: { flexGrow: 1, flexBasis: 110, minWidth: 100, backgroundColor: iron.base, borderWidth: 1, borderColor: iron.line, borderRadius: 10, padding: 10 },
  rateValue: { color: iron.text, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  signal: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#241b08', borderWidth: 1, borderColor: '#76591b', borderRadius: 9, padding: 8, marginBottom: 6 },
  signalText: { color: '#fde68a', fontSize: 11, fontWeight: '700' },
});
