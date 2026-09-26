import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

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
  const [timezone, setTimezone] = useState(browserTimezone());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const disabled = loading || name.trim().length < 2 || gymName.trim().length < 2 || !email.trim() || password.length < 6 || !timezone.trim();

  async function submit() {
    if (disabled) return;
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.kicker}>IRON · TESTE GRÁTIS</Text>
        <Text style={styles.title}>Crie sua academia</Text>
        <Text style={styles.subtitle}>O tenant, o OWNER e a assinatura de trial são provisionados pelo backend em uma única transação.</Text>

        <TextInput testID="trial-name" style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor="#64748b" />
        <TextInput testID="trial-gym-name" style={styles.input} value={gymName} onChangeText={setGymName} placeholder="Nome da academia" placeholderTextColor="#64748b" />
        <TextInput testID="trial-email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" placeholderTextColor="#64748b" />
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefone (opcional)" placeholderTextColor="#64748b" />
        <TextInput testID="trial-password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha" placeholderTextColor="#64748b" />
        <TextInput style={styles.input} value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="Timezone IANA" placeholderTextColor="#64748b" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity testID="trial-submit" style={[styles.primary, disabled && styles.disabled]} onPress={submit} disabled={disabled}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Criar trial</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onCancel} disabled={loading}>
          <Text style={styles.secondaryText}>Já tenho conta</Text>
        </TouchableOpacity>
        <Text style={styles.finePrint}>Nenhuma cobrança é criada nesta etapa. Billing SaaS pertence ao bloco comercial específico.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#080c17', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 560, backgroundColor: '#121a2b', borderWidth: 1, borderColor: '#273248', borderRadius: 20, padding: 28 },
  kicker: { color: '#8b5cf6', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  input: { color: '#f8fafc', backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#2a3650', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 13, fontSize: 15, marginBottom: 10 },
  error: { color: '#fca5a5', fontSize: 13, marginBottom: 10 },
  primary: { backgroundColor: '#7c3aed', borderRadius: 11, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondary: { alignItems: 'center', paddingVertical: 13 },
  secondaryText: { color: '#c4b5fd', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  finePrint: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
