import { AuthFrame } from '../components/AuthFrame';
import { IronInput as TextInput } from '../components/IronInput';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';

export function PasswordRecoveryScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function requestReset() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api('/auth/password/reset/request', undefined, {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setRequested(true);
      setNotice(
        'Se existir uma conta elegível, a solicitação foi registrada. Use o token recebido pelo canal de recuperação configurado.',
      );
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível registrar a solicitação.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset() {
    if (!token.trim() || !strongPassword(newPassword)) return;
    setLoading(true);
    setError('');
    try {
      await api('/auth/password/reset/confirm', undefined, {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false,
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      setNotice('Senha redefinida. Todas as sessões anteriores foram revogadas.');
      setToken('');
      setNewPassword('');
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Token inválido, expirado ou já utilizado.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame>
      <View style={styles.card}>
        <Text style={styles.kicker}>SEGURANÇA DA CONTA</Text>
        <Text style={styles.title}>Recuperar acesso</Text>
        <Text style={styles.subtitle}>
          Informe seu e-mail para solicitar as orientações de recuperação.
        </Text>

        <TextInput
          testID="recovery-email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-mail"
          placeholderTextColor="#9fb0c5"
        />
        <TouchableOpacity
              accessibilityRole="button"
          testID="recovery-request"
          style={[styles.primary, (!email.trim() || loading) && styles.disabled]}
          disabled={!email.trim() || loading}
          onPress={requestReset}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Solicitar recuperação</Text>}
        </TouchableOpacity>

        {requested ? (
          <View style={styles.confirm}>
            <Text style={styles.sectionTitle}>Já recebeu o código?</Text>
            <TextInput
              testID="recovery-token"
              style={styles.input}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Código de recuperação"
              placeholderTextColor="#9fb0c5"
            />
            <TextInput
              testID="recovery-new-password"
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Nova senha"
              placeholderTextColor="#9fb0c5"
            />
            <Text style={styles.policy}>{PASSWORD_POLICY_TEXT}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              testID="recovery-confirm"
              style={[
                styles.primary,
                (!token.trim() || !strongPassword(newPassword) || loading) &&
                  styles.disabled,
              ]}
              disabled={!token.trim() || !strongPassword(newPassword) || loading}
              onPress={confirmReset}
            >
              <Text style={styles.primaryText}>Redefinir senha</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {notice ? <Text testID="recovery-notice" style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={onBack} disabled={loading}>
          <Text style={styles.backText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#071528',
    borderWidth: 1,
    borderColor: '#203b55',
    borderRadius: 20,
    padding: 28,
  },
  kicker: { color: '#2f91ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#eef7ff', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#9fb0c5', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  sectionTitle: { color: '#eef7ff', fontWeight: '800', marginBottom: 10 },
  input: {
    color: '#eef7ff',
    backgroundColor: '#050b14',
    borderWidth: 1,
    borderColor: '#243247',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 10,
  },
  primary: {
    backgroundColor: '#176bc1',
    borderRadius: 11,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  confirm: { marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#203b55' },
  policy: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  notice: { color: '#86efac', marginTop: 14, lineHeight: 18 },
  error: { color: '#fca5a5', marginTop: 12 },
  back: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  backText: { color: '#93c5fd', fontWeight: '700' },
});
