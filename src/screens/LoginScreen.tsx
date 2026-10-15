import { AuthFrame } from '../components/AuthFrame';
import { IronInput as TextInput } from '../components/IronInput';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
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
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    <AuthFrame>
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
          <Text style={styles.fieldLabel}>E-mail</Text>
          <View style={styles.inputGroup}>
            <Ionicons
              name="mail-outline"
              size={20}
              color="#9fb0c5"
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
              placeholderTextColor="#9fb0c5"
              keyboardType="email-address"
            />
          </View>
          <Text style={styles.fieldLabel}>Senha</Text>
          <View style={styles.inputGroup}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#9fb0c5"
              style={styles.inputIcon}
            />
            <TextInput
              testID="login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              editable={!requiresMfa}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Senha"
              placeholderTextColor="#9fb0c5"
            />
            <TouchableOpacity
              testID="login-password-toggle"
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible((visible) => !visible)}
              disabled={requiresMfa}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
              accessibilityState={{ disabled: requiresMfa, expanded: passwordVisible }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons
                name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#9fb0c5"
              />
            </TouchableOpacity>
          </View>

          {requiresMfa ? (
            <>
              <View style={styles.inputGroup}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#9fb0c5"
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
                  placeholderTextColor="#9fb0c5"
                />
              </View>
              <Text style={styles.or}>ou</Text>
              <View style={styles.inputGroup}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color="#9fb0c5"
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
                  placeholderTextColor="#9fb0c5"
                />
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
              accessibilityRole="button"
            testID="login-submit"
            style={[styles.button, disabled && styles.disabled]}
            onPress={handleLogin}
            disabled={disabled}
          >
            {loading ? (
              <ActivityIndicator color="#eef7ff" />
            ) : (
              <Text style={styles.buttonText}>
                {requiresMfa ? 'Confirmar e entrar' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>

          {requiresMfa ? (
            <TouchableOpacity
              accessibilityRole="button"
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
              accessibilityRole="button"
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
              accessibilityRole="button"
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
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { color: '#eef7ff', fontSize: 13, fontWeight: '600', marginBottom: 7 },
  card: {
    backgroundColor: '#071528',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#203b55',
  },
  welcome: { color: '#eef7ff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#9fb0c5', fontSize: 14, marginBottom: 18 },
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
    backgroundColor: '#050b14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#203b55',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#eef7ff', paddingVertical: 14, fontSize: 15 },
  passwordToggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  or: { color: '#9fb0c5', textAlign: 'center', marginBottom: 10, fontSize: 12 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: '#176bc1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#eef7ff', fontSize: 16, fontWeight: '700' },
  linkButton: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#9fb0c5', fontSize: 13, fontWeight: '600' },
  trialButton: {
    borderWidth: 1,
    borderColor: '#1e4d7a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  trialText: { color: '#93c5fd', fontSize: 14, fontWeight: '700' },
});
