import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';

type Quota = {
  allowance: number;
  includedAllowance?: number;
  extraAllowance?: number;
  used: number;
  remaining: number;
  percent: number;
  periodEnd: string | null;
};

type Usage = {
  workouts: Quota;
  advisory: Quota;
  thresholds: { warning: number; critical: number; exhausted: number };
  rollover: boolean;
  creditPurchaseStatus: string;
};

function formatDate(date: string | null) {
  if (!date) return 'Ciclo não informado';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Ciclo não informado' : parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function Meter({ title, quota, thresholds }: {
  title: string;
  quota: Quota;
  thresholds: Usage['thresholds'];
}) {
  const allowance = Number.isFinite(quota.allowance) ? Math.max(0, quota.allowance) : 0;
  const used = Number.isFinite(quota.used) ? Math.max(0, quota.used) : 0;
  const percent = allowance ? Math.min(100, Math.round(used / allowance * 100)) : 100;
  const exhausted = percent >= thresholds.exhausted;
  const warning = percent >= thresholds.critical
    ? 'A cota acabou ou está muito próxima do fim.'
    : percent >= thresholds.warning ? 'Sua cota está chegando ao limite.' : null;
  return <View style={styles.meter}>
    <View style={styles.line}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.value}>{used} / {allowance}</Text>
    </View>
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` as `${number}%` }]} />
    </View>
    <Text style={styles.caption}>{quota.remaining} ações restantes • renova em {formatDate(quota.periodEnd)}</Text>
    {warning ? <Text accessibilityRole="alert" style={styles.warning}>{exhausted
      ? 'Limite atingido. Novas solicitações de IA ficam bloqueadas até renovar a cota ou haver créditos válidos.'
      : warning}</Text> : null}
  </View>;
}

export function AiQuotaUsageCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await api('/ai/quota');
      if (!result?.workouts || !result?.advisory) throw new Error('Dados de cota indisponíveis');
      setData(result as Usage); setError(false);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);

  return <View testID="ai-monthly-usage" style={styles.container}>
    <Text style={styles.title}>Consumo mensal de IA</Text>
    {loading ? <ActivityIndicator color="#2f91ff" /> : null}
    {data && !error ? <>
      <Meter title="Geração de treinos" quota={data.workouts} thresholds={data.thresholds} />
      <Meter title="Outras ações inteligentes" quota={data.advisory} thresholds={data.thresholds} />
      <Text style={styles.caption}>Cotas mensais não acumulativas. Créditos extras dependem de pagamento confirmado e vencem no ciclo contratual.</Text>
      {data.creditPurchaseStatus !== 'AVAILABLE' ? <Text style={styles.note}>
        Compra de pacotes extras ainda não habilitada neste ambiente. Consulte sua assinatura IRON.
      </Text> : null}
    </> : null}
    {error ? <Text style={styles.note}>O consumo de IA não pôde ser consultado. O limite é aplicado com segurança pelo servidor.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#081629', borderColor: '#244467', borderWidth: 1, borderRadius: 14, gap: 11, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#eef6ff' },
  meter: { gap: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  label: { color: '#dce9f6', fontSize: 13, fontWeight: '600' },
  value: { color: '#eef6ff', fontWeight: '800', fontSize: 13 },
  track: { height: 8, backgroundColor: '#193148', borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#2f91ff', borderRadius: 99 },
  caption: { color: '#9aadc1', fontSize: 12 },
  warning: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  note: { color: '#b3c3d5', fontSize: 12 },
});
