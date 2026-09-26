import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

type LoginScreenProps = {
  initialEmail?: string;
  notice?: string;
  onStartTrial?: () => void;
};

export function LoginScreen({ initialEmail = '', notice = '', onStartTrial }: LoginScreenProps = {}) {
  const { login } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Informe email e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !email.trim() || !password;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="cloud" size={48} color="#f1f5f9" />
            <Ionicons name="barbell" size={28} color="#8b5cf6" style={styles.logoBarbell} />
          </View>
          <Text style={styles.logoTitle}>Iron Fit</Text>
          <Text style={styles.logoTagline}>A força da sua academia,{`\n`}na nuvem.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>Bem-vindo de volta</Text>
          <Text style={styles.sub}>Entre para acessar o IRON</Text>
          {notice ? <Text testID="login-notice" style={styles.notice}>{notice}</Text> : null}
          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              testID="login-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              testID="login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor="#64748b"
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity testID="login-submit" style={[styles.button, disabled && styles.disabled]} onPress={handleLogin} disabled={disabled}>
            {loading ? <ActivityIndicator color="#f1f5f9" /> : <Text style={styles.buttonText}>Entrar</Text>}
          </TouchableOpacity>
          {onStartTrial ? (
            <TouchableOpacity testID="start-trial" style={styles.trialButton} onPress={onStartTrial} disabled={loading}>
              <Text style={styles.trialText}>Começar teste grátis</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.footer}>Iron Fit © 2026</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0a0e1a' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoBadge: { width: 110, height: 110, borderRadius: 30, backgroundColor: '#1a2035', borderWidth: 1, borderColor: '#252d47', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoBarbell: { position: 'absolute', bottom: 22 },
  logoTitle: { color: '#f1f5f9', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  logoTagline: { color: '#94a3b8', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card: { backgroundColor: '#1a2035', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#252d47' },
  welcome: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 14, marginBottom: 18 },
  notice: { color: '#86efac', backgroundColor: '#12301f', borderWidth: 1, borderColor: '#166534', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 14 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#131826', borderRadius: 12, borderWidth: 1, borderColor: '#252d47', paddingHorizontal: 14, marginBottom: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#f1f5f9', paddingVertical: 14, fontSize: 15 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: '#8b5cf6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  trialButton: { marginTop: 12, borderWidth: 1, borderColor: '#4c3b78', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  trialText: { color: '#c4b5fd', fontSize: 14, fontWeight: '700' },
  footer: { color: '#64748b', textAlign: 'center', marginTop: 24, fontSize: 12 },
});
