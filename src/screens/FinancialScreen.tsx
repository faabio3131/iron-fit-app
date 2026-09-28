import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../components/EmptyState';
import { api } from '../services/api';

function fmtDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

function fmtMoney(value?: unknown) {
  const number = Number(value ?? 0);
  return `R$ ${number.toFixed(2).replace('.', ',')}`;
}

function chargeStatusInfo(status?: string) {
  const normalized = (status || '').toUpperCase();
  if (normalized.includes('PAID') || normalized.includes('PAGO')) return { label: 'Pago', color: '#10b981' };
  if (normalized.includes('OVER') || normalized.includes('ATRAS')) return { label: 'Atrasado', color: '#ef4444' };
  if (normalized.includes('PEND') || normalized.includes('OPEN')) return { label: 'Pendente', color: '#f59e0b' };
  return { label: status || '—', color: '#94a3b8' };
}

export function FinancialScreen() {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api('/me/charges')
      .then((data) => { if (active) setCharges(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setCharges([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.heading}>Meu Plano</Text><Text style={styles.sub}>Mensalidades e pagamentos 💳</Text></View><Ionicons name="wallet" size={24} color="#10b981" /></View>
      <Text style={styles.sectionTitle}>Cobranças</Text>
      {loading ? <ActivityIndicator size="large" color="#2583e8" style={styles.loading} /> : charges.length === 0 ? (
        <EmptyState icon="card-outline" title="Nenhuma cobrança" subtitle="Suas mensalidades aparecem aqui." />
      ) : charges.map((charge, index) => {
        const status = chargeStatusInfo(charge.status);
        return (
          <View key={charge.id || index} style={styles.card}>
            <View style={styles.cardContent}><Text style={styles.cardTitle}>{charge.description || 'Mensalidade'}</Text><Text style={styles.meta}>Vencimento: {fmtDate(charge.dueDate) || '—'}</Text></View>
            <View style={styles.amountBox}><Text style={styles.amount}>{fmtMoney(charge.amount ?? charge.value)}</Text><Text style={[styles.status, { color: status.color }]}>{status.label}</Text></View>
          </View>
        );
      })}
      <View style={styles.pix}><Ionicons name="flash" size={20} color="#f59e0b" /><Text style={styles.pixText}>Pagamento via PIX chegando em breve ⚡</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#05080f' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' }, sub: { color: '#94a3b8', fontSize: 14, marginTop: 2 }, sectionTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0b111d', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1d2939' }, cardContent: { flex: 1 }, cardTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' }, meta: { color: '#94a3b8', fontSize: 12, marginTop: 2 }, amountBox: { alignItems: 'flex-end' }, amount: { color: '#f1f5f9', fontSize: 16, fontWeight: '800', marginBottom: 6 }, status: { fontSize: 11, fontWeight: '700' },
  pix: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f59e0b15', borderWidth: 1, borderColor: '#f59e0b40', borderRadius: 12, padding: 12, marginTop: 8, gap: 8 }, pixText: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
});
