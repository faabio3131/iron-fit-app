import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

type BillingState = {
  agreement?: any;
  invoices?: any[];
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

function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function SaasBillingPanel({
  onCommercialStateChanged,
}: {
  onCommercialStateChanged?: () => Promise<void> | void;
}) {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastAction, setLastAction] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [current, available] = await Promise.all([
        api('/saas-billing/current'),
        api('/saas-billing/prices'),
      ]);
      setBilling(current ?? { agreement: null, invoices: [] });
      setPrices(Array.isArray(available) ? available : []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar billing SaaS.');
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
  const invoices = Array.isArray(billing?.invoices) ? billing!.invoices! : [];

  const sortedPrices = useMemo(
    () => [...prices].sort((a, b) => a.amountMinor - b.amountMinor),
    [prices],
  );

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
        label: 'Iniciar checkout',
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
      label: transitionKind === 'UPGRADE' ? 'Solicitar upgrade' : 'Agendar downgrade',
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

  return (
    <View testID="saas-billing-panel">
      <View style={styles.card}>
        <Text style={styles.title}>Assinatura IRON</Text>
        <Text style={styles.muted}>
          Preços, estado financeiro e entitlement são autoridade do backend. O painel não calcula
          cobrança, proration ou acesso localmente.
        </Text>
        {loading ? <ActivityIndicator color="#8b5cf6" style={styles.loading} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{agreement?.status ?? 'SEM BILLING ATIVO'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Plano/preço atual</Text>
          <Text style={styles.statusValue}>
            {currentPrice?.priceCode ?? '—'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Próxima cobrança</Text>
          <Text style={styles.statusValue}>
            {String(agreement?.nextBillingAt ?? '—')}
          </Text>
        </View>

        {agreement && agreement.status !== 'CANCELED' ? (
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
            <Text style={styles.buttonText}>Cancelar no fim do período</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Planos disponíveis</Text>
        {sortedPrices.length === 0 && !loading ? (
          <Text style={styles.muted}>Nenhum preço comercial publicado.</Text>
        ) : null}
        {sortedPrices.map((price) => {
          const action = actionFor(price);
          return (
            <View key={price.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {price.planVersion?.productPlan?.name ??
                    price.planVersion?.productPlan?.code ??
                    price.priceCode}
                </Text>
                <Text style={styles.muted}>
                  {price.priceCode} · {formatMoney(price.amountMinor, price.currency)} ·{' '}
                  {price.interval === 'MONTHLY' ? 'mensal' : 'anual'}
                </Text>
              </View>
              {action ? (
                <TouchableOpacity
                  testID={`saas-billing-action-${price.priceCode}`}
                  style={[styles.button, saving && styles.disabled]}
                  disabled={saving}
                  onPress={() => void execute(action.run, 'Operação comercial registrada.')}
                >
                  <Text style={styles.buttonText}>{action.label}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.current}>Atual</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Invoices recentes</Text>
        {invoices.length === 0 ? (
          <Text style={styles.muted}>Nenhum invoice emitido.</Text>
        ) : (
          invoices.map((invoice: any) => (
            <View key={invoice.id} style={styles.invoice}>
              <Text style={styles.rowTitle}>
                {invoice.status} · {formatMoney(Number(invoice.amountDueMinor ?? 0), invoice.currency ?? 'BRL')}
              </Text>
              <Text style={styles.muted}>
                Vencimento: {String(invoice.dueAt ?? '—')} · Pago: {String(invoice.amountPaidMinor ?? 0)}
              </Text>
            </View>
          ))
        )}
      </View>

      {lastAction ? (
        <View style={styles.card}>
          <Text style={styles.title}>Última operação</Text>
          <Text selectable style={styles.json}>
            {JSON.stringify(lastAction, null, 2)}
          </Text>
          {typeof lastAction?.checkoutUrl === 'string' && lastAction.checkoutUrl ? (
            <TouchableOpacity
              testID="saas-billing-open-checkout"
              style={styles.button}
              onPress={() => void Linking.openURL(lastAction.checkoutUrl)}
            >
              <Text style={styles.buttonText}>Abrir checkout seguro</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#273248',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: '#f8fafc', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  loading: { marginVertical: 12 },
  error: {
    color: '#fca5a5',
    backgroundColor: '#301215',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  notice: {
    color: '#86efac',
    backgroundColor: '#12301f',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#202a3e',
    paddingVertical: 9,
  },
  statusLabel: { color: '#94a3b8', fontSize: 12 },
  statusValue: { color: '#f1f5f9', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#202a3e',
    paddingVertical: 12,
  },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  invoice: {
    borderTopWidth: 1,
    borderTopColor: '#202a3e',
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  current: { color: '#86efac', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  json: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
});
