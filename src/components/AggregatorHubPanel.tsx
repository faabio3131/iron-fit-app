import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type CountMap = Record<string, number>;
type Summary = {
  visits?: CountMap; connections?: CountMap; settlements?: CountMap;
  reconciliations?: CountMap; risks?: CountMap; unresolvedRiskCases?: number; generatedAt?: string;
};
type QueueVisit = {
  visitAuthorizationId: string; providerCode: string; visitStatus: string;
  attentionCode: string; requestedAt?: string; providerConnectionStatus?: string;
};
type Risk = { id: string; status?: string; type?: string; connection?: { providerCode?: string } };
type Settlement = {
  id: string; status?: string; providerStatus?: string; currency?: string;
  amountExpected?: number | null; amountConfirmed?: number | null;
  connection?: { providerCode?: string };
};
type Overview = {
  totals?: { visits?: number; settlements?: number; reconciliations?: number; riskCases?: number; unresolvedRiskCases?: number };
  rates?: { confirmedVisitRate?: number; reconciledRate?: number; settlementExceptionRate?: number };
  signals?: { code: string; count: number; advisory?: boolean }[];
};
type Trend = { date: string; visits: number; confirmedVisits: number; provisionalVisits: number };
type Provider = {
  providerCode: string;
  visits?: CountMap; settlements?: CountMap; reconciliations?: CountMap;
  rates?: { confirmedVisitRate?: number };
};
const visitStatus: Record<string, string> = {
  PENDING: 'Aguardando autorização', PROVISIONAL: 'Provisório', CONFIRMED: 'Confirmado',
  DENIED: 'Negado', FAILED: 'Falhou', EXPIRED: 'Expirado',
};
const attention: Record<string, string> = {
  REVALIDATION_REQUIRED: 'Revalidação necessária',
  AUTHORIZATION_PENDING: 'Autorização pendente',
  AUTHORIZATION_FAILED: 'Autorização negada ou falhou',
  AWAITING_PHYSICAL_ENTRY: 'Aguardando entrada física',
  RECONCILIATION_REQUIRED: 'Conciliação pendente',
};
const signalLabels: Record<string, string> = {
  UNRESOLVED_RISK_CASES: 'Ocorrências de risco em aberto',
  SETTLEMENT_EXCEPTIONS: 'Exceções de repasse',
  RECONCILIATION_GAPS: 'Pendências de conciliação',
  PROVISIONAL_VISITS: 'Visitas provisórias',
};
const providerLabel = (code?: string) => code === 'WELLHUB' ? 'Wellhub' : code === 'TOTALPASS' ? 'TotalPass' : code ?? 'Provedor não identificado';
const date = (v?: string) => { const d = new Date(v ?? ''); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); };
function total(map?: CountMap) { return Object.values(map ?? {}).reduce((sum, x) => sum + (Number.isFinite(x) ? x : 0), 0); }
function percent(n?: number) { return typeof n === 'number' ? `${Math.round(n * 100)}%` : '—'; }
function Button({ label, onPress, testID, disabled }: {
  label: string; onPress: () => void; testID?: string; disabled?: boolean;
}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <GlowCard style={styles.card}><Text style={styles.heading}>{title}</Text>{children}</GlowCard>;
}

