import { AuthFrame } from '../components/AuthFrame';
import { IronInput as TextInput } from '../components/IronInput';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';

function uuidV4() {
  const runtimeCrypto = (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto;
  if (runtimeCrypto?.randomUUID) return runtimeCrypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export function TrialSignupScreen({ onCancel, onCreated }: { onCancel: () => void; onCreated: (email: string, trialEndsAt?: string) => void }) {
  const requestId = useMemo(() => uuidV4(), []);
  const [name, setName] = useState('');
  const [gymName, setGymName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [timezone, setTimezone] = useState(browserTimezone());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const missing = name.trim().length < 2 ? 'Informe seu nome (mínimo de 2 caracteres).'
    : gymName.trim().length < 2 ? 'Informe o nome da academia (mínimo de 2 caracteres).'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Informe um e-mail válido.'
    : !strongPassword(password) ? PASSWORD_POLICY_TEXT
    : !timezone.trim() ? 'Informe o fuso horário.' : '';

  async function submit() {
    if (loading) return;
    if (missing) {
      setError(missing);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api('/commercial/trial/start', undefined, {
        method: 'POST',
        auth: false,
        retryOnUnauthorized: false,
        body: JSON.stringify({
          requestId,
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          gymName: gymName.trim(),
          timezone: timezone.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });
      onCreated(email.trim().toLowerCase(), result?.trialEndsAt);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o trial.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame>
      <View style={styles.card}>
        <Text style={styles.kicker}>IRON · TESTE GRÁTIS</Text>
        <Text style={styles.title}>Crie sua academia</Text>
        <Text style={styles.subtitle}>Comece seu teste grátis e reúna a rotina da sua academia em um só lugar.</Text>

        <TextInput testID="trial-name" style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor="#9fb0c5" />
        <TextInput testID="trial-gym-name" style={styles.input} value={gymName} onChangeText={setGymName} placeholder="Nome da academia" placeholderTextColor="#9fb0c5" />
        <TextInput testID="trial-email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" placeholderTextColor="#9fb0c5" />
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefone (opcional)" placeholderTextColor="#9fb0c5" />
        <Text style={styles.passwordLabel}>Senha</Text>
        <Text style={styles.policy}>De 12 a 128 caracteres, incluindo pelo menos uma letra maiúscula, uma minúscula, um número e um símbolo (por exemplo, ! ou @).</Text>
        <View style={styles.passwordInputGroup}>
          <TextInput
            testID="trial-password"
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Crie sua senha"
            placeholderTextColor="#9fb0c5"
          />
          <TouchableOpacity
            testID="trial-password-toggle"
            style={styles.passwordToggle}
            onPress={() => setPasswordVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ expanded: passwordVisible }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#9fb0c5"
            />
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="Fuso horário (ex.: America/Sao_Paulo)" placeholderTextColor="#9fb0c5" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" testID="trial-submit" style={[styles.primary, loading && styles.disabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Começar teste grátis</Text>}
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={onCancel} disabled={loading}>
          <Text style={styles.secondaryText}>Já tenho conta</Text>
        </TouchableOpacity>
        <Text style={styles.finePrint}>Nenhuma cobrança é criada nesta etapa.</Text>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 560, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 20, padding: 28 },
  kicker: { color: '#2f91ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#eef7ff', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#9fb0c5', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 13, fontSize: 15, marginBottom: 10 },
  passwordLabel: { color: '#eef7ff', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  policy: { color: '#b3c3d5', fontSize: 13, lineHeight: 19, marginBottom: 9 },
  passwordInputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 11, marginBottom: 10 },
  passwordInput: { flex: 1, color: '#eef7ff', paddingLeft: 13, paddingRight: 8, paddingVertical: 13, fontSize: 15 },
  passwordToggle: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#fca5a5', fontSize: 13, marginBottom: 10 },
  primary: { backgroundColor: '#176bc1', borderRadius: 11, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondary: { alignItems: 'center', paddingVertical: 13 },
  secondaryText: { color: '#93c5fd', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  finePrint: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
