import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { IronInput as TextInput } from '../components/IronInput';

type FiscalHandoff = {
  id: string;
  chargeId: string;
  status: string;
  documentKind: string;
  operationKind: string;
  amountMinor: number;
  currency: string;
  paymentMethod?: string | null;
  settledAt?: string | null;
  providerDocumentId?: string | null;
  attemptCount: number;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  lastErrorCode?: string | null;
  authorizedAt?: string | null;
  reconciledAt?: string | null;
  cancelledAt?: string | null;
  cancellationRejectionCode?: string | null;
  cancellationRejectionMessage?: string | null;
  reconciliationIssueCodes?: unknown;
  createdAt: string;
  updatedAt: string;
  charge?: {
    student?: {
      id?: string;
      user?: {
        name?: string | null;
        email?: string | null;
      } | null;
    } | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  PENDING_CAPABILITY: 'Aguardando capacidade fiscal',
  READY_TO_ISSUE: 'Pronta para emissão',
  SUBMITTED: 'Enviada ao serviço fiscal',
  AUTHORIZED: 'NFS-e autorizada',
  REJECTED: 'Rejeitada',
  RECONCILIATION_PENDING: 'Reconciliação pendente',
  RECONCILED: 'Reconciliada',
  CANCELLATION_PENDING: 'Cancelamento pendente',
  CANCELLED: 'Cancelada',
  FAILED: 'Falha fiscal',
};

const errorLabels: Record<string, string> = {
  FISCAL_RECONCILIATION_DIVERGENT: 'Divergência encontrada na reconciliação.',
  FISCAL_RECONCILIATION_REFERENCE_MISMATCH: 'Referência fiscal divergente da cobrança.',
  FISCAL_RECONCILIATION_DOCUMENT_MISSING: 'Documento fiscal não localizado na reconciliação.',
  FISCAL_RECONCILIATION_DOCUMENT_CONFLICT: 'Documento fiscal conflitante.',
  FISCAL_CANCELLATION_DOCUMENT_NOT_FOUND: 'Documento não localizado durante o cancelamento.',
  FISCAL_CANCELLATION_REJECTED: 'Cancelamento rejeitado pelo serviço fiscal.',
  FISCAL_J4_CONFIGURATION_UNAVAILABLE: 'Configuração fiscal externa indisponível.',
};

const filters = [
  { key: '', label: 'Todos' },
  { key: 'PENDING_CAPABILITY', label: 'Aguardando' },
  { key: 'AUTHORIZED', label: 'Autorizadas' },
  { key: 'RECONCILIATION_PENDING', label: 'Reconciliação' },
  { key: 'FAILED', label: 'Falhas' },
  { key: 'CANCELLED', label: 'Canceladas' },
];

function formatMoney(minor: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format((Number(minor) || 0) / 100);
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function secondFactorPayload(value: string) {
  const factor = value.trim();
  if (!factor) return {};
  return /^\d{6}$/.test(factor)
    ? { mfaCode: factor }
    : { recoveryCode: factor.toUpperCase() };
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FiscalCenter() {
  const [binding, setBinding] = useState<any>(null);
  const [handoffs, setHandoffs] = useState<FiscalHandoff[]>([]);
  const [filter, setFilter] = useState('');
  const [externalTenantId, setExternalTenantId] = useState('');
  const [externalUnitId, setExternalUnitId] = useState('');
  const [bindingPassword, setBindingPassword] = useState('');
  const [bindingFactor, setBindingFactor] = useState('');
  const [cancelId, setCancelId] = useState('');
  const [cancelJustification, setCancelJustification] = useState('');
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelFactor, setCancelFactor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bindingRequest = api('/financial/fiscal/scope-binding').catch((reason) => {
        const status = (reason as Error & { status?: number })?.status;
        if (status === 404) return null;
        throw reason;
      });
      const handoffPath = filter
        ? '/financial/fiscal/handoffs?status=' + encodeURIComponent(filter)
        : '/financial/fiscal/handoffs';
      const [scopeBinding, rows] = await Promise.all([
        bindingRequest,
        api(handoffPath),
      ]);
      setBinding(scopeBinding);
      setHandoffs(Array.isArray(rows) ? rows : []);
      setExternalTenantId(scopeBinding?.externalTenantId ? String(scopeBinding.externalTenantId) : '');
      setExternalUnitId(scopeBinding?.externalUnitId ? String(scopeBinding.externalUnitId) : '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar o Fiscal Center.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function execute(operation: () => Promise<unknown>, success: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação fiscal.');
    } finally {
      setSaving(false);
    }
  }

  function saveBinding() {
    if (!externalTenantId.trim() || !externalUnitId.trim() || !bindingPassword) return;
    void execute(
      () =>
        api('/financial/fiscal/scope-binding', undefined, {
          method: 'POST',
          body: JSON.stringify({
            externalTenantId: externalTenantId.trim(),
            externalUnitId: externalUnitId.trim(),
            currentPassword: bindingPassword,
            ...secondFactorPayload(bindingFactor),
          }),
        }),
      'Escopo fiscal atualizado para o ambiente atual.',
    ).then(() => {
      setBindingPassword('');
      setBindingFactor('');
    });
  }

  function cancelHandoff() {
    if (
      !cancelId
      || cancelJustification.trim().length < 15
      || !cancelPassword
    ) {
      return;
    }
    const targetId = cancelId;
    void execute(
      () =>
        api('/financial/fiscal/handoffs/' + targetId + '/cancel', undefined, {
          method: 'POST',
          body: JSON.stringify({
            justification: cancelJustification.trim(),
            currentPassword: cancelPassword,
            ...secondFactorPayload(cancelFactor),
          }),
        }),
      'Cancelamento fiscal solicitado. O status só mudará para cancelada após confirmação do serviço fiscal.',
    ).then(() => {
      setCancelId('');
      setCancelJustification('');
      setCancelPassword('');
      setCancelFactor('');
    });
  }

  const summary = useMemo(() => ({
    pending: handoffs.filter((item) =>
      ['PENDING_CAPABILITY', 'READY_TO_ISSUE', 'SUBMITTED', 'RECONCILIATION_PENDING', 'CANCELLATION_PENDING'].includes(item.status),
    ).length,
    authorized: handoffs.filter((item) => ['AUTHORIZED', 'RECONCILED'].includes(item.status)).length,
    failed: handoffs.filter((item) => ['FAILED', 'REJECTED'].includes(item.status)).length,
  }), [handoffs]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#2f91ff" />
        <Text style={styles.muted}>Carregando operação fiscal…</Text>
      </View>
    );
  }

  return (
    <View testID="fiscal-center">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>FISCAL CENTER</Text>
          <Text style={styles.heroTitle}>NFS-e e operação fiscal</Text>
          <Text style={styles.muted}>
            Acompanhe o handoff fiscal das cobranças pagas, reconciliação e cancelamentos sem mover regras tributárias para o IRON.
          </Text>
        </View>
        <View style={styles.externalStatus}>
          <Text style={styles.externalKicker}>Status externo</Text>
          <Text style={styles.externalTitle}>Engenharia pronta</Text>
          <Text style={styles.externalWarning}>Homologação externa pendente</Text>
          <Text style={styles.meta}>
            Provider, município, credencial e emissão real exigem evidência oficial antes de produção.
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Em processamento</Text>
          <Text style={styles.bigValue}>{summary.pending}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Autorizadas / reconciliadas</Text>
          <Text style={styles.bigValue}>{summary.authorized}</Text>
        </View>
        <View style={[styles.summaryCard, summary.failed > 0 && styles.alertCard]}>
          <Text style={styles.kicker}>Falhas / rejeições</Text>
          <Text style={styles.bigValue}>{summary.failed}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vínculo fiscal da academia</Text>
        <Text style={styles.muted}>
          O IRON usa IDs explícitos do FM Fiscal para o tenant e a unidade. O sistema não presume que o ID da academia seja o ID fiscal.
        </Text>
        <View style={styles.bindingStatus}>
          <Text style={styles.kicker}>Ambiente</Text>
          <Text style={styles.bindingValue}>{binding?.environment ?? 'Ambiente atual do servidor'}</Text>
          <Text style={binding?.active ? styles.activeBadge : styles.pendingBadge}>
            {binding?.active ? 'Vínculo ativo' : 'Vínculo não configurado'}
          </Text>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>Identificador do tenant fiscal</Text>
            <TextInput
              accessibilityLabel="Identificador do tenant fiscal"
              style={styles.input}
              value={externalTenantId}
              onChangeText={setExternalTenantId}
              autoCapitalize="none"
              placeholder="ID fornecido pelo FM Fiscal"
              placeholderTextColor="#71879e"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Identificador da unidade fiscal</Text>
            <TextInput
              accessibilityLabel="Identificador da unidade fiscal"
              style={styles.input}
              value={externalUnitId}
              onChangeText={setExternalUnitId}
              autoCapitalize="none"
              placeholder="Unidade fiscal autorizada"
              placeholderTextColor="#71879e"
            />
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>Senha atual — reautenticação</Text>
            <TextInput
              testID="fiscal-binding-password"
              accessibilityLabel="Senha atual para vínculo fiscal"
              style={styles.input}
              value={bindingPassword}
              onChangeText={setBindingPassword}
              secureTextEntry
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>MFA ou código de recuperação (se exigido)</Text>
            <TextInput
              accessibilityLabel="Segundo fator fiscal"
              style={styles.input}
              value={bindingFactor}
              onChangeText={setBindingFactor}
              autoCapitalize="characters"
              placeholderTextColor="#71879e"
            />
          </View>
        </View>
        <ActionButton
          testID="fiscal-save-binding"
          label={saving ? 'Salvando…' : 'Salvar vínculo fiscal'}
          disabled={saving || !externalTenantId.trim() || !externalUnitId.trim() || !bindingPassword}
          onPress={saveBinding}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadCopy}>
            <Text style={styles.sectionTitle}>Handoffs fiscais</Text>
            <Text style={styles.muted}>
              Status canônico do backend. Nenhuma emissão é declarada concluída antes da confirmação fiscal.
            </Text>
          </View>
          <ActionButton
            secondary
            label="Atualizar status"
            disabled={saving}
            onPress={() => { void load(); }}
          />
        </View>

        <View style={styles.chips}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.key || 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.key }}
              style={[styles.chip, filter === item.key && styles.chipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={styles.chipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {handoffs.length ? handoffs.map((handoff) => {
          const student = handoff.charge?.student?.user;
          const canCancel = ['AUTHORIZED', 'RECONCILED'].includes(handoff.status);
          return (
            <View key={handoff.id} style={styles.handoff}>
              <View style={styles.handoffHead}>
                <View style={styles.handoffCopy}>
                  <Text style={styles.rowTitle}>
                    {student?.name ?? student?.email ?? 'Cobrança fiscal'}
                  </Text>
                  <Text style={styles.meta}>
                    {formatMoney(handoff.amountMinor, handoff.currency)}
                    {' · '}
                    {handoff.paymentMethod ?? 'Pagamento confirmado'}
                    {' · '}
                    {formatDate(handoff.settledAt)}
                  </Text>
                </View>
                <Text style={
                  ['FAILED', 'REJECTED'].includes(handoff.status)
                    ? styles.failedBadge
                    : handoff.status === 'CANCELLED'
                      ? styles.cancelledBadge
                      : styles.statusBadge
                }>
                  {statusLabels[handoff.status] ?? handoff.status}
                </Text>
              </View>

              <View style={styles.facts}>
                <View style={styles.fact}>
                  <Text style={styles.kicker}>Documento fiscal</Text>
                  <Text style={styles.factValue}>{handoff.providerDocumentId ?? 'Ainda não atribuído'}</Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.kicker}>Tentativas</Text>
                  <Text style={styles.factValue}>{handoff.attemptCount ?? 0}</Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.kicker}>Atualizado</Text>
                  <Text style={styles.factValue}>{formatDate(handoff.updatedAt)}</Text>
                </View>
              </View>

              {handoff.lastErrorCode ? (
                <Text style={styles.failureText}>
                  {errorLabels[handoff.lastErrorCode] ?? 'Falha operacional fiscal: ' + handoff.lastErrorCode}
                </Text>
              ) : null}
              {handoff.cancellationRejectionMessage ? (
                <Text style={styles.failureText}>{handoff.cancellationRejectionMessage}</Text>
              ) : null}

              {canCancel ? (
                <ActionButton
                  danger
                  secondary
                  testID={'fiscal-cancel-open-' + handoff.id}
                  label="Solicitar cancelamento"
                  onPress={() => setCancelId(handoff.id)}
                />
              ) : null}

              {cancelId === handoff.id ? (
                <View style={styles.cancelBox}>
                  <Text style={styles.cancelTitle}>Solicitar cancelamento da NFS-e</Text>
                  <Text style={styles.muted}>
                    O IRON não marca a nota como cancelada ao enviar o pedido. O status final depende da confirmação do serviço fiscal.
                  </Text>
                  <Text style={styles.label}>Justificativa (15 a 255 caracteres)</Text>
                  <TextInput
                    accessibilityLabel="Justificativa do cancelamento fiscal"
                    style={[styles.input, styles.textArea]}
                    value={cancelJustification}
                    onChangeText={setCancelJustification}
                    multiline
                  />
                  <Text style={styles.label}>Senha atual — reautenticação</Text>
                  <TextInput
                    accessibilityLabel="Senha atual para cancelamento fiscal"
                    style={styles.input}
                    value={cancelPassword}
                    onChangeText={setCancelPassword}
                    secureTextEntry
                  />
                  <Text style={styles.label}>MFA ou código de recuperação (se exigido)</Text>
                  <TextInput
                    accessibilityLabel="Segundo fator para cancelamento fiscal"
                    style={styles.input}
                    value={cancelFactor}
                    onChangeText={setCancelFactor}
                    autoCapitalize="characters"
                  />
                  <View style={styles.actions}>
                    <ActionButton
                      danger
                      testID="fiscal-cancel-confirm"
                      label={saving ? 'Enviando…' : 'Confirmar solicitação'}
                      disabled={saving || cancelJustification.trim().length < 15 || !cancelPassword}
                      onPress={cancelHandoff}
                    />
                    <ActionButton
                      secondary
                      label="Fechar"
                      disabled={saving}
                      onPress={() => {
                        setCancelId('');
                        setCancelJustification('');
                        setCancelPassword('');
                        setCancelFactor('');
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        }) : (
          <Text style={styles.empty}>Nenhum handoff fiscal encontrado para este filtro.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 280 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', marginTop: 3, marginBottom: 4 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  externalStatus: { minWidth: 230, flexBasis: 280, backgroundColor: '#1a1410', borderWidth: 1, borderColor: '#7a5b20', borderRadius: 11, padding: 10 },
  externalKicker: { color: '#c9a85b', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  externalTitle: { color: '#eef7ff', fontSize: 13, fontWeight: '900', marginTop: 3 },
  externalWarning: { color: '#fde68a', fontSize: 10, fontWeight: '900', marginTop: 2 },
  meta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 190, minWidth: 170, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 9 },
  alertCard: { backgroundColor: '#1a1018', borderColor: '#7f2d3a' },
  kicker: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  bigValue: { color: '#eef7ff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  sectionHeadCopy: { flex: 1, minWidth: 240 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  bindingStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 9, marginTop: 7 },
  bindingValue: { color: '#eef7ff', fontSize: 11, fontWeight: '900' },
  activeBadge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  pendingBadge: { color: '#fde68a', backgroundColor: '#2a210d', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  field: { flexGrow: 1, flexBasis: 260, minWidth: 220 },
  label: { color: '#9fb0c5', fontSize: 10, fontWeight: '800', marginTop: 7, marginBottom: 4 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  textArea: { minHeight: 82, textAlignVertical: 'top' },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  secondaryButton: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  dangerButton: { borderColor: '#7f2d3a' },
  buttonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, marginBottom: 4 },
  chip: { minHeight: 36, justifyContent: 'center', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  handoff: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10, marginTop: 7 },
  handoffHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  handoffCopy: { flex: 1, minWidth: 220 },
  rowTitle: { color: '#eef7ff', fontSize: 12, fontWeight: '900' },
  statusBadge: { alignSelf: 'flex-start', color: '#bfdbfe', backgroundColor: '#0b2340', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  failedBadge: { alignSelf: 'flex-start', color: '#fecaca', backgroundColor: '#301215', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  cancelledBadge: { alignSelf: 'flex-start', color: '#cbd5e1', backgroundColor: '#18202b', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  fact: { flexGrow: 1, flexBasis: 160, minWidth: 140, backgroundColor: '#071528', borderRadius: 8, padding: 7 },
  factValue: { color: '#dce9f6', fontSize: 10, fontWeight: '800', marginTop: 2 },
  failureText: { color: '#fca5a5', fontSize: 9, lineHeight: 13, marginTop: 7 },
  cancelBox: { backgroundColor: '#160d12', borderWidth: 1, borderColor: '#5a3340', borderRadius: 9, padding: 9, marginTop: 8 },
  cancelTitle: { color: '#fecaca', fontSize: 12, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 9 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 9, borderRadius: 9, marginBottom: 8 },
});