export function AggregatorHubPanel({ canManage }: { canManage: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [queue, setQueue] = useState<QueueVisit[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [days, setDays] = useState(30);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api('/aggregator/operations/summary'),
      api('/aggregator/operations/reception-queue?limit=25'),
      ...(canManage ? [
        api('/aggregator/operations/risk-queue?limit=25'),
        api('/aggregator/operations/settlement-queue?limit=25'),
        api(`/aggregator/intelligence/overview?days=${days}`),
        api(`/aggregator/intelligence/providers?days=${days}`),
        api(`/aggregator/intelligence/trends?days=${days}`),
      ] : []),
    ]).then(([nextSummary, nextQueue, nextRisk, nextSettlement, nextOverview, nextProviders, nextTrends]) => {
      if (!mounted) return;
      setSummary(nextSummary ?? null);
      setQueue(Array.isArray(nextQueue?.items) ? nextQueue.items : []);
      setRisks(canManage && Array.isArray(nextRisk) ? nextRisk : []);
      setSettlements(canManage && Array.isArray(nextSettlement) ? nextSettlement : []);
      setOverview(canManage ? nextOverview ?? null : null);
      setProviders(canManage && Array.isArray(nextProviders?.items) ? nextProviders.items : []);
      setTrends(canManage && Array.isArray(nextTrends?.points) ? nextTrends.points : []);
      setError(''); setLoading(false);
    }).catch((e: unknown) => {
      if (mounted) { setError(e instanceof Error ? e.message : 'Falha ao carregar operações dos agregadores.'); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [canManage, days, revision]);

  function refresh() { setError(''); setLoading(true); setRevision((v) => v + 1); }

  return <View>
    <Card title="Aggregator Hub — operação da academia">
      <Text style={styles.muted}>Dados consultados no IRON para o tenant autenticado. Um adapter implementado não comprova integração externa homologada: o status de produção deve ser verificado no Integration Center.</Text>
      <View style={styles.actions}><Button testID="aggregator-refresh" label="Atualizar informações"
        disabled={loading} onPress={refresh} /></View>
      {loading ? <ActivityIndicator color="#2BF47A" /> : null}
      {error ? <Text testID="aggregator-error" style={styles.error}>{error}</Text> : null}
      {summary && !loading && !error ? <>
        <View style={styles.metrics}>
          <View style={styles.metricBox}><Text style={styles.metric}>{total(summary.visits)}</Text><Text style={styles.muted}>Visitas registradas</Text></View>
          <View style={styles.metricBox}><Text style={styles.metric}>{total(summary.connections)}</Text><Text style={styles.muted}>Conexões cadastradas</Text></View>
          <View style={styles.metricBox}><Text style={styles.metric}>{summary.unresolvedRiskCases ?? '—'}</Text><Text style={styles.muted}>Riscos pendentes</Text></View>
        </View>
        <Text style={styles.muted}>Dados gerados em: {date(summary.generatedAt)}</Text>
      </> : null}
    </Card>
    {!loading && !error ? <Card title="Fila de atendimento da recepção">
      {queue.length ? queue.map((v) => <View key={v.visitAuthorizationId} style={styles.entry}>
        <Text style={styles.label}>{providerLabel(v.providerCode)} · {visitStatus[v.visitStatus] ?? 'Estado registrado'}</Text>
        <Text style={styles.muted}>{attention[v.attentionCode] ?? 'Requer acompanhamento'} · {date(v.requestedAt)}</Text>
        <Text style={styles.muted}>Conexão: {v.providerConnectionStatus ?? 'Não informada'}</Text>
      </View>) : <Text style={styles.muted}>Sem atendimentos pendentes.</Text>}
    </Card> : null}
    {canManage && !loading && !error ? <>
      <Card title="Riscos e conciliação">
        <Text style={styles.muted}>Informações de risco para acompanhamento. Decisões críticas e acesso físico permanecem no backend.</Text>
        {risks.map((risk) => <View key={risk.id} style={styles.entry}>
          <Text style={styles.label}>{providerLabel(risk.connection?.providerCode)} · {risk.type ?? 'Ocorrência'}</Text>
          <Text style={styles.muted}>Situação: {risk.status === 'OPEN' ? 'Aberto' : risk.status === 'REVIEWING' ? 'Em análise' : 'Registrado'}</Text>
        </View>)}
        {!risks.length ? <Text style={styles.muted}>Sem riscos pendentes.</Text> : null}
      </Card>
      <Card title="Repasses e divergências">
        {settlements.map((row) => <View key={row.id} style={styles.entry}>
          <Text style={styles.label}>{providerLabel(row.connection?.providerCode)} · {row.status ?? 'Estado não informado'}</Text>
          <Text style={styles.muted}>Previsto: {row.amountExpected ?? '—'} · Confirmado: {row.amountConfirmed ?? '—'} · Moeda: {row.currency ?? '—'}</Text>
        </View>)}
        {!settlements.length ? <Text style={styles.muted}>Sem repasses pendentes.</Text> : null}
      </Card>
      <Card title="Intelligence operacional — leitura consultiva">
        <Text style={styles.muted}>Janela de análise (dias)</Text>
        <View style={styles.actions}>{[7, 30, 90].map((n) => <Button key={n} testID={`aggregator-days-${n}`}
          label={`${n} dias${days === n ? ' ✓' : ''}`} onPress={() => { setDays(n); setLoading(true); }} />)}</View>
        {overview?.totals ? <View style={styles.metrics}>
          <View style={styles.metricBox}><Text style={styles.metric}>{overview.totals.visits ?? '—'}</Text><Text style={styles.muted}>Visitas na janela</Text></View>
          <View style={styles.metricBox}><Text style={styles.metric}>{percent(overview.rates?.confirmedVisitRate)}</Text><Text style={styles.muted}>Visitas confirmadas</Text></View>
          <View style={styles.metricBox}><Text style={styles.metric}>{percent(overview.rates?.reconciledRate)}</Text><Text style={styles.muted}>Taxa de conciliação</Text></View>
        </View> : null}
        {(overview?.signals ?? []).map((signal) => <Text key={signal.code} style={styles.warning}>
          {signalLabels[signal.code] ?? 'Alerta operacional'}: {signal.count} — orientação consultiva
        </Text>)}
        <Text style={styles.label}>Atividade por provedor (não indica homologação)</Text>
        {providers.map((p) => <Text key={p.providerCode} style={styles.muted}>
          {providerLabel(p.providerCode)} · Visitas: {total(p.visits)} · Confirmadas: {percent(p.rates?.confirmedVisitRate)}
        </Text>)}
        <Text style={styles.label}>Tendências recentes</Text>
        {trends.slice(-7).map((t) => <Text key={t.date} style={styles.muted}>
          {date(t.date)} · {t.visits} visitas · {t.confirmedVisits} confirmadas · {t.provisionalVisits} provisórias
        </Text>)}
      </Card>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  label: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  warning: { color: '#fde68a', fontSize: 12 }, error: { color: '#fca5a5', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155', borderRadius: 9, padding: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#2BF47A', fontSize: 12, fontWeight: '700' }, disabled: { opacity: 0.4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricBox: { minWidth: 130, flex: 1, gap: 4 }, metric: { color: '#f8fafc', fontSize: 23, fontWeight: '800' },
  entry: { borderTopWidth: 1, borderTopColor: '#273248', paddingVertical: 9, gap: 4 },
});
