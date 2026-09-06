import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

export function CheckInScreen() {
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleCheckIn() {
    setCheckingIn(true);
    setMessage(null);
    try {
      await api('/me/check-in', undefined, { method: 'POST', body: JSON.stringify({}) });
      setMessage({ type: 'ok', text: 'Check-in registrado! Bom treino 💪' });
    } catch (reason: unknown) {
      setMessage({ type: 'err', text: reason instanceof Error ? reason.message : 'Não foi possível registrar o check-in.' });
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <>
      <TouchableOpacity testID="checkin-submit" style={styles.card} onPress={handleCheckIn} disabled={checkingIn} activeOpacity={0.8}>
        <View style={styles.iconBox}><Ionicons name="qr-code" size={32} color="#f1f5f9" /></View>
        <View style={styles.content}>
          <Text style={styles.title}>Check-in na academia</Text>
          <Text style={styles.sub}>Toque para registrar sua entrada</Text>
        </View>
        {checkingIn ? <ActivityIndicator color="#f1f5f9" /> : <Ionicons name="chevron-forward" size={20} color="#94a3b8" />}
      </TouchableOpacity>
      {message ? (
        <View style={[styles.message, message.type === 'ok' ? styles.messageOk : styles.messageError]}>
          <Text style={message.type === 'ok' ? styles.okText : styles.errorText}>{message.text}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf6', borderRadius: 16, padding: 18, marginBottom: 16, gap: 14 },
  iconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#ffffff25', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  title: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  sub: { color: '#ffffffcc', fontSize: 12, marginTop: 2 },
  message: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  messageOk: { backgroundColor: '#10b98120', borderColor: '#10b98150' },
  messageError: { backgroundColor: '#ef444420', borderColor: '#ef444450' },
  okText: { color: '#10b981', fontWeight: '600' },
  errorText: { color: '#ef4444', fontWeight: '600' },
});
