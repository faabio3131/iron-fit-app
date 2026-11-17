import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';
import { colors } from '../theme/colors';

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
type CommercialOffer = {
  planCode: string; name: string; interval: 'monthly' | 'yearly';
  amountMinor: number; currency: 'BRL';
};
export function commercialOffersErrorMessage(reason: unknown): string {
  const status = (reason as { status?: unknown } | null)?.status;
  if (status === 401) return 'Sua sessão não está válida. Entre novamente para consultar os planos.';
  if (status === 403) return 'É necessário acesso de proprietário e reautenticação para consultar as ofertas.';
  if (status === 404) return 'O catálogo comercial não está disponível nesta versão do servidor.';
  if (status === 503 || (typeof status === 'number' && status >= 500))
    return 'O serviço de planos está temporariamente indisponível. Atualize a situação ou tente mais tarde.';
  if (reason instanceof Error && reason.message === 'INVALID_COMMERCIAL_CATALOG')
    return 'O serviço comercial retornou um catálogo inválido. A contratação permanece bloqueada.';
  return 'Não foi possível consultar os planos. Atualize a situação ou tente novamente.';
}
function validOffer(value: unknown): value is CommercialOffer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return typeof p.planCode === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(p.planCode) &&
    typeof p.name === 'string' && p.name.length >= 2 && p.name.length <= 120 &&
    (p.interval === 'monthly' || p.interval === 'yearly') &&
    typeof p.amountMinor === 'number' && Number.isSafeInteger(p.amountMinor) &&
    p.amountMinor > 0 && p.currency === 'BRL';
}
export function validCaktoCheckout(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'pay.cakto.com.br' &&
      !url.username && !url.password && !url.hash &&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(url.searchParams.get('sck') ?? '');
  } catch { return false; }
}
type CanonicalBillingReadback = {
  source: 'FM_COMMAND_CANONICAL';
  authority: 'FM_COMMAND';
  checkedAt: string;
  subscription: null | {
    planCode: string;
    planName: string | null;
    interval: 'monthly' | 'yearly' | null;
    status: string;
    paidThrough: string | null;
  };
  invoices: Array<{
    status: string;
    amountMinor: number;
    currency: 'BRL';
    periodEnd: string | null;
  }>;
  settlementConfirmedByThisView: false;
};
function validCanonicalBilling(value: unknown): value is CanonicalBillingReadback {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (data.source !== 'FM_COMMAND_CANONICAL' || data.authority !== 'FM_COMMAND' ||
      data.settlementConfirmedByThisView !== false || typeof data.checkedAt !== 'string' ||
      !Array.isArray(data.invoices) || data.invoices.length > 24) return false;
  if (data.subscription !== null) {
    if (!data.subscription || typeof data.subscription !== 'object' ||
        Array.isArray(data.subscription)) return false;
    const record = data.subscription as Record<string, unknown>;
    if (typeof record.status !== 'string' || record.status.length > 40 ||
        (record.planName !== null && typeof record.planName !== 'string') ||
        (record.interval !== null && !['monthly', 'yearly'].includes(String(record.interval))) ||
        (record.paidThrough !== null && typeof record.paidThrough !== 'string')) return false;
  }
  return data.invoices.every((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.status === 'string' && typeof row.amountMinor === 'number' &&
      Number.isSafeInteger(row.amountMinor) && row.amountMinor > 0 &&
      row.currency === 'BRL' && (row.periodEnd === null || typeof row.periodEnd === 'string');
  });
}
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

