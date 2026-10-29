import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { IronBrand } from '../components/IronBrand';
import { GlowCard } from '../components/GlowCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';

type PlatformConnection = {
  id: string;
  providerCode: string;
  status?: string;
  environment?: string;
  credentialConfigured?: boolean;
  publicConfiguration?: { baseUrl?: string; webhookUrl?: string } | null;
  lastVerifiedAt?: string | null;
  secretRotatedAt?: string | null;
};

const DEFAULT_EVOLUTION_URL = 'https://api.atendevendeia.com.br';

function messageOf(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
}

function when(value?: string | null) {
  if (!value) return 'ainda não';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'ainda não' : date.toLocaleString('pt-BR');
}

function SecretField({ label, value, onChangeText, testID, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; testID: string; placeholder?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        placeholder={placeholder}
        placeholderTextColor="#64748b"
      />
    </View>
  );
}

function TextField({ label, value, onChangeText, testID }: { label: string; value: string; onChangeText: (value: string) => void; testID: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#64748b"
      />
    </View>
  );
}

/**
 * Área de plataforma da FM Tecnologia para SUPER_ADMIN sem academia ativa.
 * Não consulta nenhum dado de academia: só a conexão global do WhatsApp (Evolution),
 * cujo segredo vai direto ao Cofre pelo backend e nunca volta para a tela.
 */
