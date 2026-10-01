import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { InfoRow } from '../components/InfoRow';
import { AccountSecurityPanel } from '../components/AccountSecurityPanel';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type CommunicationPreferences = {
  consentComm: boolean;
  configured: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  trainingReminders: boolean;
  paymentReminders: boolean;
  marketing: boolean;
};

type PreferenceKey =
  | 'pushEnabled'
  | 'inAppEnabled'
  | 'emailEnabled'
  | 'whatsappEnabled'
  | 'trainingReminders'
  | 'paymentReminders'
  | 'marketing';

export function ProfileScreen() {
  const { profile, activeTenantId, logout } = useAuth();
  const [securityMode, setSecurityMode] = useState(false);
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferenceSaving, setPreferenceSaving] = useState<PreferenceKey | null>(null);
  const [preferenceError, setPreferenceError] = useState('');
  const [preferenceNotice, setPreferenceNotice] = useState('');

  useEffect(() => {
    let active = true;
    api('/me/preferences')
      .then((next) => {
        if (active) setPreferences(next);
      })
      .catch(() => {
        if (active) setPreferenceError('Preferências indisponíveis neste momento. Seu perfil continua funcionando normalmente.');
      })
      .finally(() => {
        if (active) setPreferencesLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function updatePreference(key: PreferenceKey, value: boolean) {
    if (!preferences || preferenceSaving) return;
    setPreferenceSaving(key);
    setPreferenceError('');
    setPreferenceNotice('');
    try {
      const next = await api('/me/preferences', undefined, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
      setPreferences(next);
      setPreferenceNotice('Preferências atualizadas.');
    } catch (reason) {
      setPreferenceError(
        reason instanceof Error
          ? reason.message
          : 'Não foi possível atualizar a preferência.',
      );
    } finally {
      setPreferenceSaving(null);
    }
  }

  if (securityMode) {
    return <AccountSecurityPanel onBack={() => setSecurityMode(false)} />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.name || '—'}</Text>
        <Text style={styles.email}>{profile?.email || '—'}</Text>
      </View>
      <View style={styles.infoCard}>
        <InfoRow
          icon="business"
          label="Academia"
          value={profile?.gym?.name || activeTenantId || '—'}
        />
        <InfoRow icon="flag" label="Objetivo" value={profile?.goal || '—'} />
        <InfoRow icon="trophy" label="Nível" value={profile?.level || '—'} />
        <InfoRow
          icon="pulse"
          label="Status"
          value={profile?.status || '—'}
          highlight
        />
        <InfoRow
          icon="shield-checkmark"
          label="MFA"
          value={profile?.mfaEnabled ? 'Habilitado' : 'Desabilitado'}
        />
      </View>

      <View style={styles.preferenceCard}>
        <View style={styles.preferenceHeader}>
          <View>
            <Text style={styles.preferenceTitle}>Preferências de comunicação</Text>
            <Text style={styles.preferenceHelp}>
              Escolha como prefere receber avisos. A entrega depende do recurso disponível e do seu consentimento vigente.
            </Text>
          </View>
          {preferencesLoading ? <ActivityIndicator size="small" color="#2f91ff" /> : null}
        </View>

        {preferenceError ? <Text style={styles.preferenceError}>{preferenceError}</Text> : null}
        {preferenceNotice ? <Text style={styles.preferenceNotice}>{preferenceNotice}</Text> : null}

        {preferences ? (
          <>
            {!preferences.consentComm ? (
              <View style={styles.consentNotice}>
                <Ionicons name="information-circle-outline" size={18} color="#93c5fd" />
                <Text style={styles.consentNoticeText}>
                  O consentimento para comunicações está desativado. Preferências de WhatsApp e marketing não ampliam esse consentimento.
                </Text>
              </View>
            ) : null}

            {([
              ['trainingReminders', 'Lembretes de treino', 'Avisos relacionados à sua rotina de treino', false],
              ['paymentReminders', 'Lembretes de pagamento', 'Avisos sobre cobranças e vencimentos', false],
              ['inAppEnabled', 'Avisos dentro do app', 'Permitir comunicações exibidas no IRON', false],
              ['pushEnabled', 'Notificações do app', 'Preferência para notificações quando o canal estiver disponível', false],
              ['emailEnabled', 'E-mail', 'Preferência para comunicações por e-mail quando aplicável', false],
              ['whatsappEnabled', 'WhatsApp', 'Preferência para WhatsApp quando Meta estiver configurado', true],
              ['marketing', 'Comunicações promocionais', 'Preferência para conteúdos promocionais autorizados', true],
            ] as const).map(([key, label, description, requiresConsent]) => (
              <View key={key} style={styles.preferenceRow}>
                <View style={styles.preferenceCopy}>
                  <Text style={styles.preferenceLabel}>{label}</Text>
                  <Text style={styles.preferenceDescription}>{description}</Text>
                </View>
                <Switch
                  testID={`preference-${key}`}
                  value={preferences[key]}
                  disabled={
                    preferenceSaving !== null
                    || (requiresConsent && !preferences.consentComm)
                  }
                  onValueChange={(value) => { void updatePreference(key, value); }}
                  trackColor={{ false: '#243247', true: '#176bc1' }}
                  thumbColor={preferences[key] ? '#67d6ff' : '#9fb0c5'}
                />
              </View>
            ))}
          </>
        ) : null}
      </View>

      <TouchableOpacity
        testID="account-security"
        style={styles.security}
        onPress={() => setSecurityMode(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="shield-checkmark-outline" size={20} color="#eef7ff" />
        <Text style={styles.securityText}>Segurança da conta</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="logout-submit"
        style={styles.logout}
        onPress={() => void logout()}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#eef7ff" />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#030811' },
  content: { padding: 20, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2f91ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#eef7ff', fontSize: 36, fontWeight: '800' },
  name: { color: '#eef7ff', fontSize: 22, fontWeight: '800' },
  email: { color: '#9fb0c5', fontSize: 13, marginTop: 4 },
  infoCard: {
    backgroundColor: '#071528',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#203b55',
    marginBottom: 16,
  },
  preferenceCard: {
    backgroundColor: '#071528',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#203b55',
    marginBottom: 16,
  },
  preferenceHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 },
  preferenceTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '800' },
  preferenceHelp: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 3, maxWidth: 520 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#17263a', paddingVertical: 10 },
  preferenceCopy: { flex: 1 },
  preferenceLabel: { color: '#dce9f6', fontSize: 13, fontWeight: '700' },
  preferenceDescription: { color: '#8296ab', fontSize: 10, lineHeight: 14, marginTop: 2 },
  preferenceError: { color: '#fca5a5', fontSize: 10, lineHeight: 14, marginVertical: 6 },
  preferenceNotice: { color: '#bfdbfe', fontSize: 10, lineHeight: 14, marginVertical: 6 },
  consentNotice: { flexDirection: 'row', gap: 7, backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 9, padding: 8, marginVertical: 6 },
  consentNoticeText: { flex: 1, color: '#bfdbfe', fontSize: 10, lineHeight: 15 },
  security: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176bc1',
    borderWidth: 1,
    borderColor: '#2f91ff',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  securityText: { color: '#eef7ff', fontWeight: '700', fontSize: 15 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { color: '#eef7ff', fontWeight: '700', fontSize: 15 },
});
