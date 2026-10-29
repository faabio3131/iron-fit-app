import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type BillingAuthority = {
  billingAuthority: string;
  productCode: string;
  localMutationsEnabled: boolean;
  providerWebhooksAccepted: boolean;
  mode: string;
};
type LegacyPrice = { priceCode?: string; currency?: string; amountMinor?: number;
  planVersion?: { productPlan?: { name?: string } } };
type LegacyAgreement = { status?: string; nextBillingAt?: string | null; price?: LegacyPrice | null };
type Invoice = {
  id: string; status?: string; amountDueMinor?: number | null; amountPaidMinor?: number | null;
  currency?: string | null; dueAt?: string | null;
};
type BillingState = {
  agreement?: LegacyAgreement | null;
  invoices?: Invoice[];
  projection?: string;
  authority?: BillingAuthority;
};

const statuses: Record<string, string> = {
  ACTIVE: 'Ativa', TRIALING: 'Em avaliação', PENDING_CHECKOUT: 'Aguardando contratação',
  PAST_DUE: 'Pagamento em atraso', SUSPENDED: 'Suspensa', CANCELED: 'Cancelada',
  CANCELLED: 'Cancelada', PAID: 'Paga', PENDING: 'Pendente', OVERDUE: 'Vencida',
  OPEN: 'Aberta', FAILED: 'Falhou', VOID: 'Anulada', DRAFT: 'Rascunho',
  GRACE: 'Em período de tolerância', UNPAID: 'Não paga',
};
function statusLabel(value?: string) {
  return value ? statuses[value] ?? 'Estado não identificado' : 'Não informado';
}
function readableDate(value?: string | null) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  // Billing read-model dates use the canonical UTC calendar day, including ISO midnight.
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function money(amountMinor?: number | null, currency?: string | null) {
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) ||
    !currency || !/^[A-Z]{3}$/.test(currency)) return 'Não informado';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountMinor / 100);
  } catch { return 'Não informado'; }
}

export function SaasBillingPanel({ onCommercialStateChanged }: {
  onCommercialStateChanged?: () => Promise<void> | void;
}) {
  const [authority, setAuthority] = useState<BillingAuthority | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [authorityResponse, current] = await Promise.all([
        api('/saas-billing/authority'),
        api('/saas-billing/current'),
      ]);
      if (
        authorityResponse?.billingAuthority !== 'FM_COMMAND' ||
        authorityResponse?.productCode !== 'IRON_FIT_CORE' ||
        authorityResponse?.localMutationsEnabled !== false ||
        authorityResponse?.providerWebhooksAccepted !== false ||
        authorityResponse?.mode !== 'COMMAND_CENTRALIZED' ||
        current?.authority?.billingAuthority !== 'FM_COMMAND' ||
        current?.authority?.localMutationsEnabled !== false ||
        current?.authority?.providerWebhooksAccepted !== false
      ) {
        throw new Error('Autoridade de cobrança não confirmada. Operações comerciais permanecem bloqueadas.');
      }
      setAuthority(authorityResponse);
      setBilling(current);
    } catch (reason) {
      setAuthority(null); setBilling(null);
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a assinatura.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function refresh() {
    setNotice('');
    await load();
    try {
      await onCommercialStateChanged?.();
    } catch {
      setNotice('A consulta de assinatura foi solicitada, mas o estado comercial geral não pôde ser atualizado.');
    }
  }

  const agreement = billing?.agreement ?? null;
  const invoices = Array.isArray(billing?.invoices) ? billing!.invoices! : [];
  const legacy = billing?.projection === 'LEGACY_READ_ONLY';

  return <View testID="saas-billing-panel">
    <GlowCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Assinatura IRON</Text>
          <Text style={styles.muted}>Administração comercial centralizada pela FM Tecnologia no FM Command.</Text>
        </View>
        <TouchableOpacity testID="saas-billing-refresh" accessibilityRole="button" style={[styles.button, loading && styles.disabled]}
          disabled={loading} onPress={() => { void refresh(); }}>
          <Text style={styles.buttonText}>Atualizar situação</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color="#2BF47A" /> : null}
      {error ? <Text testID="saas-billing-authority-error" style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.warning}>{notice}</Text> : null}
      {authority ? <View testID="saas-billing-command-authority" style={styles.authority}>
        <Text style={styles.authorityTitle}>Cobrança SaaS sob autoridade do FM Command</Text>
        <Text style={styles.muted}>Planos, checkout, cobrança, pagamento, renovação, mudança e cancelamento não podem ser executados pelo antigo billing local. A licença e os acessos são definidos pelas operações corporativas governadas.</Text>
        <Text style={styles.warning}>Esta tela é de consulta, não de contratação. Nenhum pagamento é confirmado aqui.</Text>
      </View> : null}
    </GlowCard>

    {authority && !loading ? <>
      <GlowCard style={styles.card}>
        <Text style={styles.title}>Situação conhecida no IRON</Text>
        <Text style={styles.muted}>{legacy
          ? 'Histórico local de leitura, não uma posição financeira homologada do FM Command.'
          : 'Projeção disponibilizada pelo backend do IRON. Confirme cobranças e pagamentos no sistema corporativo.'}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Registro local</Text>
          <Text testID="saas-billing-state" style={styles.statusValue}>{agreement ? statusLabel(agreement.status) : 'Não registrado'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Plano registrado</Text>
          <Text style={styles.statusValue}>{agreement?.price?.planVersion?.productPlan?.name ?? 'Não informado'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Próxima data registrada</Text>
          <Text style={styles.statusValue}>{readableDate(agreement?.nextBillingAt)}</Text>
        </View>
      </GlowCard>
      <GlowCard style={styles.card}>
        <Text style={styles.title}>Histórico de faturas do IRON</Text>
        <Text style={styles.muted}>Registros do módulo anterior, disponibilizados somente para consulta. Eles não substituem as faturas e liquidações do FM Command.</Text>
        {invoices.length ? invoices.slice(0, 24).map((invoice) => <View key={invoice.id} style={styles.invoice}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>{statusLabel(invoice.status)}</Text>
            <Text style={styles.invoiceTitle}>{money(invoice.amountDueMinor, invoice.currency)}</Text>
          </View>
          <Text style={styles.muted}>Vencimento: {readableDate(invoice.dueAt)} · Valor pago registrado: {money(invoice.amountPaidMinor, invoice.currency)}</Text>
        </View>) : <Text style={styles.muted}>Nenhuma fatura histórica registrada neste ambiente.</Text>}
      </GlowCard>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  heading: { flexGrow: 1, flexBasis: 190, gap: 4 },
  title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  muted: { color: '#afbed0', fontSize: 12, lineHeight: 18 },
  warning: { color: '#f3c18b', fontSize: 12, lineHeight: 18 },
  error: { color: '#fca5a5', fontSize: 12 },
  authority: { backgroundColor: '#0e2921', borderRadius: 10, borderWidth: 1, borderColor: '#215e44', padding: 12, gap: 8 },
  authorityTitle: { color: '#d8ffe5', fontWeight: '800', fontSize: 13 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2BF47A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9 },
  buttonText: { color: '#04140b', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.45 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#29384c', paddingVertical: 10 },
  statusLabel: { color: '#a8b9cc', fontSize: 12 },
  statusValue: { color: '#f0f7fa', fontWeight: '800', fontSize: 12, textAlign: 'right', flexShrink: 1 },
  invoice: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#29384c', gap: 6 },
  invoiceHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  invoiceTitle: { color: '#eff7fa', fontWeight: '700', fontSize: 13 },
});
