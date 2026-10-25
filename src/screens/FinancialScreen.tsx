import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';
import { brlFromMinor } from '../utils/academy-money';

type StudentCharge = {
  id: string;
  description?: string | null;
  amount?: number | null;
  value?: number | null;
  dueDate?: string | null;
  status?: string | null;
  paymentLink?: string | null;
  pixQrCode?: string | null;
};

function fmtDate(value?: string | null) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR');
}

function fmtMoney(value: unknown) {
  const result = brlFromMinor(value);
  return result === 'Valor não informado' ? 'Valor indisponível' : result;
}

function chargeStatusInfo(status?: string | null) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'PAID') return { label: 'Pago', color: '#2BF47A' };
  if (normalized === 'PENDING') return { label: 'Pendente', color: '#f59e0b' };
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') return { label: 'Cancelado', color: '#94a3b8' };
  if (normalized === 'OVERDUE') return { label: 'Vencido', color: '#ef4444' };
  return { label: 'Situação indisponível', color: '#94a3b8' };
}

export function FinancialScreen() {
  const [charges, setCharges] = useState<StudentCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  useEffect(() => {
    let active = true;
    api('/me/charges')
      .then((payload) => {
        if (!active) return;
        if (!Array.isArray(payload)) throw new Error('O servidor não retornou uma lista de cobranças válida.');
        setCharges(payload);
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) {
          // Preserve the previous state internally, but never render cached charges
          // as if they were current after a failed authorization or network read.
          setError(reason instanceof Error ? reason.message : 'Não foi possível consultar as cobranças.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadVersion]);

  const filtered = useMemo(() => charges.filter((charge) =>
    filter === 'ALL' || (filter === 'PENDING'
      ? charge.status === 'PENDING' || charge.status === 'OVERDUE'
      : charge.status === 'PAID')), [charges, filter]);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    setReloadVersion((current) => current + 1);
  }, []);

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="student-financial-screen">
    <View style={styles.header}>
      <View style={styles.headingBlock}>
        <Text style={styles.heading}>Meu Plano</Text>
        <Text style={styles.sub}>Cobranças e histórico da sua academia</Text>
      </View>
      <Ionicons name="wallet" size={24} color="#2BF47A" />
    </View>
    <View style={styles.toolbar}>
      <Text style={styles.sectionTitle}>Minhas cobranças</Text>
      <TouchableOpacity accessibilityRole="button" testID="student-charges-refresh"
        disabled={loading} style={[styles.refreshButton, loading && styles.disabled]} onPress={reload}>
        <Text style={styles.refreshText}>{loading ? 'Atualizando…' : 'Atualizar'}</Text>
      </TouchableOpacity>
    </View>
    {loading ? <View testID="student-charges-loading" style={styles.loading}>
      <ActivityIndicator size="large" color="#2BF47A" />
      <Text style={styles.sub}>Consultando suas cobranças…</Text>
    </View> : null}
    {error ? <View testID="student-charges-error" style={styles.errorCard}>
      <Text style={styles.errorTitle}>Não foi possível consultar suas cobranças</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" testID="student-charges-retry"
        style={styles.retryButton} onPress={reload}><Text style={styles.retryText}>Tentar novamente</Text></TouchableOpacity>
    </View> : null}
    {!loading && !error ? <>
      {charges.length ? <View style={styles.filters}>
        <TouchableOpacity testID="student-charges-filter-all" accessibilityRole="button"
          style={[styles.filter, filter === 'ALL' && styles.filterActive]} onPress={() => setFilter('ALL')}>
          <Text style={styles.filterText}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="student-charges-filter-pending" accessibilityRole="button"
          style={[styles.filter, filter === 'PENDING' && styles.filterActive]} onPress={() => setFilter('PENDING')}>
          <Text style={styles.filterText}>Pendentes</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="student-charges-filter-paid" accessibilityRole="button"
          style={[styles.filter, filter === 'PAID' && styles.filterActive]} onPress={() => setFilter('PAID')}>
          <Text style={styles.filterText}>Pagas</Text>
        </TouchableOpacity>
      </View> : null}
      {!filtered.length ? <EmptyState icon="card-outline" title="Nenhuma cobrança"
        subtitle={charges.length ? 'Não há cobranças com o filtro selecionado.' : 'Suas mensalidades aparecerão aqui quando forem registradas pela academia.'} />
      : filtered.map((charge, index) => {
        const status = chargeStatusInfo(charge.status);
        return <View key={charge.id || index} style={styles.card} testID={'student-charge-' + charge.id}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{charge.description || 'Mensalidade'}</Text>
            <Text style={styles.meta}>Vencimento: {fmtDate(charge.dueDate)}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amount}>{fmtMoney(charge.amount ?? charge.value)}</Text>
            <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>;
      })}
      <Text style={styles.disclaimer}>Informações financeiras fornecidas pela academia. A visualização não confirma um pagamento nem cria uma transação.</Text>
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0e1a' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headingBlock: { flex: 1 },
  heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 13, marginTop: 3 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  refreshButton: { backgroundColor: '#172a23', borderColor: '#285640', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  refreshText: { color: '#c7f5d6', fontWeight: '800', fontSize: 12 },
  loading: { marginVertical: 28, alignItems: 'center', gap: 10 },
  disabled: { opacity: 0.5 },
  errorCard: { backgroundColor: '#31191b', borderColor: '#7f2a35', borderWidth: 1, borderRadius: 12, padding: 16, gap: 9 },
  errorTitle: { color: '#fecaca', fontWeight: '800', fontSize: 15 },
  errorText: { color: '#fecaca', fontSize: 12 },
  retryButton: { backgroundColor: '#2BF47A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, alignSelf: 'flex-start' },
  retryText: { color: '#052012', fontWeight: '800', fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filter: { borderColor: '#34445b', backgroundColor: '#192333', borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  filterActive: { borderColor: '#2BF47A', backgroundColor: '#18372c' },
  filterText: { color: '#d9e8dd', fontWeight: '700', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2035', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#252d47' },
  cardContent: { flex: 1 },
  cardTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  amountBox: { alignItems: 'flex-end' },
  amount: { color: '#f1f5f9', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  status: { fontSize: 11, fontWeight: '700' },
  disclaimer: { color: '#8fa2b6', fontSize: 12, lineHeight: 18, marginTop: 10 },
});
