import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';
import { brlFromMinor } from '../utils/academy-money';

type Charge = {
  id: string; studentId?: string; amount?: number; status?: string;
  dueDate?: string | null; gatewayConnectionId?: string | null; student?: { user?: { name?: string } };
};
type Account = { id: string; name?: string; active?: boolean };
type PaymentProvider = { connectionId: string; providerCode: string };
type ProviderEvent = { id: string; providerCode: string; eventType: string; status: string; chargeId?: string | null; receivedAt?: string };
type CheckoutResult = { checkoutUrl?: string | null; pixQrCode?: string | null; idempotent?: boolean };
type Props = {
  charges: Charge[]; accounts: Account[]; selectedAccountId: string;
  saving: boolean; onPay: (chargeId: string, accountId: string, paymentMethod: string) => void;
  onUpdated?: () => void;
};
function date(value?: string | null) {
  if (!value) return 'Não informado';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Não informado' : d.toLocaleDateString('pt-BR');
}
function recordedAmount(value?: number) { return brlFromMinor(value); }
const statusLabels: Record<string,string> = {
  PENDING: 'Pendente', PAID: 'Paga', REFUNDED: 'Estornada', CANCELED: 'Cancelada', CANCELLED: 'Cancelada',
};
function Btn({ label, onPress, disabled = false, testID, danger = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; danger?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress}
    disabled={disabled} style={[styles.button, danger && styles.danger, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </TouchableOpacity>;
}

export function AcademyChargesPanel({ charges, accounts, selectedAccountId, saving, onPay, onUpdated }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAccountId, setConfirmAccountId] = useState('');
  const [receivedVia, setReceivedVia] = useState('');
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [providerError, setProviderError] = useState('');
  const [providerEvents, setProviderEvents] = useState<ProviderEvent[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationNotice, setAutomationNotice] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [checkoutResults, setCheckoutResults] = useState<Record<string, CheckoutResult>>({});
  const [checkoutError, setCheckoutError] = useState('');
  const [reconcileBusy, setReconcileBusy] = useState<string | null>(null);
  const [reconcileNotice, setReconcileNotice] = useState('');
  const [eventBusy, setEventBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve(api('/financial/payment-providers'))
      .then((value: unknown) => {
        if (!active) return;
        const items = Array.isArray(value) ? value : [];
        setPaymentProviders(items.filter((item): item is PaymentProvider =>
          !!item && typeof item.connectionId === 'string' && typeof item.providerCode === 'string'));
      })
      .catch(() => {
        if (active) setProviderError('Não foi possível carregar os gateways habilitados desta academia.');
      });
    void Promise.resolve(api('/financial/automation-policy'))
      .then((value: unknown) => {
        if (!active || !value || typeof value !== 'object') return;
        const policy = value as { enabled?: boolean };
        setAutomationEnabled(policy.enabled === true);
      })
      .catch(() => undefined);
    void Promise.resolve(api('/financial/gateway-events'))
      .then((value: unknown) => {
        if (!active || !Array.isArray(value)) return;
        setProviderEvents(value.filter((item): item is ProviderEvent =>
          !!item && typeof item.id === 'string' &&
          typeof item.providerCode === 'string' &&
          typeof item.eventType === 'string' &&
          typeof item.status === 'string').slice(0, 10));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function generateCheckout(chargeId: string) {
    if (checkoutBusy || !selectedProvider) return;
    setCheckoutError('');
    setCheckoutBusy(chargeId);
    try {
      const result = await api('/financial/charges/' + encodeURIComponent(chargeId) + '/payment-session', undefined, {
        method: 'POST',
        body: JSON.stringify({ requestId: chargeId, providerConnectionId: selectedProvider }),
      }) as CheckoutResult;
      setCheckoutResults((current) => ({ ...current, [chargeId]: result }));
    } catch {
      setCheckoutError('Não foi possível criar a cobrança online. Confira o gateway e o status da cobrança.');
    } finally {
      setCheckoutBusy(null);
    }
  }

  async function reconcileGatewayReceipt(chargeId: string) {
    if (reconcileBusy || !selectedAccountId) return;
    setReconcileNotice('');
    setReconcileBusy(chargeId);
    try {
      const result = await api('/financial/charges/' + encodeURIComponent(chargeId) + '/reconcile-payment', undefined, {
        method: 'POST',
        body: JSON.stringify({ accountId: selectedAccountId }),
      }) as { status?: string; booked?: boolean; reversalBooked?: boolean; requiresReview?: boolean };
      if (result?.status === 'PAID' && result.booked === true) {
        setReconcileNotice('Pagamento confirmado pelo gateway e registrado no financeiro da academia.');
        onUpdated?.();
      } else if (result?.status === 'REFUNDED' && result.reversalBooked === true) {
        setReconcileNotice('Estorno integral confirmado pelo gateway e contabilizado. A revisão fiscal permanece separada.');
        onUpdated?.();
      } else if (result?.requiresReview === true) {
        setReconcileNotice('Divergência, estorno parcial ou contestação detectada. Revisão financeira humana obrigatória; nenhuma reversão integral automática.');
      } else {
        setReconcileNotice('O gateway ainda não confirmou o pagamento. Nenhuma baixa financeira foi realizada.');
      }
    } catch {
      setReconcileNotice('Não foi possível validar o recebimento no gateway. Nenhuma confirmação foi presumida.');
    } finally {
      setReconcileBusy(null);
    }
  }

  async function reconcileSignedEvent(eventId: string) {
    if (eventBusy || !selectedAccountId) return;
    setEventBusy(eventId);
    setReconcileNotice('');
    try {
      const response = await api('/financial/gateway-events/' + encodeURIComponent(eventId) + '/reconcile', undefined, {
        method: 'POST',
        body: JSON.stringify({ accountId: selectedAccountId }),
      }) as { status?: string; processed?: boolean };
      if (response.status === 'RECONCILED' && response.processed !== false) {
        setReconcileNotice('Evento conciliado após verificação diretamente no gateway.');
        setProviderEvents((previous) => previous.map((event) =>
          event.id === eventId ? { ...event, status: 'RECONCILED' } : event));
        onUpdated?.();
      } else {
        setReconcileNotice('Evento ainda não conciliado. Nenhum recebimento foi presumido.');
      }
    } catch {
      setReconcileNotice('Não foi possível conferir o evento no gateway. O recebimento não foi presumido.');
    } finally {
      setEventBusy(null);
    }
  }

  async function configurePaymentAutomation(enabled: boolean) {
    if (automationBusy || !selectedAccountId) return;
    setAutomationBusy(true);
    setAutomationNotice('');
    try {
      const result = await api('/financial/automation-policy', undefined, {
        method: 'POST',
        body: JSON.stringify({ accountId: selectedAccountId, enabled }),
      }) as { enabled?: boolean };
      setAutomationEnabled(result.enabled === true);
      setAutomationNotice(result.enabled === true
        ? 'Política da academia habilitada. A execução automática exige também autorização de infraestrutura e homologação externa.'
        : 'Conciliação automática desativada para esta academia.');
    } catch {
      setAutomationNotice('Falha ao salvar a política financeira. Nenhuma alteração foi presumida.');
    } finally {
      setAutomationBusy(false);
    }
  }

  const account = accounts.find((item) => item.id === selectedAccountId && item.active !== false);
  const pendingCharge = charges.find((item) => item.id === confirmId && item.status === 'PENDING');
  const accountApproved = Boolean(account && pendingCharge && confirmAccountId === account?.id);
  const approved = accountApproved && !!receivedVia;
  const rows = useMemo(() => charges.filter((item) => filter === 'ALL' || item.status === filter), [charges, filter]);
  function reset() { setConfirmId(null); setConfirmAccountId(''); setReceivedVia(''); }

  return <GlowCard style={styles.card}>
    <Text style={styles.title}>Cobranças da academia</Text>
    <Text style={styles.muted}>Academia → aluno. Recebimento manual gera lançamento financeiro e pode gerar registro fiscal. Não é o billing FM → academia.</Text>
    <View style={styles.filters}>
      <Btn testID="academy-charges-all" label="Todas" onPress={() => { reset(); setFilter('ALL'); }} />
      <Btn testID="academy-charges-pending" label="Pendentes" onPress={() => { reset(); setFilter('PENDING'); }} />
      <Btn testID="academy-charges-paid" label="Pagas" onPress={() => { reset(); setFilter('PAID'); }} />
    </View>
    {!account ? <Text style={styles.notice}>Selecione uma conta financeira ativa na seção Contas antes de registrar um recebimento.</Text> : null}
    <View style={styles.confirm} testID="academy-payment-provider-choices">
      <Text style={styles.heading}>Recebimento online por gateway</Text>
      <Text style={styles.muted}>Escolha uma conexão habilitada da academia. O checkout é criado pelo backend; a cobrança só pode ser considerada paga após confirmação e conciliação, nunca ao gerar o link.</Text>
      {providerError ? <Text style={styles.notice}>{providerError}</Text> : null}
      {!paymentProviders.length ? <Text style={styles.notice}>Nenhum gateway de pagamento habilitado para esta academia.</Text> : null}
      <View style={styles.filters}>
        {paymentProviders.map((provider) => <Btn key={provider.connectionId}
          testID={'academy-payment-provider-' + provider.connectionId}
          label={provider.providerCode.replace(/_/g, ' ') + (selectedProvider === provider.connectionId ? ' ✓' : '')}
          disabled={!!checkoutBusy || saving}
          onPress={() => setSelectedProvider(provider.connectionId)} />)}
      </View>
      {checkoutError ? <Text style={styles.notice} testID="academy-checkout-error">{checkoutError}</Text> : null}
    </View>
    <View style={styles.confirm} testID="academy-payment-automation-policy">
      <Text style={styles.heading}>Conciliação automática</Text>
      <Text style={styles.muted}>Requer conta financeira ativa, autorização de infraestrutura e homologação do gateway. Nenhum webhook sozinho confirma um recebimento.</Text>
      <Text style={styles.muted}>Política da academia: {automationEnabled ? 'Habilitada' : 'Desabilitada'}</Text>
      <Btn testID="academy-automation-policy-toggle"
        label={automationEnabled ? 'Desativar automação' : 'Habilitar automação'}
        disabled={!account || saving || automationBusy}
        onPress={() => { void configurePaymentAutomation(!automationEnabled); }} />
      {automationNotice ? <Text testID="academy-automation-policy-notice" style={styles.notice}>{automationNotice}</Text> : null}
    </View>
    {providerEvents.length ? <View style={styles.confirm} testID="academy-gateway-events">
      <Text style={styles.heading}>Notificações dos gateways</Text>
      <Text style={styles.muted}>Eventos recebidos e autenticados são apenas avisos. A confirmação do dinheiro continua dependendo da conciliação com o provedor.</Text>
      {providerEvents.map((event) => <View key={event.id} style={styles.row}>
        <Text style={styles.detail}>{event.providerCode.replace(/_/g, ' ')} · {event.eventType}</Text>
        {event.providerCode === 'stripe' && event.chargeId &&
          ['RECEIVED', 'RETRY'].includes(event.status) && account ? <Btn
          testID={'academy-reconcile-event-' + event.id}
          label={eventBusy === event.id ? 'Conferindo…' : 'Conciliar evento'}
          disabled={saving || !!eventBusy}
          onPress={() => { void reconcileSignedEvent(event.id); }} /> : null}
        <Text style={styles.muted}>Situação: {event.status === 'RECEIVED' ? 'Recebido — conferir cobrança' :
          event.status === 'UNMATCHED' ? 'Aguardando associação à cobrança' :
          event.status === 'IGNORED' ? 'Fora do escopo financeiro' : 'Revisão necessária'}</Text>
      </View>)}
    </View> : null}
    {rows.length ? rows.slice(0, 150).map((item) => <View key={item.id} style={styles.row} testID={'academy-charge-' + item.id}>
      <Text style={styles.heading}>{item.student?.user?.name ?? 'Aluno'}</Text>
      <Text style={styles.muted}>Situação: {statusLabels[item.status ?? ''] ?? 'Não informada'} · Valor registrado: {recordedAmount(item.amount)} · Vencimento: {date(item.dueDate)}</Text>
      {item.status === 'PENDING' && selectedProvider ? <Btn
        testID={'academy-charge-online-' + item.id}
        label={checkoutBusy === item.id ? 'Gerando checkout…' : 'Gerar link de pagamento'}
        disabled={saving || !!checkoutBusy}
        onPress={() => { void generateCheckout(item.id); }} /> : null}
      {checkoutResults[item.id]?.checkoutUrl ? <Text selectable style={styles.detail} testID={'academy-charge-checkout-link-' + item.id}>Link de pagamento: {checkoutResults[item.id].checkoutUrl}</Text> : null}
      {checkoutResults[item.id]?.pixQrCode ? <Text selectable style={styles.detail} testID={'academy-charge-pix-' + item.id}>Pix copia e cola: {checkoutResults[item.id].pixQrCode}</Text> : null}
      {['PENDING', 'PAID', 'REFUNDED'].includes(item.status ?? '') &&
        (item.gatewayConnectionId || checkoutResults[item.id]) && account ? <Btn
        testID={'academy-charge-verify-gateway-' + item.id}
        label={reconcileBusy === item.id ? 'Conferindo gateway…' : 'Conferir situação no gateway'}
        disabled={saving || !!reconcileBusy}
        onPress={() => { void reconcileGatewayReceipt(item.id); }} /> : null}
      {reconcileNotice ? <Text testID="academy-charge-reconciliation-notice" style={styles.notice}>{reconcileNotice}</Text> : null}
      {item.status === 'PENDING' && !item.gatewayConnectionId && !checkoutResults[item.id] ? <Btn
        label="Registrar pagamento recebido" testID={'academy-charge-prepare-' + item.id}
        disabled={saving || !account} onPress={() => {
          setConfirmId(item.id);
          setConfirmAccountId(account?.id ?? '');
          setReceivedVia('');
        }} /> : null}
      {confirmId === item.id && item.status !== 'PENDING' ? <Text style={styles.notice}>A cobrança já não está pendente. Consulte o estado atualizado.</Text> : null}
      {confirmId === item.id && pendingCharge ? <View style={styles.confirm} testID="academy-charge-confirmation">
        <Text style={styles.dangerTitle}>Confirmação obrigatória de recebimento</Text>
        <Text style={styles.muted}>Confirme somente se o pagamento realmente foi recebido e conferido fora desta tela.</Text>
        <Text style={styles.detail}>Aluno: {item.student?.user?.name ?? 'Aluno'}</Text>
        <Text style={styles.detail}>Valor registrado: {recordedAmount(item.amount)}</Text>
        <Text style={styles.detail}>Conta selecionada: {account?.name ?? 'Não selecionada'}</Text>
        <Text style={styles.detail}>Meio pelo qual a academia recebeu o pagamento</Text>
        <View style={styles.filters}>{[
          { value: 'PIX', label: 'Pix' }, { value: 'DINHEIRO', label: 'Dinheiro' },
          { value: 'CARTAO', label: 'Cartão' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
        ].map((method) => <Btn key={method.value} testID={'academy-payment-method-' + method.value}
          label={method.label + (receivedVia === method.value ? ' ✓' : '')} disabled={saving}
          onPress={() => setReceivedVia(method.value)} />)}</View>
        {!receivedVia ? <Text testID="academy-payment-method-required" style={styles.notice}>Selecione o meio de recebimento para registrar a transação e eventual encaminhamento fiscal.</Text> : null}
        <Text style={styles.notice}>Esta ação altera o estado da cobrança e pode gerar um encaminhamento fiscal. Não é um comando de checkout.</Text>
        {!accountApproved ? <Text testID="academy-charge-account-changed" style={styles.notice}>A conta selecionada foi alterada ou está indisponível. Cancele e revise a operação.</Text> : null}
        <View style={styles.filters}>
          <Btn testID="academy-charge-confirm-pay" label={saving ? 'Registrando…' : 'Confirmar recebimento'} danger
            disabled={saving || !approved} onPress={() => {
              if (approved && account && pendingCharge) {
                const id = pendingCharge.id; const accountId = account.id; const method = receivedVia;
                reset(); onPay(id, accountId, method);
              }
            }} />
          <Btn testID="academy-charge-cancel-pay" label="Cancelar" disabled={saving} onPress={reset} />
        </View>
      </View> : null}
    </View>) : <Text style={styles.muted}>Nenhuma cobrança corresponde ao filtro selecionado.</Text>}
    {rows.length > 150 ? <Text style={styles.muted}>Exibindo os 150 registros mais recentes. Utilize os filtros para refinar a lista.</Text> : null}
  </GlowCard>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  title: { color: '#2f91ff', fontSize: 17, fontWeight: '800' },
  muted: { color: '#b0bfd2', fontSize: 12, lineHeight: 18 },
  notice: { color: '#f5c48b', fontSize: 12, lineHeight: 18 },
  heading: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  detail: { color: '#f2f8fd', fontSize: 12, fontWeight: '700' },
  row: { borderTopWidth: 1, borderColor: '#263748', paddingVertical: 12, gap: 7 },
  confirm: { backgroundColor: '#2a1b1c', borderWidth: 1, borderColor: '#975044', padding: 12, borderRadius: 10, gap: 7 },
  dangerTitle: { color: '#ffcab0', fontSize: 14, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: '#123452', borderWidth: 1, borderColor: '#2f91ff', alignSelf: 'flex-start' },
  danger: { backgroundColor: '#ae443a', borderColor: '#e67b71' },
  buttonText: { fontSize: 12, fontWeight: '800', color: '#f2faf5' },
  disabled: { opacity: 0.45 },
});
