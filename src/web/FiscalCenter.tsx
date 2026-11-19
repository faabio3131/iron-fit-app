import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { api } from '../services/api';
import { IronInput as TextInput } from '../components/IronInput';
import { uploadIronA1Direct, validatedIronA1Grant } from './fiscal-a1-direct-upload';

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

type FiscalOperationalUsage = {
  periodStart: string;
  periodEndExclusive: string;
  timezone: 'UTC';
  authorizedCount: number;
  cancelledCount: number;
  source: 'IRON_FISCAL_HANDOFF';
  billingStatus: 'NOT_A_COMMERCIAL_METER';
};

type FiscalActivationReadiness = {
  status: 'SCOPE_BINDING_REQUIRED' | 'BRIDGE_UNAVAILABLE' |
    'CAPABILITY_UNAVAILABLE' | 'CAPABILITY_NOT_READY' | 'CAPABILITY_READY';
  environment: 'HOMOLOG' | 'PROD';
  bindingConfigured: boolean;
  bridgeReachable: boolean;
  capabilityReadiness: string | null;
  capabilityVersion: string | null;
  certificateStatus: 'NOT_VERIFIED';
  municipalityStatus: 'NOT_VERIFIED';
  checkedAt: string | null;
};

const readinessLabels: Record<FiscalActivationReadiness['status'], string> = {
  SCOPE_BINDING_REQUIRED: 'Vínculo fiscal ainda não configurado',
  BRIDGE_UNAVAILABLE: 'Serviço fiscal não configurado ou indisponível',
  CAPABILITY_UNAVAILABLE: 'Não foi possível consultar a capacidade fiscal',
  CAPABILITY_NOT_READY: 'Emissão de NFS-e não habilitada para este escopo',
  CAPABILITY_READY: 'Capacidade de NFS-e informada pelo serviço fiscal',
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

export function FiscalCenter({ canManageA1 = false }: { canManageA1?: boolean }) {
  const [binding, setBinding] = useState<any>(null);
  const [activation, setActivation] = useState<FiscalActivationReadiness | null>(null);
  const [usage, setUsage] = useState<FiscalOperationalUsage | null>(null);
  const [handoffs, setHandoffs] = useState<FiscalHandoff[]>([]);
  const [filter, setFilter] = useState('');
  const [externalTenantId, setExternalTenantId] = useState('');
  const [externalUnitId, setExternalUnitId] = useState('');
  const [bindingPassword, setBindingPassword] = useState('');
  const [bindingFactor, setBindingFactor] = useState('');
  const [a1File, setA1File] = useState<{ name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null>(null);
  const [a1Password, setA1Password] = useState('');
  const [a1Busy, setA1Busy] = useState(false);
  const [a1Status, setA1Status] = useState<'NOT_VERIFIED' | 'STORED' | 'ABSENT'>('NOT_VERIFIED');
  const [a1ExpiresAt, setA1ExpiresAt] = useState<string | null>(null);
  const [a1Error, setA1Error] = useState('');
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
      const activationRequest: Promise<FiscalActivationReadiness | null> =
        api('/financial/fiscal/readiness').catch(() => null);
      const usageRequest: Promise<FiscalOperationalUsage | null> =
        api('/financial/fiscal/usage').catch(() => null);
      const [scopeBinding, rows, readiness, monthlyUsage] = await Promise.all([
        bindingRequest,
        api(handoffPath),
        activationRequest,
        usageRequest,
      ]);
      setActivation(readiness);
      setUsage(monthlyUsage);
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

  function selectA1File() {
    if (!canManageA1 || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const element = document.createElement('input');
    element.type = 'file';
    element.accept = '.pfx,.p12,application/x-pkcs12';
    element.onchange = () => {
      const file = element.files?.[0];
      setA1File(file && /\.(pfx|p12)$/i.test(file.name) && file.size <= 2_000_000 ? file : null);
      setA1Error(file && (!/\.(pfx|p12)$/i.test(file.name) || file.size > 2_000_000)
        ? 'Selecione um arquivo .pfx ou .p12 de até 2 MB.' : '');
    };
    element.click();
  }

  async function checkA1Status() {
    if (!canManageA1 || a1Busy) return;
    setA1Busy(true);
    setA1Error('');
    try {
      const status = await api('/financial/fiscal/a1/status');
      if ((status?.status !== 'STORED' && status?.status !== 'ABSENT') ||
          status?.officialHomologation !== 'NOT_VERIFIED' ||
          status?.source !== 'NFCORE_VAULT_READBACK' ||
          (status.status === 'STORED' && (typeof status.expiresAt !== 'string' ||
            !Number.isFinite(Date.parse(status.expiresAt)) || Date.parse(status.expiresAt) <= Date.now())) ||
          (status.status === 'ABSENT' && status.expiresAt !== null)) throw new Error('invalid status');
      setA1Status(status.status);
      setA1ExpiresAt(status.status === 'STORED' ? status.expiresAt : null);
    } catch {
      setA1Status('NOT_VERIFIED');
      setA1ExpiresAt(null);
      setA1Error('O status do certificado não pôde ser confirmado no NFCore.');
    } finally { setA1Busy(false); }
  }

  async function uploadA1() {
    if (!canManageA1 || a1Busy || !a1File || !a1Password) return;
    setA1Busy(true);
    setA1Error('');
    try {
      const candidate = await api('/financial/fiscal/a1/delegation', undefined, {
        method: 'POST',
      });
      const grant = validatedIronA1Grant(candidate);
      if (!grant) throw new Error('invalid delegation');
      await uploadIronA1Direct(grant, a1File, a1Password);
      const readback = await api('/financial/fiscal/a1/status');
      if (readback?.status !== 'STORED' ||
          readback?.officialHomologation !== 'NOT_VERIFIED' ||
          readback?.source !== 'NFCORE_VAULT_READBACK' ||
          typeof readback.expiresAt !== 'string' ||
          !Number.isFinite(Date.parse(readback.expiresAt)) || Date.parse(readback.expiresAt) <= Date.now()) {
        throw new Error('unconfirmed readback');
      }
      setA1Status('STORED');
      setA1ExpiresAt(readback.expiresAt);
      setA1File(null);
      setNotice('Certificado A1 armazenado no cofre NFCore. Homologação oficial ainda não comprovada.');
    } catch {
      setA1Status('NOT_VERIFIED');
      setA1ExpiresAt(null);
      setA1Error('O cofre não confirmou o A1. Revise o vínculo fiscal e solicite nova delegação.');
    } finally {
      // Never persist the password in browser storage, application logs or IRON API.
      setA1Password('');
      setA1Busy(false);
    }
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
        <ActivityIndicator color="#2F91FF" />
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
          <Text style={styles.externalTitle}>Ativação fiscal não concluída</Text>
          <Text style={styles.externalWarning}>A1, município e provedor aguardam verificação</Text>
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

      <View style={styles.section} testID="fiscal-readiness">
        <Text style={styles.sectionTitle}>Prontidão fiscal da academia</Text>
        <Text style={styles.muted}>
          Esta verificação consulta a capacidade de NFS-e do serviço fiscal para o vínculo da academia. Não equivale a uma nota autorizada.
        </Text>
        <View style={styles.bindingStatus}>
          <Text style={styles.kicker}>Situação atual</Text>
          <Text style={styles.bindingValue} testID="fiscal-readiness-status">
            {activation
              ? readinessLabels[activation.status] ?? 'Capacidade fiscal não reconhecida'
              : 'Verificação de ativação indisponível neste servidor'}
          </Text>
          <Text style={styles.muted}>
            Certificado A1: {a1Status === 'STORED' ? 'armazenado e confirmado pelo Vault NFCore em homologação' : a1Status === 'ABSENT' ? 'não encontrado no Vault NFCore' : 'sem leitura confirmada nesta sessão'}. Registro no cofre não significa homologação fiscal.
          </Text>
          <Text style={styles.muted}>
            Município e provedor emissor: homologação não verificada nesta tela.
          </Text>
          {usage ? (
            <View testID="fiscal-operational-usage">
              <Text style={styles.kicker}>Operação fiscal {usage.periodStart.slice(0, 7)} (UTC)</Text>
              <Text style={styles.muted}>
                Autorizações confirmadas: {usage.authorizedCount} · Cancelamentos confirmados: {usage.cancelledCount}
              </Text>
              <Text style={styles.muted}>
                Contagem operacional por academia. Não é faturamento, franquia contratada nem consumo cobrável pelo FM Command.
              </Text>
            </View>
          ) : (
            <Text style={styles.muted}>Contagem operacional de notas indisponível.</Text>
          )}
          <Text style={styles.muted}>
            {activation?.capabilityReadiness === 'PRODUCTION_APPROVED'
              ? 'O serviço informou capacidade para produção; confirme a homologação oficial e a emissão real antes da ativação.'
              : activation?.capabilityReadiness === 'HOMOLOGATION_READY'
                ? 'O serviço informou capacidade de homologação, não uma autorização de emissão produtiva.'
                : 'O sistema não presumirá autorização fiscal apenas pelo vínculo da academia.'}
          </Text>
        </View>
      </View>

      {canManageA1 ? (
        <View style={styles.section} testID="fiscal-a1-vault">
          <Text style={styles.sectionTitle}>Certificado A1 — cofre fiscal NFCore</Text>
          <Text style={styles.muted}>
            Uso exclusivo do proprietário autorizado após reautenticação. O arquivo .pfx e sua senha são enviados diretamente do navegador ao NFCore, nunca ao servidor IRON.
          </Text>
          <Text testID="fiscal-a1-vault-status" style={styles.bindingValue}>
            {a1Status === 'STORED' ? 'Armazenado no Vault (homologação externa pendente)' :
              a1Status === 'ABSENT' ? 'Nenhum certificado A1 encontrado' : 'Status ainda não confirmado'}
          </Text>
          {a1Status === 'STORED' && a1ExpiresAt ? <Text testID="fiscal-a1-expiry" style={styles.muted}>Validade informada pelo cofre: {new Date(a1ExpiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).</Text> : null}
          {a1Status === 'STORED' ? <Text style={styles.muted}>Para substituir o certificado, envie o novo A1 pelo mesmo fluxo seguro. A revogação do certificado e a homologação oficial são controles distintos.</Text> : null}
          {a1Error ? <Text testID="fiscal-a1-error" style={styles.error}>{a1Error}</Text> : null}
          <ActionButton
            secondary
            testID="fiscal-a1-read-status"
            label={a1Busy ? 'Consultando…' : 'Consultar A1 no cofre'}
            disabled={a1Busy}
            onPress={() => { void checkA1Status(); }}
          />
          {Platform.OS === 'web' ? (
            <>
              <ActionButton
                secondary
                testID="fiscal-a1-select-file"
                label={a1File ? 'Arquivo selecionado: ' + a1File.name : 'Selecionar certificado .pfx/.p12'}
                disabled={a1Busy}
                onPress={selectA1File}
              />
              <Text style={styles.label}>Senha do certificado (não armazenada no IRON)</Text>
              <TextInput
                testID="fiscal-a1-password"
                accessibilityLabel="Senha do certificado A1"
                style={styles.input}
                value={a1Password}
                onChangeText={setA1Password}
                secureTextEntry
              />
              <ActionButton
                testID="fiscal-a1-upload"
                label={a1Busy ? 'Validando no cofre…' : a1Status === 'STORED' ? 'Substituir certificado no NFCore' : 'Enviar diretamente ao NFCore'}
                disabled={a1Busy || !a1File || !a1Password || !binding?.active ||
                  activation?.environment !== 'HOMOLOG'}
                onPress={() => { void uploadA1(); }}
              />
            </>
          ) : <Text style={styles.muted}>Cadastro A1 disponível pelo navegador Web autorizado.</Text>}
          <Text style={styles.muted}>Emissão fiscal oficial, município, provedor e conformidade profissional permanecem sem homologação externa.</Text>
        </View>
      ) : null}

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
              placeholderTextColor="#828A91"
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
              placeholderTextColor="#828A91"
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
              placeholderTextColor="#828A91"
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
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#24262B', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 280 },
  eyebrow: { color: '#67D6FF', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#EEF1F5', fontSize: 22, fontWeight: '900', marginTop: 3, marginBottom: 4 },
  muted: { color: '#A1A6AE', fontSize: 13, lineHeight: 18 },
  externalStatus: { minWidth: 230, flexBasis: 280, backgroundColor: '#1a1410', borderWidth: 1, borderColor: '#7a5b20', borderRadius: 11, padding: 10 },
  externalKicker: { color: '#c9a85b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  externalTitle: { color: '#EEF1F5', fontSize: 13, fontWeight: '900', marginTop: 3 },
  externalWarning: { color: '#fde68a', fontSize: 12, fontWeight: '900', marginTop: 2 },
  meta: { color: '#9299A1', fontSize: 11, lineHeight: 15, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 190, minWidth: 170, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#24262B', borderRadius: 11, padding: 9 },
  alertCard: { backgroundColor: '#1a1018', borderColor: '#7f2d3a' },
  kicker: { color: '#828A91', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  bigValue: { color: '#EEF1F5', fontSize: 20, fontWeight: '900', marginTop: 4 },
  section: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#24262B', borderRadius: 14, padding: 13, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  sectionHeadCopy: { flex: 1, minWidth: 240 },
  sectionTitle: { color: '#EEF1F5', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  bindingStatus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: '#08080A', borderWidth: 1, borderColor: '#24262B', borderRadius: 10, padding: 9, marginTop: 7 },
  bindingValue: { color: '#EEF1F5', fontSize: 12, fontWeight: '900' },
  activeBadge: { color: '#67D6FF', backgroundColor: '#142018', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  pendingBadge: { color: '#fde68a', backgroundColor: '#2a210d', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  field: { flexGrow: 1, flexBasis: 260, minWidth: 220 },
  label: { color: '#A1A6AE', fontSize: 12, fontWeight: '800', marginTop: 7, marginBottom: 4 },
  input: { color: '#EEF1F5', backgroundColor: '#08080A', borderWidth: 1, borderColor: '#252A2B', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  textArea: { minHeight: 82, textAlignVertical: 'top' },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#19B95D', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  secondaryButton: { backgroundColor: '#101416', borderWidth: 1, borderColor: '#292C31' },
  dangerButton: { borderColor: '#7f2d3a' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, marginBottom: 4 },
  chip: { minHeight: 36, justifyContent: 'center', backgroundColor: '#08080A', borderWidth: 1, borderColor: '#292C31', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#12271B', borderColor: '#2F91FF' },
  chipText: { color: '#DDE3E4', fontSize: 12, fontWeight: '800' },
  handoff: { backgroundColor: '#08080A', borderWidth: 1, borderColor: '#24262B', borderRadius: 11, padding: 10, marginTop: 7 },
  handoffHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  handoffCopy: { flex: 1, minWidth: 220 },
  rowTitle: { color: '#EEF1F5', fontSize: 12, fontWeight: '900' },
  statusBadge: { alignSelf: 'flex-start', color: '#67D6FF', backgroundColor: '#142018', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  failedBadge: { alignSelf: 'flex-start', color: '#fecaca', backgroundColor: '#301215', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  cancelledBadge: { alignSelf: 'flex-start', color: '#CDD4D6', backgroundColor: '#181C1B', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  fact: { flexGrow: 1, flexBasis: 160, minWidth: 140, backgroundColor: '#0F0F12', borderRadius: 8, padding: 7 },
  factValue: { color: '#DDE3E4', fontSize: 12, fontWeight: '800', marginTop: 2 },
  failureText: { color: '#fca5a5', fontSize: 11, lineHeight: 15, marginTop: 7 },
  cancelBox: { backgroundColor: '#160d12', borderWidth: 1, borderColor: '#5a3340', borderRadius: 9, padding: 9, marginTop: 8 },
  cancelTitle: { color: '#fecaca', fontSize: 12, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { color: '#828A91', fontSize: 12, paddingVertical: 9 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#67D6FF', backgroundColor: '#121719', borderWidth: 1, borderColor: '#1E4F34', padding: 9, borderRadius: 9, marginBottom: 8 },
});
