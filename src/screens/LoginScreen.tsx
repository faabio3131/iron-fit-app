import { Ionicons } from '@expo/vector-icons';
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
import { useAuth } from '../context/AuthContext';

type LoginScreenProps = {
  initialEmail?: string;
  notice?: string;
  onStartTrial?: () => void;
  onForgotPassword?: () => void;
};

export function LoginScreen({
  initialEmail = '',
  notice = '',
  onStartTrial,
  onForgotPassword,
}: LoginScreenProps = {}) {
  const { login } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Informe email e senha.');
      return;
    }
    if (requiresMfa && !mfaCode.trim() && !recoveryCode.trim()) {
      setError('Informe o código MFA ou um recovery code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(
        email,
        password,
        undefined,
        mfaCode || undefined,
        recoveryCode || undefined,
      );
      if (result.requiresMfa && !result.requiresTenantSelection) {
        setRequiresMfa(true);
      }
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível autenticar. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  const disabled =
    loading ||
    !email.trim() ||
    !password ||
    (requiresMfa && !mfaCode.trim() && !recoveryCode.trim());

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="cloud" size={48} color="#f1f5f9" />
            <Ionicons
              name="barbell"
              size={28}
              color="#2583e8"
              style={styles.logoBarbell}
            />
          </View>
          <Text style={styles.logoTitle}>Iron Fit</Text>
          <Text style={styles.logoTagline}>
            A força da sua academia,{String.fromCharCode(10)}na nuvem.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>Bem-vindo de volta</Text>
          <Text style={styles.sub}>
            {requiresMfa
              ? 'Confirme o segundo fator para concluir o acesso'
              : 'Entre para acessar o IRON'}
          </Text>
          {notice ? (
            <Text testID="login-notice" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <View style={styles.inputGroup}>
            <Ionicons
              name="mail-outline"
              size={20}
              color="#64748b"
              style={styles.inputIcon}
            />
            <TextInput
              testID="login-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              editable={!requiresMfa}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#64748b"
              style={styles.inputIcon}
            />
            <TextInput
              testID="login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              editable={!requiresMfa}
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor="#64748b"
            />
          </View>

          {requiresMfa ? (
            <>
              <View style={styles.inputGroup}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="login-mfa-code"
                  style={styles.input}
                  value={mfaCode}
                  onChangeText={(value) => {
                    setMfaCode(value.replace(/\D/g, '').slice(0, 6));
                    if (value) setRecoveryCode('');
                  }}
                  keyboardType="number-pad"
                  placeholder="Código MFA de 6 dígitos"
                  placeholderTextColor="#64748b"
                />
              </View>
              <Text style={styles.or}>ou</Text>
              <View style={styles.inputGroup}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color="#64748b"
                  style={styles.inputIcon}
                />
                <TextInput
                  testID="login-recovery-code"
                  style={styles.input}
                  value={recoveryCode}
                  onChangeText={(value) => {
                    setRecoveryCode(value.toUpperCase());
                    if (value) setMfaCode('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Recovery code"
                  placeholderTextColor="#64748b"
                />
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            testID="login-submit"
            style={[styles.button, disabled && styles.disabled]}
            onPress={handleLogin}
            disabled={disabled}
          >
            {loading ? (
              <ActivityIndicator color="#f1f5f9" />
            ) : (
              <Text style={styles.buttonText}>
                {requiresMfa ? 'Confirmar e entrar' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>

          {requiresMfa ? (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setRequiresMfa(false);
                setMfaCode('');
                setRecoveryCode('');
                setError('');
              }}
            >
              <Text style={styles.linkText}>Usar outra conta</Text>
            </TouchableOpacity>
          ) : (
            <>
              {onForgotPassword ? (
                <TouchableOpacity
                  testID="forgot-password"
                  style={styles.linkButton}
                  onPress={onForgotPassword}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>Esqueci minha senha</Text>
                </TouchableOpacity>
              ) : null}
              {onStartTrial ? (
                <TouchableOpacity
                  testID="start-trial"
                  style={styles.trialButton}
                  onPress={onStartTrial}
                  disabled={loading}
                >
                  <Text style={styles.trialText}>Começar teste grátis</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
        <Text style={styles.footer}>Iron Fit © 2026</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#05080f' },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBadge: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: '#0b111d',
    borderWidth: 1,
    borderColor: '#1d2939',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoBarbell: { position: 'absolute', bottom: 22 },
  logoTitle: {
    color: '#f1f5f9',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoTagline: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#0b111d',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1d2939',
  },
  welcome: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 14, marginBottom: 18 },
  notice: {
    color: '#86efac',
    backgroundColor: '#12301f',
    borderWidth: 1,
    borderColor: '#166534',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    marginBottom: 14,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060b13',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1d2939',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#f1f5f9', paddingVertical: 14, fontSize: 15 },
  or: { color: '#64748b', textAlign: 'center', marginBottom: 10, fontSize: 12 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: '#2583e8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  trialButton: {
    borderWidth: 1,
    borderColor: '#1e4d7a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  trialText: { color: '#93c5fd', fontSize: 14, fontWeight: '700' },
  footer: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
  },
});
