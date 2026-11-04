import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

type Qr = { credentialId: string; imageDataUrl: string; expiresAt: string };
export function StudentAccessQrCard() {
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const alive = useRef(true);
  const locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!qr) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) setQr(null);
    };
    tick(); const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qr]);
  async function generate() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setQr(null);
    try {
      const next: Qr = await api('/me/access/qr-code', undefined, { method: 'POST' });
      if (alive.current) setQr(next);
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'QR indisponível. Procure a recepção.'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <View style={styles.card} testID="student-access-qr">
    <Text style={styles.title}>Meu QR de entrada</Text>
    <Text style={styles.help}>Apresente seu QR à recepção. A validade da matrícula e a autorização são verificadas no momento da leitura.</Text>
    {qr ? <><Image accessibilityLabel="Seu QR temporário de entrada" source={{ uri: qr.imageDataUrl }} style={styles.qr} /><Text style={styles.help}>Expira em {remaining} segundos. Não compartilhe.</Text></> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <TouchableOpacity accessibilityRole="button" testID="student-qr-generate" disabled={busy} onPress={() => void generate()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Gerando…' : qr ? 'Gerar novo QR' : 'Gerar meu QR'}</Text></TouchableOpacity>
    {busy ? <ActivityIndicator color="#60a5fa" /> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#234569', backgroundColor: '#0b1729', marginBottom: 20 },
  title: { color: '#eef7ff', fontSize: 20, fontWeight: '800' }, help: { color: '#b9cbe0' }, error: { color: '#fda4af' },
  qr: { width: 256, height: 256, alignSelf: 'center', backgroundColor: '#fff' }, button: { borderRadius: 10, backgroundColor: '#155eac', padding: 14 },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