export function PlatformAdminWorkspace() {
  const { profile, logout } = useAuth();
  const [connection, setConnection] = useState<PlatformConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_EVOLUTION_URL);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api('/admin/integrations/connections');
      if (!mounted.current) return;
      const found = (Array.isArray(rows) ? rows : []).find((row: PlatformConnection) => row.providerCode === 'evolution' && !row.status?.startsWith('REVOKED')) ?? null;
      setConnection(found);
      if (found?.publicConfiguration?.baseUrl) setBaseUrl(found.publicConfiguration.baseUrl);
      if (found?.publicConfiguration?.webhookUrl) setWebhookUrl(found.publicConfiguration.webhookUrl);
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { void load(); }, 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [load]);

  const stepUp = () => ({ currentPassword: password, ...(mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}) });
  const canSubmit = !busy && password.length >= 6 && /^https:\/\//.test(baseUrl.trim()) && (!webhookUrl.trim() || /^https:\/\//.test(webhookUrl.trim()));

  function clearSensitive() {
    setApiKey('');
    setPassword('');
    setMfaCode('');
  }

  async function register() {
    if (!apiKey.trim()) {
      setError('Informe a chave da Evolution.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/admin/integrations/connections', undefined, {
        method: 'POST',
        body: JSON.stringify({
          providerCode: 'evolution',
          authModel: 'API_KEY',
          capabilities: ['evolution.whatsapp'],
          publicConfiguration: { baseUrl: baseUrl.trim(), ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}) },
          secret: apiKey.trim(),
          ...stepUp(),
        }),
      });
      clearSensitive();
      setNotice('Conexão registrada no Cofre. Use "Verificar" para testar.');
      await load();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function replaceKey() {
    if (!connection) return;
    if (!apiKey.trim()) {
      setError('Informe a nova chave da Evolution.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/admin/integrations/connections/${connection.id}/replace`, undefined, {
        method: 'POST',
        body: JSON.stringify({ secret: apiKey.trim(), ...stepUp() }),
      });
      clearSensitive();
      setNotice('Chave substituída no Cofre. Use "Verificar" para testar.');
      await load();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function verify() {
    if (!connection) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/admin/integrations/connections/${connection.id}/verify`, undefined, {
        method: 'POST',
        body: JSON.stringify(stepUp()),
      });
      setPassword('');
      setMfaCode('');
      setNotice('Verificação concluída.');
      await load();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const configured = !!connection?.credentialConfigured;

  return (
    <View style={styles.app} testID="platform-admin-workspace">
      <View style={styles.top}>
        <IronBrand compact />
        <View style={styles.topActions}>
          <Text numberOfLines={1} style={styles.muted}>{profile?.name ?? profile?.email ?? 'Administrador'}</Text>
          <TouchableOpacity accessibilityRole="button" testID="platform-logout" style={styles.secondary} onPress={() => { void logout(); }}>
            <Text style={styles.secondaryText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.title}>Plataforma FM Tecnologia</Text>
        <Text style={styles.muted}>
          Área exclusiva do SUPER_ADMIN. Aqui ficam as credenciais da FM, que as academias nunca veem. Os segredos vão direto ao Cofre e não voltam para a tela.
        </Text>

        <GlowCard style={styles.section}>
          <Text style={styles.sectionTitle}>WhatsApp central (Evolution)</Text>
          <Text style={styles.muted}>
            Credencial central da plataforma. O provisionamento de instâncias e a entrega de mensagens dependem de integração e homologação específicas.
          </Text>

          {loading ? <ActivityIndicator color={colors.accent} /> : (
            <View style={styles.statusBox} testID="platform-evolution-status">
              <Text style={[styles.badge, configured ? styles.badgeOn : styles.badgeOff]}>
                {configured ? 'Chave no Cofre' : 'Não configurada'}
              </Text>
              {configured ? (
                <Text style={styles.muted}>
                  Chave registrada em {when(connection?.secretRotatedAt)} · última verificação: {when(connection?.lastVerifiedAt)}
                </Text>
              ) : null}
            </View>
          )}

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {notice ? <Text style={styles.ok}>{notice}</Text> : null}

          <TextField label="Endereço da Evolution (HTTPS)" value={baseUrl} onChangeText={setBaseUrl} testID="platform-evolution-base-url" />
          <TextField label="Webhook HTTPS (opcional; somente endpoint verificado)" value={webhookUrl} onChangeText={setWebhookUrl} testID="platform-evolution-webhook-url" />
          <SecretField label={configured ? 'Nova chave da Evolution' : 'Chave da Evolution'} value={apiKey} onChangeText={setApiKey} testID="platform-evolution-key" />
          <Text style={styles.muted}>Confirmação de segurança</Text>
          <SecretField label="Sua senha de administrador" value={password} onChangeText={setPassword} testID="platform-evolution-password" />
          <SecretField label="Código do autenticador (se o MFA estiver ligado)" value={mfaCode} onChangeText={setMfaCode} testID="platform-evolution-mfa" />

          <View style={styles.actions}>
            {!configured ? (
              <TouchableOpacity accessibilityRole="button" testID="platform-evolution-register" disabled={!canSubmit || !apiKey.trim()} style={[styles.button, (!canSubmit || !apiKey.trim()) && styles.disabled]} onPress={() => { void register(); }}>
                <Text style={styles.buttonText}>{busy ? 'Salvando…' : 'Registrar no Cofre'}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity accessibilityRole="button" testID="platform-evolution-replace" disabled={!canSubmit || !apiKey.trim()} style={[styles.button, (!canSubmit || !apiKey.trim()) && styles.disabled]} onPress={() => { void replaceKey(); }}>
                  <Text style={styles.buttonText}>{busy ? 'Salvando…' : 'Substituir chave'}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" testID="platform-evolution-verify" disabled={!canSubmit} style={[styles.secondary, !canSubmit && styles.disabled]} onPress={() => { void verify(); }}>
                  <Text style={styles.secondaryText}>Verificar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </GlowCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#080c17' },
  top: { minHeight: 72, padding: 18, backgroundColor: '#101625', borderBottomWidth: 1, borderBottomColor: '#273248', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { flex: 1 },
  contentInner: { padding: 22, width: '100%', maxWidth: 900, alignSelf: 'center' },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 6 },
  section: { padding: 16, marginTop: 14 },
  sectionTitle: { color: colors.accent, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  statusBox: { marginVertical: 8, gap: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  badgeOn: { color: colors.accent, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  badgeOff: { color: '#fde68a', backgroundColor: '#2a210d', borderWidth: 1, borderColor: '#785e13' },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginVertical: 8 },
  ok: { color: colors.accent, fontSize: 12, fontWeight: '700', marginVertical: 8 },
  fieldWrap: { marginBottom: 10 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#273248', borderRadius: 9, color: '#f8fafc', backgroundColor: '#0d1321', paddingHorizontal: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 9, paddingHorizontal: 16 },
  buttonText: { color: colors.onAccent, fontWeight: '900', fontSize: 13 },
  secondary: { minHeight: 44, justifyContent: 'center', backgroundColor: '#101416', borderWidth: 1, borderColor: '#292C31', borderRadius: 9, paddingHorizontal: 16 },
  secondaryText: { color: '#EEF1F5', fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.45 },
});
