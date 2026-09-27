import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type ProviderDefinition = {
  providerCode: string;
  authModel: string;
  capabilities: string[];
  environments: string[];
  publicConfigurationKeys: string[];
  requiresSecret: boolean;
};

type Connection = {
  id: string;
  providerCode: string;
  environment: string;
  status: string;
  publicConfiguration?: Record<string, unknown> | null;
  secretConfigured: boolean;
  secretMetadata?: {
    version?: number;
    status?: string;
    expiresAt?: string | null;
    lastVerifiedAt?: string | null;
  } | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function parseObject(raw: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw || '{}');
  } catch {
    throw new Error(label + ' deve ser JSON válido.');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(label + ' deve ser um objeto JSON.');
  }
  return value as Record<string, unknown>;
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function Action({
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
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function IntegrationSettingsPanel() {
  const { profile } = useAuth();
  const roles = useMemo<string[]>(
    () => (Array.isArray(profile?.roles) ? profile.roles : []),
    [profile],
  );
  const owner = roles.includes('OWNER');

  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedConnection, setSelectedConnection] = useState('');
  const [environment, setEnvironment] = useState('DEV');
  const [publicConfiguration, setPublicConfiguration] = useState('{}');
  const [credentials, setCredentials] = useState('{}');
  const [expiresAt, setExpiresAt] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(
    () => connections.find((item) => item.id === selectedConnection) ?? null,
    [connections, selectedConnection],
  );

  const stepUp = useCallback(
    () => ({
      currentPassword,
      ...(mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}),
      ...(recoveryCode.trim() ? { recoveryCode: recoveryCode.trim() } : {}),
    }),
    [currentPassword, mfaCode, recoveryCode],
  );

  const clearSensitiveDrafts = useCallback(() => {
    setCredentials('{}');
    setCurrentPassword('');
    setMfaCode('');
    setRecoveryCode('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [providerRows, connectionRows] = await Promise.all([
        api('/integrations/providers'),
        api('/integrations/tenant/connections'),
      ]);
      setProviders(Array.isArray(providerRows) ? providerRows : []);
      setConnections(Array.isArray(connectionRows) ? connectionRows : []);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      clearSensitiveDrafts();
      setNotice(success);
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
      setCurrentPassword('');
      setMfaCode('');
      setRecoveryCode('');
    } finally {
      setBusy(false);
    }
  }

  function selectConnection(connection: Connection) {
    setSelectedConnection(connection.id);
    setPublicConfiguration(
      JSON.stringify(connection.publicConfiguration ?? {}, null, 2),
    );
    setCredentials('{}');
    setExpiresAt('');
    setNotice('');
    setError('');
  }

  async function createConnection() {
    if (!owner) return;
    if (!selectedProvider) throw new Error('Selecione um provider.');
    if (!currentPassword) throw new Error('Confirme sua senha atual.');
    const config = parseObject(publicConfiguration, 'Configuração pública');
    await run(
      () =>
        api('/integrations/tenant/connections', undefined, {
          method: 'POST',
          body: JSON.stringify({
            ...stepUp(),
            providerCode: selectedProvider,
            environment: environment.trim().toUpperCase(),
            publicConfiguration: config,
          }),
        }),
      'Conexão criada. Nenhum segredo foi exibido ou persistido no navegador.',
    );
  }

  async function updateConfiguration() {
    if (!owner || !selected) return;
    if (!currentPassword) throw new Error('Confirme sua senha atual.');
    const config = parseObject(publicConfiguration, 'Configuração pública');
    await run(
      () =>
        api(
          '/integrations/tenant/connections/' + selected.id + '/configuration',
          undefined,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...stepUp(),
              publicConfiguration: config,
            }),
          },
        ),
      'Configuração pública atualizada.',
    );
  }

  async function putSecret() {
    if (!owner || !selected) return;
    if (!currentPassword) throw new Error('Confirme sua senha atual.');
    const secret = parseObject(credentials, 'Credenciais');
    await run(
      () =>
        api(
          '/integrations/tenant/connections/' + selected.id + '/secret',
          undefined,
          {
            method: 'PUT',
            body: JSON.stringify({
              ...stepUp(),
              credentials: secret,
              ...(expiresAt.trim() ? { expiresAt: expiresAt.trim() } : {}),
            }),
          },
        ),
      selected.secretConfigured
        ? 'Credencial rotacionada. O valor anterior não pode mais ser lido pelo IRON.'
        : 'Credencial armazenada no cofre. O valor não pode ser recuperado pela interface.',
    );
  }

  async function verifySecret() {
    if (!owner || !selected) return;
    if (!currentPassword) throw new Error('Confirme sua senha atual.');
    await run(
      () =>
        api(
          '/integrations/tenant/connections/' + selected.id + '/secret/verify',
          undefined,
          {
            method: 'POST',
            body: JSON.stringify(stepUp()),
          },
        ),
      'A referência foi verificada no cofre sem revelar a credencial.',
    );
  }

  async function revokeSecret() {
    if (!owner || !selected) return;
    if (!currentPassword) throw new Error('Confirme sua senha atual.');
    await run(
      () =>
        api(
          '/integrations/tenant/connections/' + selected.id + '/secret',
          undefined,
          {
            method: 'DELETE',
            body: JSON.stringify(stepUp()),
          },
        ),
      'Credencial revogada.',
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#8b5cf6" />
        <Text style={styles.muted}>Carregando integrações seguras…</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>Integrações e credenciais</Text>
        <Text style={styles.muted}>
          Credenciais são write-only: depois de salvas, o IRON mostra apenas estado e
          metadados. Nenhuma tela possui ação “mostrar segredo”.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.success}>{notice}</Text> : null}
      </View>

      {owner ? (
        <View style={styles.card}>
          <Text style={styles.subtitle}>Nova conexão</Text>
          {providers.length ? (
            <View style={styles.chips}>
              {providers.map((provider) => (
                <TouchableOpacity
                  key={provider.providerCode}
                  onPress={() => setSelectedProvider(provider.providerCode)}
                  style={[
                    styles.chip,
                    selectedProvider === provider.providerCode && styles.chipActive,
                  ]}
                >
                  <Text style={styles.chipText}>{provider.providerCode}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>
              Nenhum adapter/provider está habilitado neste ambiente. Providers só
              aparecem depois de homologados e registrados no backend.
            </Text>
          )}
          <Field label="Ambiente" value={environment} onChangeText={setEnvironment} />
          <Field
            label="Configuração pública (JSON)"
            value={publicConfiguration}
            onChangeText={setPublicConfiguration}
            placeholder='{"accountId":"..."}'
          />
          <Field
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Field label="Código MFA (se habilitado)" value={mfaCode} onChangeText={setMfaCode} />
          <Field
            label="Recovery code (alternativa ao MFA)"
            value={recoveryCode}
            onChangeText={setRecoveryCode}
            secureTextEntry
          />
          <Action
            testID="integration-create"
            label="Criar conexão"
            disabled={busy || !selectedProvider || !currentPassword}
            onPress={() => void createConnection().catch((reason) => setError(errorMessage(reason)))}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.subtitle}>Conexões do tenant</Text>
        {!connections.length ? (
          <Text style={styles.muted}>Nenhuma conexão configurada.</Text>
        ) : (
          connections.map((connection) => (
            <TouchableOpacity
              testID={'integration-row-' + connection.id}
              key={connection.id}
              onPress={() => selectConnection(connection)}
              style={[
                styles.connection,
                selectedConnection === connection.id && styles.connectionActive,
              ]}
            >
              <Text style={styles.connectionTitle}>{connection.providerCode}</Text>
              <Text style={styles.muted}>
                {connection.environment} · {connection.status} · credencial:{' '}
                {connection.secretConfigured ? 'configurada' : 'não configurada'}
              </Text>
              {connection.secretMetadata?.version ? (
                <Text style={styles.muted}>
                  Versão {connection.secretMetadata.version}
                  {connection.secretMetadata.lastVerifiedAt
                    ? ' · verificada em ' + connection.secretMetadata.lastVerifiedAt
                    : ''}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </View>

      {owner && selected ? (
        <View style={styles.card}>
          <Text style={styles.subtitle}>Gerenciar {selected.providerCode}</Text>
          <Text style={styles.muted}>
            Alterações exigem reautenticação. O valor secreto nunca é carregado nesta tela.
          </Text>
          <Field
            label="Configuração pública (JSON)"
            value={publicConfiguration}
            onChangeText={setPublicConfiguration}
          />
          <Field
            label="Credenciais write-only (JSON)"
            value={credentials}
            onChangeText={setCredentials}
            secureTextEntry
            placeholder='{"apiKey":"..."}'
          />
          <Field
            label="Expiração ISO (opcional)"
            value={expiresAt}
            onChangeText={setExpiresAt}
            placeholder="2027-01-01T00:00:00Z"
          />
          <Field
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Field label="Código MFA (se habilitado)" value={mfaCode} onChangeText={setMfaCode} />
          <Field
            label="Recovery code"
            value={recoveryCode}
            onChangeText={setRecoveryCode}
            secureTextEntry
          />
          <View style={styles.actions}>
            <Action
              label="Salvar configuração"
              secondary
              disabled={busy || !currentPassword}
              onPress={() => void updateConfiguration().catch((reason) => setError(errorMessage(reason)))}
            />
            <Action
              testID="integration-secret-put"
              label={selected.secretConfigured ? 'Rotacionar credencial' : 'Salvar credencial'}
              disabled={busy || !currentPassword}
              onPress={() => void putSecret().catch((reason) => setError(errorMessage(reason)))}
            />
            <Action
              testID="integration-secret-verify"
              label="Verificar referência"
              secondary
              disabled={busy || !selected.secretConfigured || !currentPassword}
              onPress={() => void verifySecret().catch((reason) => setError(errorMessage(reason)))}
            />
            <Action
              testID="integration-secret-revoke"
              label="Revogar credencial"
              danger
              disabled={busy || !selected.secretConfigured || !currentPassword}
              onPress={() => void revokeSecret().catch((reason) => setError(errorMessage(reason)))}
            />
          </View>
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
    gap: 8,
  },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  error: { color: '#fca5a5', backgroundColor: '#301215', padding: 10, borderRadius: 8 },
  success: { color: '#4ade80', fontWeight: '700' },
  field: { marginTop: 5 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  input: {
    color: '#f8fafc',
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#2a3650',
    borderRadius: 9,
    padding: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#2e1f52', borderColor: '#8b5cf6' },
  chipText: { color: '#cbd5e1', fontSize: 12 },
  connection: {
    backgroundColor: '#0c1220',
    borderWidth: 1,
    borderColor: '#202a3e',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  connectionActive: { borderColor: '#8b5cf6', backgroundColor: '#17112b' },
  connectionTitle: { color: '#f1f5f9', fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  danger: { backgroundColor: '#7f1d1d', borderWidth: 1, borderColor: '#b91c1c' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
