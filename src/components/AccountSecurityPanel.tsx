import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';
import { IronInput as TextInput } from './IronInput';

type SecurityTab = 'account' | 'mfa' | 'sessions';

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

function Field({
  label,
  value,
  onChangeText,
  secure,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  placeholder?: string;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor="#71879e"
        autoCapitalize="none"
      />
    </View>
  );
}

function Button({
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
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AccountSecurityPanel({ onBack }: { onBack?: () => void }) {
  const { profile, logout, refreshProfile } = useAuth();
  const [tab, setTab] = useState<SecurityTab>('account');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [secondFactor, setSecondFactor] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const loadSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const value = await api('/auth/sessions');
      setSessions(Array.isArray(value) ? value : []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar sessões.');
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSessions]);

  const activeSessions = useMemo(
    () => sessions.filter((session) => session.active).length,
    [sessions],
  );

  const currentSession = useMemo(
    () => sessions.find((session) => session.current) ?? null,
    [sessions],
  );

  function stepUpBody() {
    const factor = secondFactor.trim();
    return {
      currentPassword,
      ...(factor
        ? /^\d{6}$/.test(factor)
          ? { mfaCode: factor }
          : { recoveryCode: factor.toUpperCase() }
        : {}),
    };
  }

  async function execute(operation: () => Promise<void>) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    await execute(async () => {
      await api('/auth/password/change', undefined, {
        method: 'POST',
        body: JSON.stringify({
          ...stepUpBody(),
          newPassword,
        }),
      });
      setNotice('Senha alterada. As sessões anteriores foram revogadas.');
      await logout().catch(() => undefined);
    });
  }

  async function requestEmailChange() {
    await execute(async () => {
      await api('/auth/email/change/request', undefined, {
        method: 'POST',
        body: JSON.stringify({
          ...stepUpBody(),
          newEmail: newEmail.trim().toLowerCase(),
        }),
      });
      setNotice('Solicitação registrada. Use o código enviado ao novo e-mail para concluir.');
    });
  }

  async function confirmEmailChange() {
    await execute(async () => {
      await api('/auth/email/change/confirm', undefined, {
        method: 'POST',
        body: JSON.stringify({ token: emailToken.trim() }),
      });
      setNotice('E-mail alterado. As sessões anteriores foram revogadas.');
      await logout().catch(() => undefined);
    });
  }

  async function setupMfa() {
    await execute(async () => {
      const result = await api('/auth/mfa/setup', undefined, {
        method: 'POST',
        body: JSON.stringify({ currentPassword }),
      });
      setMfaSecret(String(result?.secret ?? ''));
      setMfaUri(String(result?.otpauthUri ?? ''));
      setNotice('Configuração iniciada. Adicione a conta ao autenticador e confirme o código.');
    });
  }

  async function confirmMfa() {
    await execute(async () => {
      const result = await api('/auth/mfa/confirm', undefined, {
        method: 'POST',
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      setRecoveryCodes(
        Array.isArray(result?.recoveryCodes) ? result.recoveryCodes : [],
      );
      setMfaSecret('');
      setMfaUri('');
      await refreshProfile();
      setNotice('MFA habilitado. Salve os códigos de recuperação desta exibição única.');
    });
  }

  async function disableMfa() {
    await execute(async () => {
      await api('/auth/mfa/disable', undefined, {
        method: 'POST',
        body: JSON.stringify(stepUpBody()),
      });
      setNotice('MFA desabilitado. As sessões anteriores foram revogadas.');
      await logout().catch(() => undefined);
    });
  }

  async function revokeSession(sessionId: string, current: boolean) {
    await execute(async () => {
      await api('/auth/sessions/revoke', undefined, {
        method: 'POST',
        body: JSON.stringify({ ...stepUpBody(), sessionId }),
      });
      if (current) {
        await logout().catch(() => undefined);
        return;
      }
      await loadSessions();
      setNotice('Sessão revogada.');
    });
  }

  async function revokeOthers() {
    await execute(async () => {
      await api('/auth/sessions/revoke-others', undefined, {
        method: 'POST',
        body: JSON.stringify(stepUpBody()),
      });
      await loadSessions();
      setNotice('Outras sessões revogadas.');
    });
  }

  const reauthReady = !!currentPassword && (!profile?.mfaEnabled || !!secondFactor.trim());

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} testID="security-center">
      {onBack ? (
        <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← Voltar ao perfil</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SECURITY CENTER</Text>
          <Text style={styles.title}>Segurança da conta</Text>
          <Text style={styles.muted}>
            Proteja identidade, autenticação multifator e sessões ativas sem ampliar permissões do seu perfil.
          </Text>
        </View>
        <View style={styles.securityBadge}>
          <Text style={styles.securityBadgeLabel}>Proteção adicional</Text>
          <Text style={styles.securityBadgeValue}>
            {profile?.mfaEnabled ? 'MFA ativo' : 'MFA desativado'}
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>E-mail da conta</Text>
          <Text numberOfLines={1} style={styles.summaryValue}>{profile?.email ?? '—'}</Text>
          <Text style={styles.summaryMeta}>Identidade de acesso atual</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Autenticação multifator</Text>
          <Text style={styles.summaryValue}>{profile?.mfaEnabled ? 'Ativa' : 'Desativada'}</Text>
          <Text style={styles.summaryMeta}>{profile?.mfaEnabled ? 'Segundo fator exigido em ações sensíveis' : 'Recomendado para maior proteção'}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Sessões ativas</Text>
          <Text style={styles.summaryValue}>{sessionLoading ? '…' : activeSessions}</Text>
          <Text style={styles.summaryMeta}>{currentSession ? 'Sessão atual identificada' : 'Carregando contexto de sessão'}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Aplicando alteração segura…</Text></View> : null}

      <ScrollView horizontal contentContainerStyle={styles.tabs}>
        {([
          ['account', 'Conta e identidade'],
          ['mfa', 'MFA e recuperação'],
          ['sessions', 'Sessões'],
        ] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            testID={`security-tab-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === id }}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.reauthCard}>
        <View style={styles.reauthCopy}>
          <Text style={styles.cardTitle}>Reautenticação</Text>
          <Text style={styles.muted}>
            Sua senha atual confirma alterações sensíveis.
            {profile?.mfaEnabled ? ' Informe também o código do autenticador ou um código de recuperação.' : ''}
          </Text>
        </View>
        <View style={styles.reauthFields}>
          <Field
            label="Senha atual"
            placeholder="Sua senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secure
          />
          {profile?.mfaEnabled ? (
            <Field
              label="MFA de 6 dígitos ou código de recuperação"
              placeholder="Código de segurança"
              value={secondFactor}
              onChangeText={setSecondFactor}
            />
          ) : null}
        </View>
      </View>

      {tab === 'account' ? (
        <View style={styles.twoColumns}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alterar senha</Text>
            <Text style={styles.muted}>A troca de senha encerra as demais sessões conforme a política de segurança do servidor.</Text>
            <Field
              label="Nova senha"
              placeholder="Digite a nova senha"
              value={newPassword}
              onChangeText={setNewPassword}
              secure
            />
            <Text style={styles.policy}>{PASSWORD_POLICY_TEXT}</Text>
            <Button
              testID="security-change-password"
              label="Alterar senha"
              disabled={!reauthReady || !strongPassword(newPassword) || loading}
              onPress={() => void changePassword()}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alterar e-mail</Text>
            <Text style={styles.muted}>E-mail atual: {profile?.email ?? '—'}</Text>
            <Field
              label="Novo e-mail"
              placeholder="novo@email.com"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <Button
              label="Enviar confirmação"
              disabled={!reauthReady || !newEmail.trim() || loading}
              onPress={() => void requestEmailChange()}
            />
            <View style={styles.divider} />
            <Text style={styles.subTitle}>Já recebeu o código?</Text>
            <Field
              label="Código de confirmação do e-mail"
              placeholder="Cole o código recebido"
              value={emailToken}
              onChangeText={setEmailToken}
            />
            <Button
              secondary
              label="Confirmar novo e-mail"
              disabled={!emailToken.trim() || loading}
              onPress={() => void confirmEmailChange()}
            />
          </View>
        </View>
      ) : null}

      {tab === 'mfa' ? (
        <View style={styles.twoColumns}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Autenticação multifator</Text>
            <Text style={styles.muted}>
              Estado atual: {profile?.mfaEnabled ? 'habilitada' : 'desabilitada'}.
            </Text>

            {!profile?.mfaEnabled && !mfaSecret ? (
              <>
                <Text style={styles.help}>
                  Ative um autenticador compatível com TOTP para adicionar uma segunda camada de proteção.
                </Text>
                <Button
                  testID="security-mfa-setup"
                  label="Configurar autenticador"
                  disabled={!currentPassword || loading}
                  onPress={() => void setupMfa()}
                />
              </>
            ) : null}

            {mfaSecret ? (
              <View style={styles.enrollmentBox} testID="security-mfa-enrollment">
                <Text style={styles.subTitle}>Configuração temporária</Text>
                <Text style={styles.muted}>Adicione esta conta ao seu aplicativo autenticador. Estes dados existem somente durante o cadastro.</Text>
                <Text style={styles.oneTimeLabel}>Chave de configuração</Text>
                <Text selectable style={styles.oneTimeValue}>{mfaSecret}</Text>
                <Text style={styles.oneTimeLabel}>Link de configuração</Text>
                <Text selectable style={styles.oneTimeValue}>{mfaUri}</Text>
                <Field
                  label="Código do autenticador"
                  placeholder="000000"
                  value={mfaCode}
                  onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button
                  label="Confirmar MFA"
                  disabled={mfaCode.length !== 6 || loading}
                  onPress={() => void confirmMfa()}
                />
              </View>
            ) : null}

            {profile?.mfaEnabled ? (
              <Button
                danger
                label="Desabilitar MFA"
                disabled={!reauthReady || loading}
                onPress={() => void disableMfa()}
              />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recuperação de acesso</Text>
            <Text style={styles.muted}>
              Códigos de recuperação são uma alternativa ao autenticador e devem ser armazenados fora do IRON.
            </Text>
            {recoveryCodes.length > 0 ? (
              <View style={styles.recoveryBox}>
                <Text style={styles.recoveryWarning}>Exibição única — salve estes códigos agora</Text>
                <View style={styles.codeGrid}>
                  {recoveryCodes.map((code) => (
                    <Text selectable key={code} style={styles.code}>{code}</Text>
                  ))}
                </View>
                <Button
                  testID="security-recovery-codes-saved"
                  label="Já salvei — entrar novamente"
                  onPress={() => void logout()}
                />
              </View>
            ) : (
              <Text style={styles.help}>
                Os códigos são gerados pelo servidor quando o MFA é confirmado e não ficam disponíveis para consulta posterior.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {tab === 'sessions' ? (
        <View style={styles.card}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionHeaderCopy}>
              <Text style={styles.cardTitle}>Sessões da conta</Text>
              <Text style={styles.muted}>Revogue sessões que você não reconhece ou encerre todas as outras de uma vez.</Text>
            </View>
            <Button
              testID="security-revoke-others"
              secondary
              label="Revogar outras sessões"
              disabled={!reauthReady || loading || activeSessions <= 1}
              onPress={() => void revokeOthers()}
            />
          </View>

          {sessionLoading ? (
            <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Carregando sessões…</Text></View>
          ) : sessions.length ? (
            sessions.map((session) => (
              <View key={session.id} style={[styles.session, session.current && styles.sessionCurrent]}>
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionTitleRow}>
                    <Text style={styles.sessionTitle}>{session.current ? 'Sessão atual' : 'Outra sessão'}</Text>
                    <Text style={session.active ? styles.activeBadge : styles.inactiveBadge}>
                      {session.active ? 'Ativa' : 'Inativa'}
                    </Text>
                  </View>
                  <View style={styles.sessionFacts}>
                    <Text style={styles.sessionFact}>Criada: {formatDate(session.createdAt)}</Text>
                    <Text style={styles.sessionFact}>Último uso: {formatDate(session.lastUsedAt)}</Text>
                    <Text style={styles.sessionFact}>Expira: {formatDate(session.expiresAt)}</Text>
                    {session.revokedAt ? <Text style={styles.sessionFact}>Revogada: {formatDate(session.revokedAt)}</Text> : null}
                  </View>
                </View>
                {session.active ? (
                  <Button
                    danger
                    label={session.current ? 'Encerrar esta sessão' : 'Revogar sessão'}
                    disabled={!reauthReady || loading}
                    onPress={() => void revokeSession(session.id, session.current)}
                  />
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nenhuma sessão encontrada.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 80 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 3 },
  backText: { color: '#93c5fd', fontWeight: '800', fontSize: 11 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 3 },
  title: { color: '#eef7ff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 4 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  securityBadge: { minWidth: 170, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  securityBadgeLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  securityBadgeValue: { color: '#eef7ff', fontSize: 14, fontWeight: '900', marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 220, minWidth: 190, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 10 },
  summaryLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  summaryValue: { color: '#eef7ff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  summaryMeta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  tabs: { flexDirection: 'row', gap: 6, paddingBottom: 8 },
  tab: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  tabActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  tabText: { color: '#9aadc1', fontSize: 10, fontWeight: '800' },
  tabTextActive: { color: '#eef7ff' },
  reauthCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 12, padding: 11, marginBottom: 8 },
  reauthCopy: { flex: 1, minWidth: 250 },
  reauthFields: { flexGrow: 1, flexBasis: 360, minWidth: 280 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  card: { flexGrow: 1, flexBasis: 420, minWidth: 300, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  cardTitle: { color: '#eef7ff', fontWeight: '900', fontSize: 15, marginBottom: 4 },
  subTitle: { color: '#dce9f6', fontWeight: '900', fontSize: 12, marginTop: 7, marginBottom: 3 },
  field: { marginTop: 7 },
  fieldLabel: { color: '#9fb0c5', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  policy: { color: '#9fb0c5', fontSize: 10, lineHeight: 15, marginTop: 6 },
  help: { color: '#8296ab', fontSize: 10, lineHeight: 15, marginTop: 8 },
  button: { alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 9 },
  buttonSecondary: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  buttonDanger: { backgroundColor: '#7f1d1d' },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  disabled: { opacity: 0.42 },
  divider: { height: 1, backgroundColor: '#17263a', marginTop: 12 },
  enrollmentBox: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 10, marginTop: 8 },
  oneTimeLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: 7 },
  oneTimeValue: { color: '#bfdbfe', fontSize: 10, lineHeight: 15, marginTop: 3 },
  recoveryBox: { marginTop: 9, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2f91ff', borderRadius: 10, padding: 10 },
  recoveryWarning: { color: '#bfdbfe', fontSize: 11, fontWeight: '900' },
  codeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  code: { color: '#dce9f6', fontSize: 10, backgroundColor: '#08172a', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  sessionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  sessionHeaderCopy: { flex: 1, minWidth: 250 },
  session: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#17263a', paddingVertical: 10 },
  sessionCurrent: { backgroundColor: '#071a31', marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  sessionInfo: { flex: 1, minWidth: 260 },
  sessionTitleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  sessionTitle: { color: '#eef7ff', fontWeight: '900', fontSize: 11 },
  sessionFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  sessionFact: { color: '#8296ab', fontSize: 9 },
  activeBadge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '800' },
  inactiveBadge: { color: '#b3c3d5', backgroundColor: '#101722', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '800' },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 9 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 9, borderRadius: 9, marginBottom: 8 },
  loading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 9 },
});
