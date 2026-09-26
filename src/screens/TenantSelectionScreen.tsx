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

export function TenantSelectionScreen() {
  const { pendingTenantSelection, selectTenant, cancelTenantSelection } = useAuth();
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!pendingTenantSelection) return null;

  async function confirmSelection() {
    if (!selectedGymId) {
      setError('Selecione a sua unidade.');
      return;
    }
    if (mfaRequired && !mfaCode.trim() && !recoveryCode.trim()) {
      setError('Informe o código MFA ou um recovery code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await selectTenant(
        selectedGymId,
        mfaCode || undefined,
        recoveryCode || undefined,
      );
      if (result.requiresMfa) setMfaRequired(true);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível entrar nesta unidade.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Ionicons name="business-outline" size={36} color="#8b5cf6" />
        <Text style={styles.title}>Escolha sua unidade</Text>
        <Text style={styles.hint}>
          {mfaRequired
            ? 'Unidade selecionada. Confirme agora o segundo fator.'
            : 'Sua conta possui acesso a mais de uma academia.'}
        </Text>

        {!mfaRequired
          ? pendingTenantSelection.tenants.map((tenant) => {
              const selected = tenant.id === selectedGymId;
              return (
                <TouchableOpacity
                  testID={`tenant-${tenant.id}`}
                  key={tenant.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    setSelectedGymId(tenant.id);
                    setError('');
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {tenant.name}
                  </Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? '#8b5cf6' : '#64748b'}
                  />
                </TouchableOpacity>
              );
            })
          : null}

        {mfaRequired ? (
          <>
            <View style={styles.inputGroup}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#64748b"
              />
              <TextInput
                testID="tenant-mfa-code"
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
              <Ionicons name="key-outline" size={20} color="#64748b" />
              <TextInput
                testID="tenant-recovery-code"
                style={styles.input}
                value={recoveryCode}
                onChangeText={(value) => {
                  setRecoveryCode(value.toUpperCase());
                  if (value) setMfaCode('');
                }}
                autoCapitalize="characters"
                placeholder="Recovery code"
                placeholderTextColor="#64748b"
              />
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          testID="tenant-confirm"
          style={[
            styles.button,
            (!selectedGymId ||
              loading ||
              (mfaRequired && !mfaCode.trim() && !recoveryCode.trim())) &&
              styles.disabled,
          ]}
          onPress={confirmSelection}
          disabled={
            !selectedGymId ||
            loading ||
            (mfaRequired && !mfaCode.trim() && !recoveryCode.trim())
          }
        >
          {loading ? (
            <ActivityIndicator color="#f1f5f9" />
          ) : (
            <Text style={styles.buttonText}>
              {mfaRequired ? 'Confirmar MFA e entrar' : 'Continuar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={cancelTenantSelection}
          disabled={loading}
        >
          <Text style={styles.backText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#0a0e1a',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a2035',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#252d47',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252d47',
    backgroundColor: '#131826',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf612',
  },
  optionText: { flex: 1, color: '#94a3b8', fontWeight: '600' },
  optionTextSelected: { color: '#f1f5f9' },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#131826',
    borderWidth: 1,
    borderColor: '#252d47',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: { flex: 1, color: '#f1f5f9', paddingVertical: 13 },
  or: { color: '#64748b', textAlign: 'center', marginBottom: 10 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#f1f5f9', fontWeight: '700' },
  backButton: { alignItems: 'center', paddingVertical: 14 },
  backText: { color: '#94a3b8', fontWeight: '600' },
});
