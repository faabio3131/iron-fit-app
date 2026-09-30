import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IronInput as TextInput } from './IronInput';
import { api } from '../services/api';

type Price = {
  id: string;
  priceCode: string;
  currency: string;
  amountMinor: number;
  interval: 'MONTHLY' | 'YEARLY';
  planVersion?: {
    version?: number;
    productPlan?: { code?: string; name?: string };
  };
};

type BillingPolicy = {
  invoiceDueDays?: number | null;
  dunningGraceDays?: number | null;
  gracePeriodEndsAt?: string | null;
};

type BillingState = {
  agreement?: any;
  invoices?: any[];
  billingPolicy?: BillingPolicy | null;
};

function requestId() {
  const runtimeCrypto = (globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  if (runtimeCrypto?.randomUUID) return runtimeCrypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatMoney(amountMinor: unknown, currency = 'BRL') {
  const minor = Number(amountMinor ?? 0);
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(Number.isFinite(minor) ? minor / 100 : 0);
  } catch {
    return `${currency} ${(Number.isFinite(minor) ? minor / 100 : 0).toFixed(2)}`;
  }
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

function toMinorUnits(value: string) {
  const raw = value.trim().replace(/^R\$\s*/i, '');
  if (!raw) return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

const billingStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativa',
  TRIALING: 'Em teste',
  PENDING_CHECKOUT: 'Aguardando pagamento',
  PAST_DUE: 'Em atraso',
  SUSPENDED: 'Suspensa',
  PAUSED: 'Pausada',
  CANCELED: 'Cancelada',
  OPEN: 'Em aberto',
  PENDING: 'Pendente',
  READY: 'Pronto para pagamento',
  PROCESSING: 'Processando',
  PAID: 'Paga',
  VOID: 'Cancelada',
  FAILED: 'Falhou',
  EXPIRED: 'Expirada',
  REFUNDED: 'Reembolsada',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
};

function billingStatus(value: unknown) {
  const key = typeof value === 'string' ? value : '';
  return billingStatusLabels[key] ?? (key || 'Não disponível');
}

function intervalLabel(value: unknown) {
  return value === 'YEARLY' ? 'Anual' : 'Mensal';
}

function planName(price: any) {
  return price?.planVersion?.productPlan?.name
    ?? price?.planVersion?.productPlan?.code
    ?? 'Plano IRON';
}

function invoiceRefunded(invoice: any) {
  return Array.isArray(invoice?.refunds)
    ? invoice.refunds
        .filter((refund: any) => refund?.status === 'SUCCEEDED')
        .reduce((sum: number, refund: any) => sum + Number(refund?.amountMinor ?? 0), 0)
    : 0;
}

export function SaasBillingPanel({
  onCommercialStateChanged,
  canAdministerBilling = false,
}: {
  onCommercialStateChanged?: () => Promise<void> | void;
  canAdministerBilling?: boolean;
}) {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastAction, setLastAction] = useState<any>(null);
  const [refundInvoiceId, setRefundInvoiceId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [current, available] = await Promise.all([
        api('/saas-billing/current'),
        api('/saas-billing/prices'),
      ]);
      setBilling(current ?? { agreement: null, invoices: [], billingPolicy: null });
      setPrices(Array.isArray(available) ? available : []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar a assinatura IRON.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const agreement = billing?.agreement ?? null;
  const currentPrice = agreement?.price ?? null;
  const billingPolicy = billing?.billingPolicy ?? null;
  const invoices = Array.isArray(billing?.invoices) ? billing!.invoices! : [];

  const sortedPrices = useMemo(
    () => [...prices].sort((a, b) => a.amountMinor - b.amountMinor),
    [prices],
  );

  const selectedRefundInvoice = useMemo(
    () => invoices.find((invoice: any) => invoice.id === refundInvoiceId) ?? null,
    [invoices, refundInvoiceId],
  );
  const refundAmountMinor = toMinorUnits(refundAmount);
  const refundableMinor = selectedRefundInvoice
    ? Math.max(
        0,
        Number(selectedRefundInvoice.amountPaidMinor ?? 0)
          - invoiceRefunded(selectedRefundInvoice),
      )
    : 0;

  async function execute(operation: () => Promise<any>, success: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      setLastAction(result);
      setNotice(success);
      await load();
      await onCommercialStateChanged?.();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.');
    } finally {
      setSaving(false);
    }
  }

  function actionFor(price: Price) {
    if (!agreement || !currentPrice || agreement.status === 'PENDING_CHECKOUT') {
      return {
        label: 'Iniciar pagamento',
        run: () =>
          api('/saas-billing/checkout', undefined, {
            method: 'POST',
            body: JSON.stringify({
              requestId: requestId(),
              priceCode: price.priceCode,
            }),
          }),
      };
    }

    if (currentPrice.id === price.id) return null;

    const transitionKind =
      price.amountMinor > Number(currentPrice.amountMinor ?? 0)
        ? 'UPGRADE'
        : 'DOWNGRADE';

    return {
      label: transitionKind === 'UPGRADE' ? 'Mudar para este plano' : 'Agendar este plano',
      run: () =>
        api('/saas-billing/change-plan', undefined, {
          method: 'POST',
          body: JSON.stringify({
            requestId: requestId(),
            priceCode: price.priceCode,
            transitionKind,
            reason: 'Alteração solicitada pelo painel Web IRON',
          }),
        }),
    };
  }

  function refundSelectedInvoice() {
    if (
      !selectedRefundInvoice
      || refundAmountMinor === null
      || refundAmountMinor <= 0
      || refundAmountMinor > refundableMinor
      || !refundReason.trim()
    ) {
      return;
    }
    void execute(
      () => api('/saas-billing/refunds', undefined, {
        method: 'POST',
        body: JSON.stringify({
          requestId: requestId(),
          invoiceId: selectedRefundInvoice.id,
          amountMinor: refundAmountMinor,
          reason: refundReason.trim(),
        }),
      }),
      'Solicitação de reembolso registrada.',
    ).then(() => {
      setRefundInvoiceId('');
      setRefundAmount('');
      setRefundReason('');
    });
  }

  return (
    <View testID="saas-billing-panel">
      <View style={styles.heroCard}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>BILLING IRON</Text>
          <Text style={styles.heroTitle}>Assinatura IRON</Text>
          <Text style={styles.muted}>
            Plano, cobrança e faturas da FM Tecnologia para sua academia. Este módulo é separado do financeiro dos alunos.
          </Text>
        </View>
        <View style={styles.heroStatus}>
          <Text style={styles.heroStatusLabel}>Situação</Text>
          <Text style={styles.heroStatusValue}>
            {agreement ? billingStatus(agreement.status) : 'Sem assinatura ativa'}
          </Text>
        </View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Carregando sua assinatura…</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Plano atual</Text>
          <Text style={styles.summaryValue}>{currentPrice ? planName(currentPrice) : '—'}</Text>
          <Text style={styles.summaryMeta}>
            {currentPrice
              ? `${formatMoney(currentPrice.amountMinor, currentPrice.currency)} · ${intervalLabel(currentPrice.interval)}`
              : 'Nenhum preço vigente'}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Próxima cobrança</Text>
          <Text style={styles.summaryValue}>{formatDate(agreement?.nextBillingAt)}</Text>
          <Text style={styles.summaryMeta}>
            {agreement?.cancelAtPeriodEnd ? 'Cancelamento agendado no fim do período' : 'Renovação conforme ciclo contratado'}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Faturas</Text>
          <Text style={styles.summaryValue}>{invoices.length}</Text>
          <Text style={styles.summaryMeta}>
            {invoices.filter((invoice: any) => ['OPEN', 'FAILED'].includes(invoice.status)).length} em aberto
          </Text>
        </View>
        <View style={[styles.summaryCard, ['PAST_DUE', 'SUSPENDED'].includes(agreement?.status) && styles.summaryAlert]}>
          <Text style={styles.summaryLabel}>Regularização</Text>
          <Text style={styles.summaryValue}>
            {billingPolicy?.gracePeriodEndsAt ? formatDate(billingPolicy.gracePeriodEndsAt) : 'Em dia'}
          </Text>
          <Text style={styles.summaryMeta}>
            {billingPolicy?.dunningGraceDays
              ? `Período de tolerância: ${billingPolicy.dunningGraceDays} dias`
              : 'Sem período de tolerância ativo'}
          </Text>
        </View>
      </View>

      {['PAST_DUE', 'SUSPENDED'].includes(agreement?.status) ? (
        <View style={styles.warningCard} testID="saas-billing-dunning-state">
          <Text style={styles.warningTitle}>
            {agreement.status === 'SUSPENDED' ? 'Assinatura suspensa por inadimplência' : 'Pagamento em atraso'}
          </Text>
          <Text style={styles.warningText}>
            {billingPolicy?.gracePeriodEndsAt
              ? `A política comercial vigente prevê regularização até ${formatDate(billingPolicy.gracePeriodEndsAt)}.`
              : 'Consulte as faturas em aberto para regularizar a assinatura.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.title}>Planos disponíveis</Text>
            <Text style={styles.muted}>Valores e ciclos publicados pelo servidor comercial do IRON.</Text>
          </View>
        </View>
        {sortedPrices.length === 0 && !loading ? (
          <Text style={styles.empty}>Nenhum plano comercial publicado.</Text>
        ) : null}
        <ScrollView horizontal contentContainerStyle={styles.planRow}>
          {sortedPrices.map((price) => {
            const action = actionFor(price);
            const current = currentPrice?.id === price.id;
            return (
              <View key={price.id} style={[styles.planCard, current && styles.planCardCurrent]}>
                <Text style={styles.planName}>{planName(price)}</Text>
                <Text style={styles.planPrice}>{formatMoney(price.amountMinor, price.currency)}</Text>
                <Text style={styles.planCycle}>{intervalLabel(price.interval)}</Text>
                {current ? <Text style={styles.currentBadge}>Plano atual</Text> : null}
                {action ? (
                  <TouchableOpacity
                    testID={`saas-billing-action-${price.priceCode}`}
                    style={[styles.button, saving && styles.disabled]}
                    disabled={saving}
                    onPress={() => void execute(action.run, 'Operação comercial registrada.')}
                  >
                    <Text style={styles.buttonText}>{action.label}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {agreement && agreement.status !== 'CANCELED' && !agreement.cancelAtPeriodEnd ? (
          <TouchableOpacity
            testID="saas-billing-cancel-period-end"
            style={[styles.secondaryButton, saving && styles.disabled]}
            disabled={saving}
            onPress={() =>
              void execute(
                () =>
                  api('/saas-billing/cancel', undefined, {
                    method: 'POST',
                    body: JSON.stringify({ atPeriodEnd: true }),
                  }),
                'Cancelamento agendado para o fim do período.',
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Cancelar no fim do período</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Faturas</Text>
        <Text style={styles.muted}>Histórico de cobranças da assinatura IRON.</Text>
        {invoices.length === 0 ? (
          <Text style={styles.empty}>Nenhuma fatura emitida.</Text>
        ) : (
          invoices.map((invoice: any) => {
            const refunded = invoiceRefunded(invoice);
            const paid = Number(invoice.amountPaidMinor ?? 0);
            const refundable = Math.max(0, paid - refunded);
            return (
              <View key={invoice.id} style={styles.invoice}>
                <View style={styles.invoiceMain}>
                  <Text style={styles.rowTitle}>{billingStatus(invoice.status)}</Text>
                  <Text style={styles.muted}>
                    Período {formatDate(invoice.periodStart)} a {formatDate(invoice.periodEnd)} · vencimento {formatDate(invoice.dueAt)}
                  </Text>
                  <Text style={styles.muted}>
                    Pago {formatMoney(paid, invoice.currency ?? 'BRL')}
                    {refunded > 0 ? ` · reembolsado ${formatMoney(refunded, invoice.currency ?? 'BRL')}` : ''}
                  </Text>
                </View>
                <View style={styles.invoiceAmount}>
                  <Text style={styles.rowTitle}>{formatMoney(invoice.amountDueMinor, invoice.currency ?? 'BRL')}</Text>
                  {canAdministerBilling && refundable > 0 ? (
                    <TouchableOpacity
                      testID={`saas-billing-refund-${invoice.id}`}
                      accessibilityRole="button"
                      style={styles.inlineButton}
                      onPress={() => {
                        setRefundInvoiceId(invoice.id);
                        setRefundAmount((refundable / 100).toFixed(2).replace('.', ','));
                        setRefundReason('');
                      }}
                    >
                      <Text style={styles.inlineButtonText}>Reembolsar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>

      {canAdministerBilling && selectedRefundInvoice ? (
        <View style={styles.card} testID="saas-billing-refund-panel">
          <Text style={styles.title}>Reembolso administrativo</Text>
          <Text style={styles.muted}>
            Ação restrita a SUPER_ADMIN. Limite disponível: {formatMoney(refundableMinor, selectedRefundInvoice.currency ?? 'BRL')}.
          </Text>
          <Text style={styles.fieldLabel}>Valor do reembolso (R$)</Text>
          <TextInput
            accessibilityLabel="Valor do reembolso"
            style={styles.input}
            value={refundAmount}
            onChangeText={setRefundAmount}
            keyboardType="numeric"
            placeholder="0,00"
            placeholderTextColor="#71879e"
          />
          <Text style={styles.fieldLabel}>Motivo</Text>
          <TextInput
            accessibilityLabel="Motivo do reembolso"
            style={styles.input}
            value={refundReason}
            onChangeText={setRefundReason}
            placeholder="Descreva o motivo"
            placeholderTextColor="#71879e"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              testID="saas-billing-confirm-refund"
              accessibilityRole="button"
              disabled={
                saving
                || refundAmountMinor === null
                || refundAmountMinor <= 0
                || refundAmountMinor > refundableMinor
                || !refundReason.trim()
              }
              style={[
                styles.button,
                (
                  saving
                  || refundAmountMinor === null
                  || refundAmountMinor <= 0
                  || refundAmountMinor > refundableMinor
                  || !refundReason.trim()
                ) && styles.disabled,
              ]}
              onPress={refundSelectedInvoice}
            >
              <Text style={styles.buttonText}>{saving ? 'Processando…' : 'Confirmar reembolso'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => {
                setRefundInvoiceId('');
                setRefundAmount('');
                setRefundReason('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {lastAction ? (
        <View style={styles.card}>
          <Text style={styles.title}>Última operação</Text>
          <Text style={styles.muted}>A alteração foi registrada e o estado comercial foi atualizado.</Text>
          {typeof lastAction?.checkoutUrl === 'string' && lastAction.checkoutUrl ? (
            <TouchableOpacity
              testID="saas-billing-open-checkout"
              style={styles.button}
              onPress={() => void Linking.openURL(lastAction.checkoutUrl)}
            >
              <Text style={styles.buttonText}>Abrir pagamento seguro</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 15, marginBottom: 9 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  heroTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 4 },
  heroStatus: { minWidth: 150, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  heroStatusLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  heroStatusValue: { color: '#eef7ff', fontSize: 14, fontWeight: '900', marginTop: 4 },
  loading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 10, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 10, borderRadius: 9, marginBottom: 8 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  summaryCard: { flexGrow: 1, flexBasis: 210, minWidth: 180, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  summaryAlert: { borderColor: '#7f2d3a', backgroundColor: '#1a1018' },
  summaryLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { color: '#eef7ff', fontSize: 17, fontWeight: '900', marginTop: 4 },
  summaryMeta: { color: '#9aadc1', fontSize: 9, lineHeight: 13, marginTop: 3 },
  warningCard: { backgroundColor: '#1a1018', borderWidth: 1, borderColor: '#7f2d3a', borderRadius: 12, padding: 11, marginBottom: 9 },
  warningTitle: { color: '#fecaca', fontSize: 12, fontWeight: '900' },
  warningText: { color: '#d8b4b8', fontSize: 10, lineHeight: 15, marginTop: 3 },
  card: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 9 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 3 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 10 },
  planRow: { flexDirection: 'row', gap: 8, paddingTop: 8, paddingBottom: 4 },
  planCard: { width: 220, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  planCardCurrent: { borderColor: '#2f91ff', backgroundColor: '#071a31' },
  planName: { color: '#eef7ff', fontSize: 13, fontWeight: '900' },
  planPrice: { color: '#eef7ff', fontSize: 19, fontWeight: '900', marginTop: 8 },
  planCycle: { color: '#9aadc1', fontSize: 10, marginTop: 2 },
  currentBadge: { alignSelf: 'flex-start', color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800', marginTop: 8 },
  invoice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#17263a', paddingVertical: 9 },
  invoiceMain: { flex: 1, minWidth: 0 },
  invoiceAmount: { alignItems: 'flex-end', gap: 6 },
  rowTitle: { color: '#eef7ff', fontSize: 12, fontWeight: '900' },
  button: { alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 },
  secondaryButton: { alignSelf: 'flex-start', backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 },
  buttonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  secondaryButtonText: { color: '#dce9f6', fontSize: 11, fontWeight: '900' },
  inlineButton: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2f91ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  inlineButtonText: { color: '#bfdbfe', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  fieldLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  input: { color: '#eef6ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
