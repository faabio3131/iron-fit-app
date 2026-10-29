import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IronInput } from '../components/IronInput';
import { useAuth } from '../context/AuthContext';
import {
  AIChatReply,
  AIWorkoutInsight,
  chatWithWorkoutAssistant,
  getEvolutionProjection,
  getWorkoutInsights,
} from '../services/ai';
import { api } from '../services/api';

export function IntelligenceScreen() {
  const { profile } = useAuth();
  const [insight, setInsight] = useState<AIWorkoutInsight | null>(null);
  const [projection, setProjection] = useState<{ source: 'ai' | 'fallback'; label: string; value: string; detail: string } | null>(null);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<AIChatReply | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [workouts, assessments, nextInsight, nextProjection] = await Promise.all([
        api('/me/workouts'),
        api('/me/assessments'),
        getWorkoutInsights(),
        getEvolutionProjection(),
      ]);
      setInsight(nextInsight);
      setProjection(nextProjection);
      if (!Array.isArray(workouts) || !Array.isArray(assessments)) {
        setLoadError('Parte do seu contexto está temporariamente indisponível.');
      }
    } catch {
      setLoadError('Não foi possível carregar a IRON Intelligence agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function ask() {
    const message = question.trim();
    if (!message || asking) return;
    setAsking(true);
    try {
      const next = await chatWithWorkoutAssistant(message);
      setReply(next);
      setQuestion('');
    } finally {
      setAsking(false);
    }
  }

  const sourceLabel = (source?: 'ai' | 'fallback') => source === 'ai' ? 'IA ativa' : 'Modo seguro';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="iron-intelligence-screen">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>IRON INTELLIGENCE</Text>
          <Text style={styles.heading}>Seu copiloto de treino</Text>
          <Text style={styles.sub}>Insights e recomendações consultivas com contexto do seu histórico. A decisão final continua com você e com seu profissional.</Text>
        </View>
        <View style={styles.spark}><Ionicons name="sparkles" size={24} color="#67d6ff" /></View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#2f91ff" style={styles.loading} /> : (
        <>
          {loadError ? <View style={styles.notice}><Text style={styles.noticeText}>{loadError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void load(); }}><Text style={styles.retry}>Tentar novamente</Text></TouchableOpacity></View> : null}

          <View style={styles.grid}>
            <View style={styles.card}>
              <View style={styles.cardTop}><Text style={styles.cardTitle}>Insight de treino</Text><Text style={styles.badge}>{sourceLabel(insight?.source)}</Text></View>
              <Text style={styles.summary}>{insight?.summary ?? 'Nenhum insight disponível agora.'}</Text>
              {(insight?.recommendations ?? []).map((item, index) => <View key={item.title + '-' + index} style={styles.recommendation}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#67d6ff" />
                <View style={styles.flex}><Text style={styles.recommendationTitle}>{item.title}</Text><Text style={styles.muted}>{item.detail}</Text></View>
              </View>)}
            </View>

            <View style={styles.card}>
              <View style={styles.cardTop}><Text style={styles.cardTitle}>Projeção de evolução</Text><Text style={styles.badge}>{sourceLabel(projection?.source)}</Text></View>
              <Text style={styles.projectionValue}>{projection?.value ?? '—'}</Text>
              <Text style={styles.projectionLabel}>{projection?.label ?? 'Projeção'}</Text>
              <Text style={styles.muted}>{projection?.detail ?? 'Sem projeção disponível no momento.'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}><View><Text style={styles.cardTitle}>Converse com a IRON</Text><Text style={styles.muted}>Pergunte sobre seu treino, frequência, execução ou evolução.</Text></View><Ionicons name="chatbubbles-outline" size={22} color="#2f91ff" /></View>
            {reply ? <View style={styles.reply} testID="iron-intelligence-reply"><Text style={styles.replyLabel}>{sourceLabel(reply.source)}</Text><Text style={styles.replyText}>{reply.message}</Text></View> : null}
            <IronInput
              accessibilityLabel="Pergunta para IRON Intelligence"
              value={question}
              onChangeText={setQuestion}
              placeholder={'Olá, ' + (profile?.name?.split(' ')[0] || 'atleta') + '. O que você quer entender sobre seu treino?'}
              placeholderTextColor="#708399"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              testID="iron-intelligence-ask"
              accessibilityRole="button"
              accessibilityState={{ disabled: asking || !question.trim() }}
              disabled={asking || !question.trim()}
              style={[styles.ask, (asking || !question.trim()) && styles.askDisabled]}
              onPress={() => { void ask(); }}
            >
              <Ionicons name="send" size={17} color="#03101d" />
              <Text style={styles.askText}>{asking ? 'Analisando…' : 'Perguntar à IRON'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.advisory}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#67d6ff" />
            <Text style={styles.advisoryText}>A IRON Intelligence é consultiva. Ela não altera seu treino aprovado, pagamentos, acesso físico ou direitos da sua conta.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#030811' },
  content: { padding: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 20 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#67d6ff', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  heading: { color: '#eef7ff', fontSize: 26, fontWeight: '800', letterSpacing: -.6 },
  sub: { color: '#9fb0c5', fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: 720 },
  spark: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 60 },
  notice: { backgroundColor: '#201116', borderWidth: 1, borderColor: '#61313d', borderRadius: 14, padding: 14, marginBottom: 14 },
  noticeText: { color: '#f6c4cd', fontSize: 13 },
  retry: { color: '#67d6ff', fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  card: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 18, padding: 18, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { color: '#eef7ff', fontSize: 17, fontWeight: '800' },
  badge: { color: '#67d6ff', backgroundColor: '#09233a', borderWidth: 1, borderColor: '#1e5a80', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
  summary: { color: '#dce9f6', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  recommendation: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#173148' },
  recommendationTitle: { color: '#dce9f6', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  muted: { color: '#9fb0c5', fontSize: 12, lineHeight: 18 },
  flex: { flex: 1 },
  projectionValue: { color: '#eef7ff', fontSize: 24, fontWeight: '800', marginBottom: 3 },
  projectionLabel: { color: '#67d6ff', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  reply: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 12 },
  replyLabel: { color: '#67d6ff', fontSize: 10, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  replyText: { color: '#eef7ff', fontSize: 14, lineHeight: 21 },
  input: { minHeight: 96, textAlignVertical: 'top' },
  ask: { minHeight: 46, borderRadius: 13, backgroundColor: '#67d6ff', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 },
  askDisabled: { opacity: .45 },
  askText: { color: '#03101d', fontSize: 13, fontWeight: '800' },
  advisory: { flexDirection: 'row', gap: 10, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14 },
  advisoryText: { flex: 1, color: '#9fb0c5', fontSize: 12, lineHeight: 18 },
});
