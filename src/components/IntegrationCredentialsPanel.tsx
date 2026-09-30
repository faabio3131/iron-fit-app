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
import { API_URL } from '../config/env';
import { api } from '../services/api';
import { IronInput as TextInput } from './IronInput';

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

type PublicConfigRow = {
  id: string;
  key: string;
  value: string;
};

const EMPTY_STEP: StepUp = { currentPassword: '', mfaCode: '', recoveryCode: '' };
const FORBIDDEN_PUBLIC_KEY = /(secret|token|password|passwd|api[_-]?key|client[_-]?secret|private[_-]?key|credential|authorization|cvv|cvc|card[_-]?number|pan)/i;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function providerLabel(value: string) {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function capabilityLabel(value: string) {
  const parts = value.split(/[.:_-]+/).filter(Boolean);
  const useful = parts.length > 1 ? parts.slice(1) : parts;
  return useful
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const authModelLabels: Record<string, string> = {
  API_KEY: 'Chave de API',
  ACCESS_TOKEN: 'Token de acesso',
  OAUTH2: 'OAuth 2.0',
  BASIC: 'Usuário e senha',
  CERTIFICATE: 'Certificado',
  WEBHOOK_SECRET: 'Segredo de webhook',
  CUSTOM: 'Credencial personalizada',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Aguardando conclusão',
  ACTIVE: 'Ativa',
  DEGRADED: 'Atenção necessária',
  SUSPENDED: 'Suspensa',
  DISCONNECTED: 'Desconectada',
};

const environmentLabels: Record<string, string> = {
  DEV: 'Desenvolvimento',
  HOMOLOG: 'Homologação',
  PROD: 'Produção',
};

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

function rowId() {
  return Math.random().toString(36).slice(2, 10);
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
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#71879e"
      />
    </View>
  );
}

function PlainField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#71879e"
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  danger,
  secondary,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.danger,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function IntegrationCredentialsPanel({
  canStartOAuth = false,
}: {
  canStartOAuth?: boolean;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [environment, setEnvironment] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProviderCode, setSelectedProviderCode] = useState('');
  const [authModel, setAuthModel] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [publicConfigRows, setPublicConfigRows] = useState<PublicConfigRow[]>([
    { id: rowId(), key: '', value: '' },
  ]);
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

  const environmentAllowed = useMemo(
    () => !!selectedProvider && selectedProvider.environments.includes(environment),
    [environment, selectedProvider],
  );

  const oauthMode = !!selectedProvider?.supportsOAuth && authModel === 'OAUTH2';

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
    setPublicConfigRows([{ id: rowId(), key: '', value: '' }]);
    setSecret('');
    setStepUp(EMPTY_STEP);
    setError('');
    setNotice('');
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

  function buildPublicConfiguration() {
    const configuration: Record<string, string> = {};
    for (const row of publicConfigRows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key && !value) continue;
      if (!key || !value) {
        throw new Error('Preencha chave e valor em cada configuração pública.');
      }
      if (FORBIDDEN_PUBLIC_KEY.test(key)) {
        throw new Error('Dados sensíveis devem ser informados somente no campo de credencial protegida.');
      }
      if (Object.prototype.hasOwnProperty.call(configuration, key)) {
        throw new Error('Existe uma chave de configuração pública duplicada.');
      }
      configuration[key] = value;
    }
    return configuration;
  }

  function updatePublicRow(id: string, field: 'key' | 'value', value: string) {
    setPublicConfigRows((rows) =>
      rows.map((row) => row.id === id ? { ...row, [field]: value } : row),
    );
  }

  function removePublicRow(id: string) {
    setPublicConfigRows((rows) => {
      const next = rows.filter((row) => row.id !== id);
      return next.length ? next : [{ id: rowId(), key: '', value: '' }];
    });
  }

  async function createConnection() {
    if (!selectedProvider || !authModel || !secret || !stepUp.currentPassword) {
      setError('Preencha provedor, autenticação, credencial e reautenticação.');
      return;
    }
    if (!environmentAllowed) {
      setError('Este provedor não está disponível no ambiente atual do IRON.');
      return;
    }

    let publicConfiguration: Record<string, string>;
    try {
      publicConfiguration = buildPublicConfiguration();
    } catch (reason) {
      setError(errorMessage(reason));
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
          publicConfiguration,
          secret,
          ...stepPayload(stepUp),
        }),
      });
      setNotice('Integração salva no Cofre IRON. A credencial não será exibida novamente.');
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSecret('');
      setStepUp(EMPTY_STEP);
      setSaving(false);
    }
  }

  async function startOAuth() {
    if (!selectedProvider || !oauthMode || !stepUp.currentPassword) {
      setError('Selecione o provedor e confirme sua identidade para iniciar o OAuth.');
      return;
    }
    if (!canStartOAuth) {
      setError('A conexão OAuth deve ser iniciada pelo proprietário da academia.');
      return;
    }
    if (!environmentAllowed) {
      setError('Este provedor não está disponível no ambiente atual do IRON.');
      return;
    }
    if (!capabilities.length) {
      setError('Selecione pelo menos um recurso para a autorização OAuth.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api(
        `/integrations/oauth/${selectedProvider.providerCode}/start`,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            redirectUri: `${API_URL}/integrations/oauth/${selectedProvider.providerCode}/callback`,
            capabilities,
            ...stepPayload(stepUp),
          }),
        },
      );
      if (typeof result?.authorizationUrl !== 'string' || !result.authorizationUrl) {
        throw new Error('O servidor não retornou a URL segura de autorização.');
      }
      setNotice('Autorização iniciada. Conclua o consentimento no provedor e depois atualize esta tela.');
      setStepUp(EMPTY_STEP);
      await Linking.openURL(result.authorizationUrl);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
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
          ? 'Credencial substituída no Cofre IRON.'
          : action === 'rotate'
            ? 'Credencial rotacionada no Cofre IRON.'
            : action === 'verify'
              ? 'Conexão validada pelo provedor.'
              : 'Conexão revogada e bloqueada para uso.',
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
        <Text style={styles.muted}>Carregando integrações da academia…</Text>
      </View>
    );
  }

  return (
    <View testID="integration-credentials-panel">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>INTEGRATION CENTER</Text>
          <Text style={styles.heroTitle}>Integrações da academia</Text>
          <Text style={styles.muted}>
            Conecte serviços autorizados sem expor segredos. Credenciais ficam protegidas no Cofre IRON.
          </Text>
        </View>
        <View style={styles.environmentCard}>
          <Text style={styles.environmentLabel}>Ambiente do IRON</Text>
          <Text style={styles.environmentValue}>{environmentLabels[environment] ?? environment ?? 'Indisponível'}</Text>
          <Text style={styles.environmentMeta}>Definido pelo servidor</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Escolha um provedor</Text>
        <Text style={styles.muted}>As opções abaixo vêm do catálogo canônico do backend e respeitam seu plano.</Text>
        {providers.length === 0 ? (
          <Text style={styles.empty}>Nenhum provedor registrado para este ambiente.</Text>
        ) : (
          <View style={styles.providerGrid}>
            {providers.map((provider) => {
              const active = selectedProviderCode === provider.providerCode;
              const availableHere = provider.environments.includes(environment);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !availableHere }}
                  key={provider.providerCode}
                  testID={`integration-provider-${provider.providerCode}`}
                  style={[styles.providerCard, active && styles.providerCardActive, !availableHere && styles.providerCardDisabled]}
                  onPress={() => selectProvider(provider)}
                  disabled={!availableHere}
                >
                  <Text style={styles.providerName}>{providerLabel(provider.providerCode)}</Text>
                  <Text style={styles.providerMeta}>
                    {provider.supportsOAuth ? 'OAuth disponível' : 'Credencial protegida'}
                    {provider.supportsWebhook ? ' · Webhooks' : ''}
                  </Text>
                  <Text style={styles.providerMeta}>
                    {availableHere ? 'Disponível neste ambiente' : 'Indisponível neste ambiente'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {selectedProvider ? (
        <View style={styles.section}>
          <Text style={styles.title}>Configurar {providerLabel(selectedProvider.providerCode)}</Text>
          <Text style={styles.muted}>
            {selectedProvider.tenantEntitlementFeatureKey
              ? 'Disponibilidade sujeita ao plano e às configurações da academia.'
              : 'Disponibilidade definida pelo catálogo de integrações do IRON.'}
          </Text>

          <Text style={styles.label}>Forma de conexão</Text>
          <View style={styles.chips}>
            {selectedProvider.authModels.map((model) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: authModel === model }}
                key={model}
                style={[styles.chip, authModel === model && styles.chipActive]}
                onPress={() => setAuthModel(model)}
              >
                <Text style={styles.chipText}>{authModelLabels[model] ?? providerLabel(model)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Recursos autorizados</Text>
          <View style={styles.chips}>
            {selectedProvider.capabilities.map((capability) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: capabilities.includes(capability) }}
                key={capability}
                style={[styles.chip, capabilities.includes(capability) && styles.chipActive]}
                onPress={() => toggleCapability(capability)}
              >
                <Text style={styles.chipText}>{capabilityLabel(capability)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {oauthMode ? (
            <View style={styles.oauthCard}>
              <Text style={styles.subTitle}>Conexão OAuth</Text>
              <Text style={styles.muted}>
                O IRON solicitará somente os recursos selecionados. Tokens recebidos ficam no Cofre IRON e não são exibidos nesta tela.
              </Text>
              {!canStartOAuth ? (
                <Text style={styles.helper}>A autorização OAuth deve ser iniciada pelo proprietário da academia.</Text>
              ) : null}
              <SecretField
                testID="integration-oauth-current-password"
                label="Senha atual — reautenticação"
                value={stepUp.currentPassword}
                onChangeText={(currentPassword) => setStepUp((value) => ({ ...value, currentPassword }))}
              />
              <PlainField
                label="Código de autenticação multifator (se habilitado)"
                value={stepUp.mfaCode}
                onChangeText={(mfaCode) => setStepUp((value) => ({ ...value, mfaCode }))}
                placeholder="000000"
              />
              <SecretField
                label="Código de recuperação (alternativa ao MFA)"
                value={stepUp.recoveryCode}
                onChangeText={(recoveryCode) => setStepUp((value) => ({ ...value, recoveryCode }))}
              />
              <ActionButton
                testID="integration-oauth-start"
                label={saving ? 'Abrindo autorização…' : 'Conectar com OAuth'}
                disabled={saving || !canStartOAuth || !stepUp.currentPassword || !capabilities.length}
                onPress={() => { void startOAuth(); }}
              />
            </View>
          ) : (
            <View>
              <Text style={styles.subTitle}>Configuração pública</Text>
              <Text style={styles.muted}>Adicione somente dados não sensíveis. Chaves, tokens e senhas devem ficar no campo protegido abaixo.</Text>
              {publicConfigRows.map((row) => (
                <View key={row.id} style={styles.configRow}>
                  <View style={styles.configField}>
                    <PlainField
                      label="Campo"
                      value={row.key}
                      onChangeText={(value) => updatePublicRow(row.id, 'key', value)}
                      placeholder="Ex.: unidade"
                    />
                  </View>
                  <View style={styles.configField}>
                    <PlainField
                      label="Valor público"
                      value={row.value}
                      onChangeText={(value) => updatePublicRow(row.id, 'value', value)}
                      placeholder="Valor não sensível"
                    />
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.removeButton}
                    onPress={() => removePublicRow(row.id)}
                  >
                    <Text style={styles.removeButtonText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <ActionButton
                secondary
                label="Adicionar campo público"
                onPress={() => setPublicConfigRows((rows) => [...rows, { id: rowId(), key: '', value: '' }])}
              />

              <SecretField
                testID="integration-create-secret"
                label="Credencial protegida"
                value={secret}
                onChangeText={setSecret}
              />
              <SecretField
                testID="integration-create-current-password"
                label="Senha atual — reautenticação"
                value={stepUp.currentPassword}
                onChangeText={(currentPassword) => setStepUp((value) => ({ ...value, currentPassword }))}
              />
              <PlainField
                label="Código de autenticação multifator (se habilitado)"
                value={stepUp.mfaCode}
                onChangeText={(mfaCode) => setStepUp((value) => ({ ...value, mfaCode }))}
                placeholder="000000"
              />
              <SecretField
                label="Código de recuperação (alternativa ao MFA)"
                value={stepUp.recoveryCode}
                onChangeText={(recoveryCode) => setStepUp((value) => ({ ...value, recoveryCode }))}
              />
              <ActionButton
                testID="integration-create"
                label={saving ? 'Salvando…' : 'Salvar integração'}
                disabled={saving || !secret || !stepUp.currentPassword || !capabilities.length || !environmentAllowed}
                onPress={() => { void createConnection(); }}
              />
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.title}>Conexões configuradas</Text>
        <Text style={styles.muted}>Status operacional e ciclo de credenciais do tenant atual.</Text>
        {connections.length === 0 ? (
          <Text style={styles.empty}>Nenhuma conexão configurada para esta academia.</Text>
        ) : connections.map((connection) => (
          <View key={connection.id} style={styles.connection}>
            <View style={styles.connectionHead}>
              <View style={styles.connectionCopy}>
                <Text style={styles.connectionTitle}>{providerLabel(connection.providerCode)}</Text>
                <Text style={styles.connectionMeta}>
                  {statusLabels[connection.status] ?? providerLabel(connection.status)}
                  {' · '}
                  {environmentLabels[connection.environment] ?? connection.environment}
                  {' · '}
                  {authModelLabels[connection.authModel] ?? providerLabel(connection.authModel)}
                </Text>
              </View>
              <Text style={connection.credentialConfigured ? styles.vaultBadge : styles.pendingBadge}>
                {connection.credentialConfigured ? 'Protegida no Cofre IRON' : 'Credencial pendente'}
              </Text>
            </View>

            <View style={styles.capabilityRow}>
              {(connection.capabilities ?? []).map((capability) => (
                <Text key={capability} style={styles.capabilityBadge}>{capabilityLabel(capability)}</Text>
              ))}
            </View>

            <View style={styles.connectionFacts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Versão da credencial</Text>
                <Text style={styles.factValue}>{connection.secretVersion ?? '—'}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Última rotação</Text>
                <Text style={styles.factValue}>{formatDate(connection.secretRotatedAt)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Última verificação</Text>
                <Text style={styles.factValue}>{formatDate(connection.lastVerifiedAt)}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Expiração</Text>
                <Text style={styles.factValue}>{formatDate(connection.secretExpiresAt)}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              {connection.authModel !== 'OAUTH2' ? (
                <>
                  <ActionButton label="Substituir" onPress={() => beginAction(connection.id, 'replace')} />
                  <ActionButton label="Rotacionar" onPress={() => beginAction(connection.id, 'rotate')} />
                </>
              ) : null}
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
                  ? 'Testar conexão no provedor'
                  : 'Revogar conexão'}
          </Text>
          <Text style={styles.muted}>Esta é uma alteração sensível e exige reautenticação.</Text>
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
            onChangeText={(currentPassword) => setActionStepUp((value) => ({ ...value, currentPassword }))}
          />
          <PlainField
            label="Código de autenticação multifator (se habilitado)"
            value={actionStepUp.mfaCode}
            onChangeText={(mfaCode) => setActionStepUp((value) => ({ ...value, mfaCode }))}
            placeholder="000000"
          />
          <SecretField
            label="Código de recuperação"
            value={actionStepUp.recoveryCode}
            onChangeText={(recoveryCode) => setActionStepUp((value) => ({ ...value, recoveryCode }))}
          />
          <View style={styles.actions}>
            <ActionButton
              testID="integration-action-confirm"
              danger={action === 'revoke'}
              label={saving ? 'Confirmando…' : 'Confirmar'}
              disabled={saving || !actionStepUp.currentPassword}
              onPress={() => { void executeAction(); }}
            />
            <ActionButton
              secondary
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
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 9 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  heroTitle: { color: '#eef7ff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4, marginBottom: 4 },
  environmentCard: { minWidth: 170, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  environmentLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  environmentValue: { color: '#eef7ff', fontSize: 14, fontWeight: '900', marginTop: 3 },
  environmentMeta: { color: '#71879e', fontSize: 9, marginTop: 2 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 9 },
  title: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  subTitle: { color: '#dce9f6', fontSize: 13, fontWeight: '900', marginTop: 8, marginBottom: 3 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginBottom: 6 },
  helper: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 9, padding: 8, fontSize: 10, marginBottom: 7 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 8 },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 7 },
  providerCard: { flexGrow: 1, flexBasis: 210, minWidth: 190, maxWidth: 330, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  providerCardActive: { borderColor: '#2f91ff', backgroundColor: '#071a31' },
  providerCardDisabled: { opacity: 0.42 },
  providerName: { color: '#eef7ff', fontSize: 13, fontWeight: '900' },
  providerMeta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  label: { color: '#9fb0c5', fontSize: 10, fontWeight: '800', marginTop: 8, marginBottom: 5 },
  field: { marginBottom: 7 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  oauthCard: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10, marginTop: 6 },
  configRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#17263a', paddingTop: 7, marginTop: 4 },
  configField: { flexGrow: 1, flexBasis: 180, minWidth: 160 },
  removeButton: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, marginBottom: 7 },
  removeButtonText: { color: '#dce9f6', fontSize: 9, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  button: { backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  buttonSecondary: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  danger: { backgroundColor: '#7f1d1d' },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  disabled: { opacity: 0.42 },
  connection: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10, marginTop: 7 },
  connectionHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  connectionCopy: { flex: 1, minWidth: 220 },
  connectionTitle: { color: '#eef7ff', fontWeight: '900', fontSize: 13 },
  connectionMeta: { color: '#8296ab', fontSize: 9, marginTop: 3 },
  vaultBadge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800' },
  pendingBadge: { color: '#fde68a', backgroundColor: '#2a210d', borderWidth: 1, borderColor: '#785e13', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800' },
  capabilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  capabilityBadge: { color: '#dce9f6', backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '700' },
  connectionFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  fact: { flexGrow: 1, flexBasis: 130, minWidth: 110, backgroundColor: '#071528', borderRadius: 8, padding: 7 },
  factLabel: { color: '#71879e', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  factValue: { color: '#dce9f6', fontSize: 10, fontWeight: '800', marginTop: 2 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 9, borderRadius: 9, marginBottom: 8 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
