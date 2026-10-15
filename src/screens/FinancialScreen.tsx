import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../components/EmptyState';
import { RequestErrorState } from '../components/RequestErrorState';
import { api } from '../services/api';

function fmtDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

function fmtMoney(value?: unknown) {
  const minor = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number.isFinite(minor) ? minor : 0) / 100);
}

function safePaymentUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^https:\/\/[^\s]+$/i.test(url) ? url : null;
}

function chargeStatusInfo(status?: string) {
  const normalized = (status || '').toUpperCase();
  if (normalized.includes('PAID') || normalized.includes('PAGO')) return { label: 'Pago', color: '#67d6ff' };
  if (normalized.includes('OVER') || normalized.includes('ATRAS')) return { label: 'Atrasado', color: '#ef4444' };
  if (normalized.includes('PEND') || normalized.includes('OPEN')) return { label: 'Pendente', color: '#93c5fd' };
  return { label: status || '—', color: '#9fb0c5' };
}

export function FinancialScreen() {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadCharges = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('/me/charges');
      setCharges(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Não foi possível carregar suas cobranças. Sem conexão ou serviço indisponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadCharges(); }, 0);
    return () => clearTimeout(timer);
  }, [loadCharges]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.heading}>Meu Plano</Text><Text style={styles.sub}>Mensalidades e pagamentos 💳</Text></View><Ionicons name="wallet" size={24} color="#2f91ff" /></View>
      <Text style={styles.sectionTitle}>Cobranças</Text>
      {loading ? <ActivityIndicator size="large" color="#2f91ff" style={styles.loading} /> : loadError ? (
        <RequestErrorState message={loadError} onRetry={() => { void loadCharges(); }} />
      ) : charges.length === 0 ? (
        <EmptyState icon="card-outline" title="Nenhuma cobrança" subtitle="Suas mensalidades aparecem aqui." />
      ) : charges.map((charge, index) => {
        const status = chargeStatusInfo(charge.status);
        const checkoutUrl = safePaymentUrl(charge.paymentLink);
        return (
          <View key={charge.id || index} style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{charge.description || 'Mensalidade'}</Text>
              <Text style={styles.meta}>Vencimento: {fmtDate(charge.dueDate) || '—'}</Text>
              {charge.paymentMethod ? <Text style={styles.meta}>Forma: {String(charge.paymentMethod)}</Text> : null}
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amount}>{fmtMoney(charge.amount ?? charge.value)}</Text>
              <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
              {checkoutUrl && charge.status !== 'PAID' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  testID={`student-charge-payment-${charge.id || index}`}
                  style={styles.payButton}
                  onPress={() => { void Linking.openURL(checkoutUrl); }}
                >
                  <Text style={styles.payButtonText}>Abrir pagamento</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#030811' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#eef7ff', fontSize: 24, fontWeight: '800' }, sub: { color: '#9fb0c5', fontSize: 14, marginTop: 2 }, sectionTitle: { color: '#eef7ff', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#071528', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#203b55', gap: 12 }, cardContent: { flex: 1 }, cardTitle: { color: '#eef7ff', fontSize: 15, fontWeight: '700' }, meta: { color: '#9fb0c5', fontSize: 12, marginTop: 2 }, amountBox: { alignItems: 'flex-end' }, amount: { color: '#eef7ff', fontSize: 16, fontWeight: '800', marginBottom: 6 }, status: { fontSize: 11, fontWeight: '700' },
  payButton: { marginTop: 9, backgroundColor: '#176bc1', borderWidth: 1, borderColor: '#2f91ff', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  payButtonText: { color: '#eef7ff', fontSize: 10, fontWeight: '800' },
});
