import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { validCaktoCheckout } from './SaasBillingPanel';

type Meter = {
  includedAllowance: number; extraAllowance: number; allowance: number;
  used: number; remaining: number; percent: number;
  periodStart: string | null; periodEnd: string | null;
};
type Quotas = { workouts: Meter; advisory: Meter; rollover: false; thresholds: {
  warning: number; critical: number; exhausted: number;
} };
type Package = { code: string; count: number; price: string };
const PACKS: readonly Package[] = [
  {code:'IRON_AI_WORKOUT_100',count:100,price:'R$ 19,90'},
  {code:'IRON_AI_WORKOUT_300',count:300,price:'R$ 49,90'},
  {code:'IRON_AI_WORKOUT_1000',count:1000,price:'R$ 129,90'},
] as const;

function validMeter(value: unknown): value is Meter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return ['allowance','used','remaining','percent'].every(key =>
    typeof v[key] === 'number' && Number.isSafeInteger(v[key]) && Number(v[key]) >= 0)
    && v.used as number <= Number(v.allowance);
}
function validQuotas(v: unknown): v is Quotas {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.rollover === false && validMeter(o.workouts) && validMeter(o.advisory);
}
function makeRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random()*16);
    return (c==='x' ? n : (n&3)|8).toString(16);
  });
}
function periodDate(value: string | null) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : 'Não informado';
}

export function AiQuotaUsagePanel({ canPurchase, revision = 0 }: { canPurchase: boolean; revision?: number }) {
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [buying, setBuying] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result: unknown = await api('/ai/quota');
      if (!validQuotas(result)) throw new Error('Resposta de consumo IA inválida.');
      setQuotas(result);
      setError('');
    } catch {
      setQuotas(null);
      setError('Consumo de IA indisponível. Não é possível confirmar o saldo neste momento.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void reload(); }, 0);
    return () => clearTimeout(timer);
  }, [reload, revision]);

  async function buy(pack: Package) {
    if (!canPurchase || !quotas || quotas.workouts.includedAllowance <= 0 || buying) return;
    setBuying(true); setNotice(''); setError('');
    try {
      const result = await api('/ai/credits/checkout', undefined, {
        method:'POST',body:JSON.stringify({packageCode:pack.code,requestId:makeRequestId()}),
      });
      if (!validCaktoCheckout(result?.checkoutUrl) ||
          result?.packageCode !== pack.code || result?.units !== pack.count ||
          result?.currency !== 'BRL' || result?.status !== 'pending')
        throw new Error('O FM Command não confirmou um checkout válido para este pacote.');
      await Linking.openURL(result.checkoutUrl);
      setNotice('Checkout Cakto aberto. Os créditos só serão adicionados após confirmação financeira e sincronização pelo FM Command.');
    } catch {
      setError('Pacotes de IA indisponíveis. Nenhum crédito foi adicionado nem pagamento confirmado nesta tela.');
    } finally { setBuying(false); }
  }

  const meter = quotas?.workouts;
  const status = meter && meter.allowance > 0
    ? meter.remaining === 0 ? 'Cota esgotada: a geração de IA fica bloqueada até o novo ciclo ou crédito adicional.'
      : meter.percent >= 90 ? 'Atenção: você utilizou pelo menos 90% da cota mensal.'
      : meter.percent >= 70 ? 'Aviso: você utilizou pelo menos 70% da cota mensal.' : ''
    : 'Sua assinatura ainda não possui uma cota de IA ativa.';

  return <View testID="ai-quota-panel" style={styles.panel}>
    <View style={styles.header}>
      <Text style={styles.title}>Consumo de IRON Intelligence</Text>
      <TouchableOpacity testID="ai-quota-refresh" accessibilityRole="button"
        onPress={() => { void reload(); }} disabled={loading} style={styles.refresh}>
        <Text style={styles.refreshText}>{loading ? 'Consultando...' : 'Atualizar saldo'}</Text>
      </TouchableOpacity>
    </View>
    {error ? <Text testID="ai-quota-error" style={styles.warning}>{error}</Text> : null}
    {meter ? <>
      <Text testID="ai-workout-quota" style={styles.counter}>
        {meter.remaining} de {meter.allowance} gerações de treino disponíveis
      </Text>
      <View style={styles.track}><View style={[styles.fill,{width: (Math.min(100,meter.percent)+'%') as `${number}%`}]} /></View>
      <Text style={styles.muted}>Cota do plano: {meter.includedAllowance ?? meter.allowance} · Extras: {meter.extraAllowance ?? 0} · Consumidas: {meter.used}</Text>
      {status ? <Text testID="ai-quota-warning" style={styles.warning}>{status}</Text> : null}
      <Text style={styles.muted}>Renovação do ciclo: {periodDate(meter.periodEnd)}. Créditos não acumulam para o mês seguinte.</Text>
      {quotas && <Text testID="ai-advisory-quota" style={styles.muted}>
        Outras ações de IA: {quotas.advisory.remaining} de {quotas.advisory.allowance} disponíveis.
      </Text>}
      {canPurchase && meter.includedAllowance > 0 ? <>
        <Text style={styles.label}>Adicionar créditos para gerar treinos</Text>
        <View style={styles.packages}>{PACKS.map(pack =>
          <TouchableOpacity key={pack.code} testID={'ai-buy-'+pack.count} accessibilityRole="button"
            disabled={buying} style={[styles.buy,buying && styles.disabled]} onPress={() => { void buy(pack); }}>
            <Text style={styles.buyText}>+{pack.count} treinos · {pack.price}</Text>
          </TouchableOpacity>)}</View>
      </> : null}
      {notice ? <Text testID="ai-quota-checkout-notice" style={styles.muted}>{notice}</Text> : null}
    </> : null}
  </View>;
}
const styles=StyleSheet.create({
  panel:{padding:15,borderRadius:12,borderWidth:1,borderColor:'#315C95',backgroundColor:'#0C1A33',gap:9,marginBottom:12},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'},
  title:{color:'#DBEAFE',fontSize:15,fontWeight:'800'},
  counter:{color:'#F8FAFC',fontWeight:'800',fontSize:16},
  track:{height:7,backgroundColor:'#233D62',borderRadius:8,overflow:'hidden'},
  fill:{height:7,backgroundColor:'#3B82F6',borderRadius:8},
  muted:{color:'#AFBED0',fontSize:12,lineHeight:18},
  warning:{color:'#F3C18B',fontSize:12,lineHeight:18},
  label:{color:'#DBEAFE',fontWeight:'700',fontSize:13},
  refresh:{padding:6},refreshText:{color:'#93C5FD',fontWeight:'700',fontSize:12},
  packages:{flexDirection:'row',gap:8,flexWrap:'wrap'},
  buy:{paddingVertical:9,paddingHorizontal:12,backgroundColor:'#2563EB',borderRadius:8},
  buyText:{color:'#FFF',fontSize:12,fontWeight:'700'},
  disabled:{opacity:.45},
});
