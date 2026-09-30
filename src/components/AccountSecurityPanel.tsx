import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';

function Field({
  placeholder,
  value,
  onChangeText,
  secure,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      placeholder={placeholder}
      placeholderTextColor="#9fb0c5"
      autoCapitalize="none"
    />
  );
}

export function AccountSecurityPanel({ onBack }: { onBack?: () => void }) {
  const { profile, logout, refreshProfile } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
    try {
      const value = await api('/auth/sessions');
      setSessions(Array.isArray(value) ? value : []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar sessões.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSessions]);

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
      setNotice('Senha alterada. Todas as sessões foram revogadas.');
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
      setNotice(
        'Alteração registrada. Confirme com o token entregue ao novo e-mail quando o canal estiver disponível.',
      );
    });
  }

  async function confirmEmailChange() {
    await execute(async () => {
      await api('/auth/email/change/confirm', undefined, {
        method: 'POST',
        body: JSON.stringify({ token: emailToken.trim() }),
      });
      setNotice('E-mail alterado. Todas as sessões foram revogadas.');
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
      setNotice('Escaneie a URI ou a chave no aplicativo autenticador e confirme o código.');
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
      setNotice(
        'MFA habilitado. Salve os códigos de recuperação agora; eles não serão exibidos novamente.',
      );
    });
  }

  async function disableMfa() {
    await execute(async () => {
      await api('/auth/mfa/disable', undefined, {
        method: 'POST',
        body: JSON.stringify(stepUpBody()),
      });
      setNotice('MFA desabilitado. Sessões anteriores foram revogadas.');
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {onBack ? (
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← Voltar ao perfil</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.title}>Segurança da conta</Text>
      <Text style={styles.muted}>
        Operações sensíveis exigem sua senha atual e, quando MFA estiver ativo,
        um TOTP ou recovery code.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {loading ? <ActivityIndicator color="#2f91ff" style={styles.loading} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reautenticação</Text>
        <Field
          placeholder="Senha atual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secure
        />
        {profile?.mfaEnabled ? (
          <Field
            placeholder="MFA de 6 dígitos ou código de recuperação"
            value={secondFactor}
            onChangeText={setSecondFactor}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Senha</Text>
        <Field
          placeholder="Nova senha"
          value={newPassword}
          onChangeText={setNewPassword}
          secure
        />
        <Text style={styles.policy}>{PASSWORD_POLICY_TEXT}</Text>
        <TouchableOpacity
          testID="security-change-password"
          style={[
            styles.button,
            (!currentPassword || !strongPassword(newPassword) || loading) &&
              styles.disabled,
          ]}
          disabled={!currentPassword || !strongPassword(newPassword) || loading}
          onPress={() => void changePassword()}
        >
          <Text style={styles.buttonText}>Alterar senha e revogar sessões</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>E-mail</Text>
        <Text style={styles.muted}>Atual: {profile?.email ?? '—'}</Text>
        <Field
          placeholder="Novo e-mail"
          value={newEmail}
          onChangeText={setNewEmail}
        />
        <TouchableOpacity
          style={[styles.button, (!currentPassword || !newEmail.trim()) && styles.disabled]}
          disabled={!currentPassword || !newEmail.trim() || loading}
          onPress={() => void requestEmailChange()}
        >
          <Text style={styles.buttonText}>Solicitar alteração</Text>
        </TouchableOpacity>
        <Field
          placeholder="Token de confirmação"
          value={emailToken}
          onChangeText={setEmailToken}
        />
        <TouchableOpacity
          style={[styles.secondaryButton, !emailToken.trim() && styles.disabled]}
          disabled={!emailToken.trim() || loading}
          onPress={() => void confirmEmailChange()}
        >
          <Text style={styles.buttonText}>Confirmar novo e-mail</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>MFA</Text>
        <Text style={styles.muted}>
          Estado: {profile?.mfaEnabled ? 'habilitado' : 'desabilitado'}
        </Text>
        {!profile?.mfaEnabled && !mfaSecret ? (
          <TouchableOpacity
            testID="security-mfa-setup"
            style={[styles.button, !currentPassword && styles.disabled]}
            disabled={!currentPassword || loading}
            onPress={() => void setupMfa()}
          >
            <Text style={styles.buttonText}>Configurar autenticador</Text>
          </TouchableOpacity>
        ) : null}
        {mfaSecret ? (
          <>
            <Text selectable style={styles.secret}>
              Chave: {mfaSecret}
            </Text>
            <Text selectable style={styles.secret}>
              {mfaUri}
            </Text>
            <Field
              placeholder="Código do autenticador"
              value={mfaCode}
              onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))}
            />
            <TouchableOpacity
              style={[styles.button, mfaCode.length !== 6 && styles.disabled]}
              disabled={mfaCode.length !== 6 || loading}
              onPress={() => void confirmMfa()}
            >
              <Text style={styles.buttonText}>Confirmar MFA</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {profile?.mfaEnabled ? (
          <TouchableOpacity
            style={[styles.dangerButton, !currentPassword && styles.disabled]}
            disabled={!currentPassword || loading}
            onPress={() => void disableMfa()}
          >
            <Text style={styles.buttonText}>Desabilitar MFA</Text>
          </TouchableOpacity>
        ) : null}
        {recoveryCodes.length > 0 ? (
          <View style={styles.recoveryBox}>
            <Text style={styles.cardTitle}>Códigos de recuperação — exibição única</Text>
            {recoveryCodes.map((code) => (
              <Text selectable key={code} style={styles.secret}>
                {code}
              </Text>
            ))}
            <TouchableOpacity
              testID="security-recovery-codes-saved"
              style={styles.button}
              onPress={() => void logout()}
            >
              <Text style={styles.buttonText}>Já salvei — entrar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sessões</Text>
        {sessions.map((session) => (
          <View key={session.id} style={styles.session}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>
                {session.current ? 'Sessão atual' : 'Sessão'} ·{' '}
                {session.active ? 'ativa' : 'inativa'}
              </Text>
              <Text style={styles.muted}>
                Criada: {String(session.createdAt)} · Último uso:{' '}
                {String(session.lastUsedAt)}
              </Text>
            </View>
            {session.active ? (
              <TouchableOpacity
                style={[styles.dangerSmall, !currentPassword && styles.disabled]}
                disabled={!currentPassword || loading}
                onPress={() => void revokeSession(session.id, session.current)}
              >
                <Text style={styles.buttonText}>Revogar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        <TouchableOpacity
          testID="security-revoke-others"
          style={[styles.secondaryButton, !currentPassword && styles.disabled]}
          disabled={!currentPassword || loading}
          onPress={() => void revokeOthers()}
        >
          <Text style={styles.buttonText}>Revogar outras sessões</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030811' },
  content: { padding: 16, paddingBottom: 100 },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4 },
  backText: { color: '#93c5fd', fontWeight: '700' },
  title: { color: '#eef7ff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  muted: { color: '#9fb0c5', fontSize: 12, lineHeight: 18 },
  loading: { marginVertical: 8 },
  error: { color: '#fca5a5', backgroundColor: '#301215', padding: 10, borderRadius: 8, marginTop: 10 },
  notice: { color: '#86efac', backgroundColor: '#12301f', padding: 10, borderRadius: 8, marginTop: 10 },
  card: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginTop: 12 },
  cardTitle: { color: '#eef7ff', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, padding: 11, marginTop: 8 },
  policy: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 7 },
  button: { backgroundColor: '#176bc1', borderRadius: 9, padding: 11, alignItems: 'center', marginTop: 10 },
  secondaryButton: { backgroundColor: '#203b55', borderWidth: 1, borderColor: '#334155', borderRadius: 9, padding: 11, alignItems: 'center', marginTop: 10 },
  dangerButton: { backgroundColor: '#b91c1c', borderRadius: 9, padding: 11, alignItems: 'center', marginTop: 10 },
  dangerSmall: { backgroundColor: '#991b1b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  secret: { color: '#93c5fd', fontSize: 11, marginTop: 6 },
  recoveryBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  session: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#202a3e', paddingVertical: 10 },
  sessionInfo: { flex: 1 },
  sessionTitle: { color: '#eef7ff', fontWeight: '700', fontSize: 12 },
});
