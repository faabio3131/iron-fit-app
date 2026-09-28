import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>SEGURANÇA DA CONTA</Text>
        <Text style={styles.title}>Recuperar acesso</Text>
        <Text style={styles.subtitle}>
          A resposta da solicitação é deliberadamente genérica para não revelar se uma conta existe.
        </Text>

        <TextInput
          testID="recovery-email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-mail"
          placeholderTextColor="#64748b"
        />
        <TouchableOpacity
          testID="recovery-request"
          style={[styles.primary, (!email.trim() || loading) && styles.disabled]}
          disabled={!email.trim() || loading}
          onPress={requestReset}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Solicitar recuperação</Text>}
        </TouchableOpacity>

        {requested ? (
          <View style={styles.confirm}>
            <Text style={styles.sectionTitle}>Já recebeu o token?</Text>
            <TextInput
              testID="recovery-token"
              style={styles.input}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Token one-time"
              placeholderTextColor="#64748b"
            />
            <TextInput
              testID="recovery-new-password"
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Nova senha"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.policy}>{PASSWORD_POLICY_TEXT}</Text>
            <TouchableOpacity
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
        <TouchableOpacity style={styles.back} onPress={onBack} disabled={loading}>
          <Text style={styles.backText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#05080f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#0b111d',
    borderWidth: 1,
    borderColor: '#1d2939',
    borderRadius: 20,
    padding: 28,
  },
  kicker: { color: '#2583e8', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  sectionTitle: { color: '#f1f5f9', fontWeight: '800', marginBottom: 10 },
  input: {
    color: '#f8fafc',
    backgroundColor: '#060b13',
    borderWidth: 1,
    borderColor: '#243247',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 10,
  },
  primary: {
    backgroundColor: '#1473e6',
    borderRadius: 11,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  confirm: { marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#1d2939' },
  policy: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  notice: { color: '#86efac', marginTop: 14, lineHeight: 18 },
  error: { color: '#fca5a5', marginTop: 12 },
  back: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  backText: { color: '#93c5fd', fontWeight: '700' },
});
