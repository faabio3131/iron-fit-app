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
    <AuthFrame>
      <View style={styles.card}>
        <Ionicons name="business-outline" size={36} color="#2f91ff" />
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
              accessibilityRole="button"
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
                    color={selected ? '#2f91ff' : '#9fb0c5'}
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
                color="#9fb0c5"
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
                placeholderTextColor="#9fb0c5"
              />
            </View>
            <Text style={styles.or}>ou</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="key-outline" size={20} color="#9fb0c5" />
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
                placeholderTextColor="#9fb0c5"
              />
            </View>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
              accessibilityRole="button"
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
            <ActivityIndicator color="#eef7ff" />
          ) : (
            <Text style={styles.buttonText}>
              {mfaRequired ? 'Confirmar MFA e entrar' : 'Continuar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
              accessibilityRole="button"
          style={styles.backButton}
          onPress={cancelTenantSelection}
          disabled={loading}
        >
          <Text style={styles.backText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#071528',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#203b55',
  },
  title: {
    color: '#eef7ff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
  },
  hint: {
    color: '#9fb0c5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#203b55',
    backgroundColor: '#050b14',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: '#2f91ff',
    backgroundColor: '#2f91ff12',
  },
  optionText: { flex: 1, color: '#9fb0c5', fontWeight: '600' },
  optionTextSelected: { color: '#eef7ff' },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#050b14',
    borderWidth: 1,
    borderColor: '#203b55',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: { flex: 1, color: '#eef7ff', paddingVertical: 13 },
  or: { color: '#9fb0c5', textAlign: 'center', marginBottom: 10 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: '#176bc1',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#eef7ff', fontWeight: '700' },
  backButton: { alignItems: 'center', paddingVertical: 14 },
  backText: { color: '#9fb0c5', fontWeight: '600' },
});