export function SaasBillingPanel({ onCommercialStateChanged, canPurchase = false }: {
  onCommercialStateChanged?: () => Promise<void> | void;
  canPurchase?: boolean;
}) {
  const [authority, setAuthority] = useState<BillingAuthority | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [canonical, setCanonical] = useState<CanonicalBillingReadback | null>(null);
  const [canonicalError, setCanonicalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offers, setOffers] = useState<CommercialOffer[]>([]);
  const [offersError, setOffersError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
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
      try {
        const official: unknown = await api('/commercial/billing/current');
        if (!validCanonicalBilling(official)) throw new Error('INVALID_COMMAND_READBACK');
        setCanonical(official);
        setCanonicalError('');
      } catch (reason) {
        setCanonical(null);
        const status = (reason as { status?: number } | null)?.status;
        setCanonicalError(status === 403
          ? 'Revalide o acesso administrativo para consultar sua assinatura atual.'
          : 'A posição comercial oficial não pôde ser consultada no FM Command. Os registros antigos abaixo não representam sua assinatura atual.');
      }
      if (canPurchase) {
        try {
          const result = await api('/commercial/billing/offers');
          const rows: unknown = result?.plans;
          if (!Array.isArray(rows) || rows.length > 30 || !rows.every(validOffer))
            throw new Error('INVALID_COMMERCIAL_CATALOG');
          setOffers(rows);
          setOffersError(rows.length ? '' : 'Nenhuma oferta comercial está habilitada para contratação nesta academia.');
        } catch (reason) {
          setOffers([]);
          setOffersError(commercialOffersErrorMessage(reason));
        }
      } else {
        setOffers([]); setOffersError('');
      }
    } catch (reason) {
      setAuthority(null); setBilling(null); setCanonical(null); setCanonicalError('');
      setOffers([]); setOffersError('');
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a assinatura.');
    } finally { setLoading(false); }
  }, [canPurchase]);
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

  async function beginCheckout(offer: CommercialOffer) {
    if (!canPurchase || checkoutLoading || !validOffer(offer)) return;
    setCheckoutLoading(true);
    setNotice('');
    setError('');
    try {
      // Generate an opaque idempotency key once per attempt, never send a price from UI.
      const requestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
      const result = await api('/commercial/billing/checkout', undefined, {
        method: 'POST', body: JSON.stringify({ planCode: offer.planCode, requestId }),
      });
      if (result?.provider !== 'CAKTO' || result?.productCode !== 'IRON_FIT_CORE' ||
        result?.pendingConfirmation !== true || !validCaktoCheckout(result?.checkoutUrl)) {
        throw new Error('A autoridade comercial não confirmou um checkout válido.');
      }
      await Linking.openURL(result.checkoutUrl);
      setCheckoutPending(true);
      setNotice('Checkout aberto na Cakto. O pagamento não libera acesso aqui: aguarde o webhook e atualize a situação.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o checkout.');
    } finally { setCheckoutLoading(false); }
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
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text testID="saas-billing-authority-error" style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.warning}>{notice}</Text> : null}
      {authority ? <View testID="saas-billing-command-authority" style={styles.authority}>
        <Text style={styles.authorityTitle}>Cobrança SaaS sob autoridade do FM Command</Text>
        <Text style={styles.muted}>Planos, checkout, cobrança, pagamento, renovação, mudança e cancelamento não podem ser executados pelo sistema antigo de cobranças. A licença e os acessos são definidos pelas operações corporativas governadas.</Text>
        <Text style={styles.warning}>A confirmação do pagamento ocorre exclusivamente pela Cakto e pelo FM Command; retornar do checkout não ativa a licença.</Text>
      </View> : null}
    </GlowCard>

    {authority && !loading && canPurchase ? <GlowCard style={styles.card}>
      <Text style={styles.title}>Contratar IRON FIT CORE</Text>
      <Text style={styles.muted}>Escolha uma oferta cadastrada no FM Command. A compra será vinculada à sua academia por uma fatura exclusiva e finalizada na Cakto.</Text>
      {offersError ? <Text testID="iron-cakto-offers-unavailable" style={styles.warning}>{offersError}</Text> : null}
      {offers.map((offer) => <View key={offer.planCode + ':' + offer.interval} style={styles.offerRow}>
        <View style={styles.offerHeading}>
          <Text style={styles.offerTitle}>{offer.name} · {offer.interval === 'monthly' ? 'Mensal' : 'Anual'}</Text>
          <Text style={styles.offerPrice}>{money(offer.amountMinor, offer.currency)}</Text>
        </View>
        <TouchableOpacity testID={'iron-cakto-buy-' + offer.planCode} accessibilityRole="button"
          accessibilityState={{ disabled: checkoutLoading }}
          disabled={checkoutLoading} style={[styles.button, checkoutLoading && styles.disabled]}
          onPress={() => { void beginCheckout(offer); }}>
          <Text style={styles.buttonText}>{checkoutLoading ? 'Preparando...' : 'Contratar na Cakto'}</Text>
        </TouchableOpacity>
      </View>)}
      {checkoutPending ? <Text testID="iron-cakto-await-webhook" style={styles.warning}>Pagamento aguardando confirmação oficial. Use “Atualizar situação” após a aprovação.</Text> : null}
    </GlowCard> : null}
        {authority && !loading ? <>
      <GlowCard style={styles.card}>
        <Text style={styles.title}>Minha assinatura no FM Command</Text>
        {canonical ? (canonical.subscription ? <>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Plano contratado</Text>
            <Text testID="saas-billing-canonical-plan" style={styles.statusValue}>
              {canonical.subscription.planName ?? 'Plano comercial registrado'}
              {canonical.subscription.interval === 'monthly' ? ' · Mensal' : canonical.subscription.interval === 'yearly' ? ' · Anual' : ''}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Situação comercial</Text>
            <Text testID="saas-billing-canonical-status" style={styles.statusValue}>
              {statusLabel(canonical.subscription.status.toUpperCase())}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Cobertura paga registrada até</Text>
            <Text style={styles.statusValue}>{readableDate(canonical.subscription.paidThrough)}</Text>
          </View>
          <Text style={styles.muted}>Dados oficiais de assinatura registrados no FM Command. A liberação de recursos depende exclusivamente da licença confirmada no IRON.</Text>
        </> : <Text testID="saas-billing-canonical-empty" style={styles.muted}>
          O FM Command não tem uma assinatura comercial registrada para esta academia nesta consulta. O período gratuito do IRON é consultado separadamente.
        </Text>) : <Text testID="saas-billing-command-unavailable" style={styles.warning}>
          {canonicalError || 'Posição comercial oficial ainda não disponível.'}
        </Text>}
      </GlowCard>
      {canonical ? <GlowCard style={styles.card}>
        <Text style={styles.title}>Faturas no FM Command</Text>
        <Text style={styles.muted}>Registros financeiros da FM Tecnologia. Uma fatura ou evento de pagamento não ativa a licença sem confirmação oficial.</Text>
        {canonical.invoices.length ? canonical.invoices.map((invoice, index) => <View key={index} style={styles.invoice}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>{statusLabel(invoice.status.toUpperCase())}</Text>
            <Text style={styles.invoiceTitle}>{money(invoice.amountMinor, invoice.currency)}</Text>
          </View>
          <Text style={styles.muted}>Período até: {readableDate(invoice.periodEnd)}</Text>
        </View>) : <Text style={styles.muted}>Nenhuma fatura comercial registrada para esta academia no FM Command.</Text>}
      </GlowCard> : <GlowCard style={styles.card}>
        <Text style={styles.title}>Registros anteriores da assinatura</Text>
        <Text style={styles.muted}>{legacy
          ? 'Histórico local de leitura, não uma posição financeira homologada do FM Command.'
          : 'Projeção disponibilizada pelo backend do IRON. Confirme cobranças e pagamentos no sistema corporativo.'}</Text>
        {agreement ? <>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status no registro antigo</Text>
            <Text testID="saas-billing-state" style={styles.statusValue}>{statusLabel(agreement.status)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Plano no registro antigo</Text>
            <Text style={styles.statusValue}>{agreement.price?.planVersion?.productPlan?.name ?? 'Não informado'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Próxima data no registro antigo</Text>
            <Text style={styles.statusValue}>{readableDate(agreement.nextBillingAt)}</Text>
          </View>
        </> : <Text testID="saas-billing-legacy-absence" style={styles.muted}>
          Nenhum histórico de assinatura encontrado no módulo antigo. Isso não significa que sua academia não tenha assinatura no FM Command.
        </Text>}
      </GlowCard>}
      {!canonical ? <GlowCard style={styles.card}>
        <Text style={styles.title}>Histórico de faturas do IRON</Text>
        <Text style={styles.muted}>Registros do módulo anterior, disponibilizados somente para consulta. Eles não substituem as faturas e liquidações do FM Command.</Text>
        {invoices.length ? invoices.slice(0, 24).map((invoice) => <View key={invoice.id} style={styles.invoice}>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>{statusLabel(invoice.status)}</Text>
            <Text style={styles.invoiceTitle}>{money(invoice.amountDueMinor, invoice.currency)}</Text>
          </View>
          <Text style={styles.muted}>Vencimento: {readableDate(invoice.dueAt)} · Valor pago registrado: {money(invoice.amountPaidMinor, invoice.currency)}</Text>
        </View>) : <Text style={styles.muted}>Nenhuma fatura encontrada no módulo antigo. A situação financeira atual deve ser confirmada pelo FM Command.</Text>}
      </GlowCard> : null}
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  heading: { flexGrow: 1, flexBasis: 190, gap: 4 },
  title: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  muted: { color: '#afbed0', fontSize: 12, lineHeight: 18 },
  warning: { color: '#f3c18b', fontSize: 12, lineHeight: 18 },
  error: { color: '#fca5a5', fontSize: 12 },
  authority: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  authorityTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  button: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9 },
  buttonText: { color: colors.onAccent, fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.45 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: '#29384c', paddingVertical: 10 },
  statusLabel: { color: '#a8b9cc', fontSize: 12 },
  statusValue: { color: '#f0f7fa', fontWeight: '800', fontSize: 12, textAlign: 'right', flexShrink: 1 },
  offerRow: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#29384c' },
  offerHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offerTitle: { color: '#F0F7FF', fontSize: 14, fontWeight: '700' },
  offerPrice: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  invoice: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#29384c', gap: 6 },
  invoiceHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  invoiceTitle: { color: '#eff7fa', fontWeight: '700', fontSize: 13 },
});
