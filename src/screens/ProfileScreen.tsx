import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InfoRow } from '../components/InfoRow';
import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { profile, activeTenantId, logout } = useAuth();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text></View>
        <Text style={styles.name}>{profile?.name || '—'}</Text>
        <Text style={styles.email}>{profile?.email || '—'}</Text>
      </View>
      <View style={styles.infoCard}>
        <InfoRow icon="business" label="Academia" value={profile?.gym?.name || activeTenantId || '—'} />
        <InfoRow icon="flag" label="Objetivo" value={profile?.goal || '—'} />
        <InfoRow icon="trophy" label="Nível" value={profile?.level || '—'} />
        <InfoRow icon="pulse" label="Status" value={profile?.status || '—'} highlight />
      </View>
      <TouchableOpacity testID="logout-submit" style={styles.logout} onPress={() => void logout()} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color="#f1f5f9" /><Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
      <Text style={styles.version}>Iron Fit v0.2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0e1a' }, content: { padding: 20, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 24 }, avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, avatarText: { color: '#f1f5f9', fontSize: 36, fontWeight: '800' }, name: { color: '#f1f5f9', fontSize: 22, fontWeight: '800' }, email: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  infoCard: { backgroundColor: '#1a2035', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#252d47', marginBottom: 24 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 12, gap: 8 }, logoutText: { color: '#f1f5f9', fontWeight: '700', fontSize: 15 }, version: { color: '#64748b', textAlign: 'center', fontSize: 11, marginTop: 16 },
});
