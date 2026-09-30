import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';

type Provider = {
  providerCode: string;
  capabilities: string[];
  authModels: string[];
  environments: string[];
  supportsWebhook: boolean;
  supportsOAuth: boolean;
  tenantEntitlementFeatureKey?: string | null;
};

type Connection = {
  id: string;
  providerCode: string;
  environment: string;
  authModel: string;
  status: string;
  capabilities: string[];
  publicConfiguration: Record<string, unknown> | null;
  credentialConfigured: boolean;
  secretVersion: number | null;
  secretRotatedAt: string | null;
  secretExpiresAt: string | null;
  secretLastUsedAt: string | null;
  secretRevokedAt: string | null;
  lastVerifiedAt: string | null;
};

type StepUp = {
  currentPassword: string;
  mfaCode: string;
  recoveryCode: string;
};

const EMPTY_STEP: StepUp = { currentPassword: '', mfaCode: '', recoveryCode: '' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function SecretField({
  label,
  value,
  onChangeText,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#9fb0c5"
      />
    </View>
  );
}

function PlainField({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#9fb0c5"
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.button, danger && styles.danger, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function IntegrationCredentialsPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [environment, setEnvironment] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProviderCode, setSelectedProviderCode] = useState('');
  const [authModel, setAuthModel] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [publicConfiguration, setPublicConfiguration] = useState('{}');
  const [secret, setSecret] = useState('');
  const [stepUp, setStepUp] = useState<StepUp>(EMPTY_STEP);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [action, setAction] = useState<'replace' | 'rotate' | 'verify' | 'revoke' | ''>('');
  const [replacementSecret, setReplacementSecret] = useState('');
  const [actionStepUp, setActionStepUp] = useState<StepUp>(EMPTY_STEP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedProvider = useMemo(
    () => providers.find((item) => item.providerCode === selectedProviderCode) ?? null,
    [providers, selectedProviderCode],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalog, current] = await Promise.all([
        api('/integrations/providers'),
        api('/integrations/connections'),
      ]);
      const nextProviders = Array.isArray(catalog?.providers) ? catalog.providers : [];
      setProviders(nextProviders);
      setEnvironment(typeof catalog?.environment === 'string' ? catalog.environment : '');
      setConnections(Array.isArray(current) ? current : []);
      if (!selectedProviderCode && nextProviders.length > 0) {
        const first = nextProviders[0];
        setSelectedProviderCode(first.providerCode);
        setAuthModel(first.authModels?.[0] ?? '');
        setCapabilities(Array.isArray(first.capabilities) ? [...first.capabilities] : []);
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [selectedProviderCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function selectProvider(provider: Provider) {
    setSelectedProviderCode(provider.providerCode);
    setAuthModel(provider.authModels?.[0] ?? '');
    setCapabilities(Array.isArray(provider.capabilities) ? [...provider.capabilities] : []);
    setPublicConfiguration('{}');
    setSecret('');
    setStepUp(EMPTY_STEP);
  }

  function toggleCapability(value: string) {
    setCapabilities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function stepPayload(value: StepUp) {
    return {
      currentPassword: value.currentPassword,
      ...(value.mfaCode.trim() ? { mfaCode: value.mfaCode.trim() } : {}),
      ...(value.recoveryCode.trim()
        ? { recoveryCode: value.recoveryCode.trim().toUpperCase() }
        : {}),
    };
  }

  async function createConnection() {
    if (!selectedProvider || !authModel || !secret || !stepUp.currentPassword) {
      setError('Preencha provedor, autenticação, credencial e reautenticação.');
      return;
    }

    let publicConfig: Record<string, unknown>;
    try {
      const parsed = JSON.parse(publicConfiguration || '{}');
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error();
      }
      publicConfig = parsed;
    } catch {
      setError('Configuração pública deve ser um objeto JSON válido sem segredos.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/integrations/connections', undefined, {
        method: 'POST',
        body: JSON.stringify({
          providerCode: selectedProvider.providerCode,
          authModel,
          capabilities,
          publicConfiguration: publicConfig,
          secret,
          ...stepPayload(stepUp),
        }),
      });
      setNotice('Credencial salva no cofre. O valor não será exibido novamente.');
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSecret('');
      setStepUp(EMPTY_STEP);
      setSaving(false);
    }
  }

  function beginAction(
    connectionId: string,
    next: 'replace' | 'rotate' | 'verify' | 'revoke',
  ) {
    setSelectedConnectionId(connectionId);
    setAction(next);
    setReplacementSecret('');
    setActionStepUp(EMPTY_STEP);
    setError('');
    setNotice('');
  }

  async function executeAction() {
    if (!selectedConnectionId || !action || !actionStepUp.currentPassword) {
      setError('Informe a senha atual para confirmar esta alteração.');
      return;
    }
    if ((action === 'replace' || action === 'rotate') && !replacementSecret) {
      setError('Informe a nova credencial.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api(`/integrations/connections/${selectedConnectionId}/${action}`, undefined, {
        method: 'POST',
        body: JSON.stringify({
          ...stepPayload(actionStepUp),
          ...((action === 'replace' || action === 'rotate')
            ? { secret: replacementSecret }
            : {}),
        }),
      });
      setNotice(
        action === 'replace'
          ? 'Credencial substituída. O novo valor não será exibido.'
          : action === 'rotate'
            ? 'Credencial rotacionada. O novo valor não será exibido.'
            : action === 'verify'
              ? 'Credencial validada pelo provedor.'
              : 'Credencial revogada e bloqueada para uso.',
      );
      setAction('');
      setSelectedConnectionId('');
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setReplacementSecret('');
      setActionStepUp(EMPTY_STEP);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#2f91ff" />
        <Text style={styles.muted}>Carregando integrações configuráveis…</Text>
      </View>
    );
  }

  return (
    <View testID="integration-credentials-panel">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.title}>Integrações da academia</Text>
        <Text style={styles.muted}>
          Ambiente: {environment || 'indisponível'} · Definido pelo servidor. Academia derivada da sessão. Credenciais são somente para gravação.
        </Text>
        {providers.length === 0 ? (
          <Text style={styles.muted}>
            Nenhum provedor está registrado para este ambiente. Nenhuma integração será habilitada por código específico do cliente.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Provedor</Text>
            <View style={styles.chips}>
              {providers.map((provider) => (
                <TouchableOpacity
                  key={provider.providerCode}
                  style={[
                    styles.chip,
                    selectedProviderCode === provider.providerCode && styles.chipActive,
                  ]}
                  onPress={() => selectProvider(provider)}
                >
                  <Text style={styles.chipText}>{provider.providerCode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedProvider ? (
              <>
                {selectedProvider.tenantEntitlementFeatureKey ? (
                  <Text style={styles.muted}>
                    Recurso comercial exigido: {selectedProvider.tenantEntitlementFeatureKey}. A autorização efetiva vem do plano/configuração do tenant.
                  </Text>
                ) : null}
                <Text style={styles.label}>Modelo de autenticação</Text>
                <View style={styles.chips}>
                  {selectedProvider.authModels.map((model) => (
                    <TouchableOpacity
                      key={model}
                      style={[styles.chip, authModel === model && styles.chipActive]}
                      onPress={() => setAuthModel(model)}
                    >
                      <Text style={styles.chipText}>{model}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Recursos</Text>
                <View style={styles.chips}>
                  {selectedProvider.capabilities.map((capability) => (
                    <TouchableOpacity
                      key={capability}
                      style={[
                        styles.chip,
                        capabilities.includes(capability) && styles.chipActive,
                      ]}
                      onPress={() => toggleCapability(capability)}
                    >
                      <Text style={styles.chipText}>{capability}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <PlainField
                  label="Configuração pública (JSON) — nunca coloque credenciais aqui"
                  value={publicConfiguration}
                  onChangeText={setPublicConfiguration}
                  multiline
                />
                <SecretField
                  testID="integration-create-secret"
                  label="Credencial / token / segredo"
                  value={secret}
                  onChangeText={setSecret}
                />
                <SecretField
                  testID="integration-create-current-password"
                  label="Senha atual — reautenticação"
                  value={stepUp.currentPassword}
                  onChangeText={(currentPassword) => setStepUp((v) => ({ ...v, currentPassword }))}
                />
                <PlainField
                  label="Código MFA (se habilitado)"
                  value={stepUp.mfaCode}
                  onChangeText={(mfaCode) => setStepUp((v) => ({ ...v, mfaCode }))}
                />
                <SecretField
                  label="Código de recuperação (alternativa ao MFA)"
                  value={stepUp.recoveryCode}
                  onChangeText={(recoveryCode) => setStepUp((v) => ({ ...v, recoveryCode }))}
                />
                <ActionButton
                  testID="integration-create"
                  label={saving ? 'Salvando…' : 'Salvar integração'}
                  disabled={saving || capabilities.length === 0}
                  onPress={() => { void createConnection(); }}
                />
              </>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Conexões configuradas</Text>
        {connections.length === 0 ? (
          <Text style={styles.muted}>Nenhuma conexão configurada para esta academia neste ambiente.</Text>
        ) : connections.map((connection) => (
          <View key={connection.id} style={styles.connection}>
            <Text style={styles.connectionTitle}>{connection.providerCode}</Text>
            <Text style={styles.muted}>
              {connection.status} · {connection.environment} · {connection.authModel}
            </Text>
            <Text style={styles.muted}>
              Credencial: {connection.credentialConfigured ? 'configurada' : 'não configurada'}
              {connection.secretVersion ? ` · versão ${connection.secretVersion}` : ''}
            </Text>
            <Text style={styles.muted}>
              Rotação: {connection.secretRotatedAt ?? '—'} · Última verificação: {connection.lastVerifiedAt ?? '—'}
            </Text>
            <View style={styles.actions}>
              <ActionButton label="Substituir" onPress={() => beginAction(connection.id, 'replace')} />
              <ActionButton label="Rotacionar" onPress={() => beginAction(connection.id, 'rotate')} />
              <ActionButton label="Testar provedor" onPress={() => beginAction(connection.id, 'verify')} />
              <ActionButton danger label="Revogar" onPress={() => beginAction(connection.id, 'revoke')} />
            </View>
          </View>
        ))}
      </View>

      {action ? (
        <View style={styles.section} testID="integration-step-up-action">
          <Text style={styles.title}>
            {action === 'replace'
              ? 'Substituir credencial'
              : action === 'rotate'
                ? 'Rotacionar credencial'
                : action === 'verify'
                  ? 'Testar credencial no provedor'
                  : 'Revogar credencial'}
          </Text>
          {action === 'replace' || action === 'rotate' ? (
            <SecretField
              testID="integration-rotate-secret"
              label="Nova credencial"
              value={replacementSecret}
              onChangeText={setReplacementSecret}
            />
          ) : null}
          <SecretField
            label="Senha atual — reautenticação"
            value={actionStepUp.currentPassword}
            onChangeText={(currentPassword) => setActionStepUp((v) => ({ ...v, currentPassword }))}
          />
          <PlainField
            label="Código MFA (se habilitado)"
            value={actionStepUp.mfaCode}
            onChangeText={(mfaCode) => setActionStepUp((v) => ({ ...v, mfaCode }))}
          />
          <SecretField
            label="Código de recuperação"
            value={actionStepUp.recoveryCode}
            onChangeText={(recoveryCode) => setActionStepUp((v) => ({ ...v, recoveryCode }))}
          />
          <View style={styles.actions}>
            <ActionButton
              testID="integration-action-confirm"
              danger={action === 'revoke'}
              label={saving ? 'Confirmando…' : 'Confirmar'}
              disabled={saving}
              onPress={() => { void executeAction(); }}
            />
            <ActionButton
              label="Cancelar"
              disabled={saving}
              onPress={() => {
                setAction('');
                setSelectedConnectionId('');
                setReplacementSecret('');
                setActionStepUp(EMPTY_STEP);
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#203b55',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: '#eef7ff', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  muted: { color: '#9fb0c5', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { color: '#9fb0c5', fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 5 },
  field: { marginBottom: 8 },
  input: {
    color: '#eef7ff',
    backgroundColor: '#050b14',
    borderWidth: 1,
    borderColor: '#243247',
    borderRadius: 9,
    padding: 10,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: '#2e1f52', borderColor: '#2f91ff' },
  chipText: { color: '#cbd5e1', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10 },
  danger: { backgroundColor: '#991b1b' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.45 },
  connection: { backgroundColor: '#0c1220', borderWidth: 1, borderColor: '#202a3e', borderRadius: 10, padding: 12, marginTop: 8 },
  connectionTitle: { color: '#eef7ff', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  error: { color: '#fca5a5', backgroundColor: '#301215', padding: 10, borderRadius: 8, marginBottom: 10 },
  success: { color: '#4ade80', backgroundColor: '#0b2a1e', padding: 10, borderRadius: 8, marginBottom: 10 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
