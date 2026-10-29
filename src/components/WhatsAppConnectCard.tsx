import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

type EvolutionStatus = {
  configured: boolean;
  status?: 'CONNECTED' | 'DISCONNECTED' | 'QR_PENDING' | string;
};

type QrPayload = { code?: string; base64?: string; pairingCode?: string };

const QR_LIFETIME_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;
const RAW_BASE64 = /^[A-Za-z0-9+/=\s]+$/;

/** Evolution devolve a imagem como data URL ou como base64 puro; só aceita PNG/JPEG. */
export function qrImageUri(base64?: string): string | null {
  if (!base64) return null;
  if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(base64)) return base64;
  if (RAW_BASE64.test(base64)) return `data:image/png;base64,${base64.replace(/\s+/g, '')}`;
  return null;
}

function messageOf(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}

export function WhatsAppConnectCard({ canManage = true }: { canManage?: boolean }) {
  const [state, setState] = useState<EvolutionStatus | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = (await api('/integrations/evolution/status')) as EvolutionStatus;
      if (!mounted.current) return;
      setState(next);
      if (next.status === 'CONNECTED') setQr(null);
    } catch (reason) {
      if (mounted.current) {
        setState((current) => current ?? { configured: false, status: 'DISCONNECTED' });
        setError(messageOf(reason));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [refresh]);

  // Enquanto há QR na tela: contagem regressiva e verificação periódica do status.
  useEffect(() => {
    if (!qr) return undefined;
    const tick = setInterval(() => setSecondsLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    const poll = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [qr, refresh]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const result = await api('/integrations/evolution/connect', undefined, { method: 'POST', body: JSON.stringify({}) });
      if (!mounted.current) return;
      setQr(result?.qr ?? null);
      setSecondsLeft(Number(result?.expiresInSeconds) > 0 ? Number(result.expiresInSeconds) : QR_LIFETIME_SECONDS);
      setState({ configured: true, status: 'QR_PENDING' });
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError('');
    try {
      await api('/integrations/evolution/connection', undefined, { method: 'DELETE' });
      if (!mounted.current) return;
      setQr(null);
      setState({ configured: false, status: 'DISCONNECTED' });
    } catch (reason) {
      if (mounted.current) setError(messageOf(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const connected = state?.status === 'CONNECTED';
  const imageUri = qrImageUri(qr?.base64);
  const expired = !!qr && secondsLeft === 0;

  return (
    <View style={styles.card} testID="whatsapp-connect-card">
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>WHATSAPP DA ACADEMIA</Text>
          <Text style={styles.title}>Conectar por QR Code</Text>
          <Text style={styles.muted}>
            Use o WhatsApp da academia para falar com os alunos. Basta escanear o QR Code com o celular, sem criar aplicativo nem configurar chaves.
          </Text>
        </View>
        <Text
          testID="whatsapp-status-badge"
          style={[styles.badge, connected ? styles.badgeOn : styles.badgeOff]}
        >
          {connected ? 'Conectado' : qr || state?.status === 'QR_PENDING' ? 'Aguardando leitura' : state ? 'Desconectado' : 'Verificando…'}
        </Text>
      </View>

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

      {!state && !error ? <ActivityIndicator color={colors.accent} /> : null}

      {qr && !connected ? (
        <View style={styles.qrBox} testID="whatsapp-qr">
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={[styles.qrImage, expired && styles.qrExpired]}
              accessibilityLabel="QR Code para conectar o WhatsApp da academia"
            />
          ) : null}
          {qr.pairingCode ? (
            <Text style={styles.pairing}>Ou digite o código no WhatsApp: {qr.pairingCode}</Text>
          ) : null}
          <Text style={styles.steps}>
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → aponte a câmera para este QR Code.
          </Text>
          <Text style={styles.countdown} testID="whatsapp-qr-countdown">
            {expired ? 'QR Code expirado. Gere um novo.' : `Expira em ${secondsLeft}s`}
          </Text>
        </View>
      ) : null}

      {connected ? (
        <Text style={styles.okText}>WhatsApp conectado. Os envios da academia usam este número.</Text>
      ) : null}

      {canManage ? (
        <View style={styles.actions}>
          {!connected ? (
            <TouchableOpacity
              accessibilityRole="button"
              testID="whatsapp-connect"
              style={[styles.button, busy && styles.disabled]}
              disabled={busy}
              onPress={connect}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Gerando…' : qr ? 'Gerar novo QR Code' : 'Conectar WhatsApp'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {state?.configured ? (
            <TouchableOpacity
              accessibilityRole="button"
              testID="whatsapp-disconnect"
              style={[styles.buttonSecondary, busy && styles.disabled]}
              disabled={busy}
              onPress={disconnect}
            >
              <Text style={styles.buttonSecondaryText}>Desconectar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <Text style={styles.muted}>Somente o proprietário da academia conecta ou desconecta o WhatsApp.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#071629', borderWidth: 1, borderColor: colors.accent, borderRadius: 14, padding: 14, marginBottom: 9 },
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  headCopy: { flex: 1, minWidth: 240 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.accent, fontSize: 17, fontWeight: '900', marginTop: 2, marginBottom: 4 },
  muted: { color: '#A1A6AE', fontSize: 11, lineHeight: 16, marginBottom: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  badgeOn: { color: colors.accent, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  badgeOff: { color: '#fde68a', backgroundColor: '#2a210d', borderWidth: 1, borderColor: '#785e13' },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginVertical: 8 },
  qrBox: { alignItems: 'center', backgroundColor: '#050B14', borderWidth: 1, borderColor: '#24262B', borderRadius: 12, padding: 14, marginVertical: 8, gap: 8 },
  qrImage: { width: 220, height: 220, backgroundColor: '#fff', borderRadius: 8 },
  qrExpired: { opacity: 0.25 },
  pairing: { color: '#EEF1F5', fontSize: 12, fontWeight: '800' },
  steps: { color: '#A1A6AE', fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 360 },
  countdown: { color: '#fde68a', fontSize: 11, fontWeight: '800' },
  okText: { color: colors.accent, fontSize: 12, fontWeight: '700', marginVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 9, paddingHorizontal: 14 },
  buttonText: { color: colors.onAccent, fontWeight: '900', fontSize: 12 },
  buttonSecondary: { minHeight: 44, justifyContent: 'center', backgroundColor: '#101416', borderWidth: 1, borderColor: '#292C31', borderRadius: 9, paddingHorizontal: 14 },
  buttonSecondaryText: { color: '#EEF1F5', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.45 },
});
