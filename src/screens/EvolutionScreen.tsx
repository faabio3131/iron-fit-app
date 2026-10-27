import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIProjectionCard } from '../components/AIProjectionCard';
import { EmptyState } from '../components/EmptyState';
import { RequestErrorState } from '../components/RequestErrorState';
import { Metric } from '../components/Metric';
import { api } from '../services/api';

function fmtDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

export function EvolutionScreen() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api('/me/assessments')
      .then((data) => { if (active) { if (!Array.isArray(data)) throw new Error('As avaliações retornadas são inválidas.'); setAssessments(data); } })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Não foi possível consultar avaliações.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadVersion]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.heading}>Sua evolução</Text><Text style={styles.sub}>Acompanhe seu progresso 📈</Text></View><Ionicons name="trending-up" size={24} color="#f59e0b" /></View>
      {!loadError ? <AIProjectionCard assessmentCount={assessments.length} latestAssessmentDate={assessments[0]?.createdAt} /> : null}
      <Text style={styles.sectionTitle}>Avaliações Físicas</Text>
      {loading ? <ActivityIndicator size="large" color="#2F91FF" style={styles.loading} /> : loadError ? <RequestErrorState message={`Sem conexão ou serviço indisponível. ${loadError}`} onRetry={() => { setLoadError(''); setLoading(true); setReloadVersion((n) => n + 1); }} /> : assessments.length === 0 ? (
        <EmptyState icon="analytics-outline" title="Nenhuma avaliação" subtitle="Peça ao seu instrutor para fazer sua avaliação física." />
      ) : assessments.map((assessment) => (
        <View key={assessment.id} style={styles.card}>
          <Text style={styles.date}>{fmtDate(assessment.createdAt)}</Text>
          <View style={styles.grid}>
            <Metric label="Peso" value={assessment.weight ? `${assessment.weight} kg` : '—'} icon="scale" />
            <Metric label="IMC" value={assessment.bmi ? Number(assessment.bmi).toFixed(1) : '—'} icon="body" />
            <Metric label="Gordura" value={assessment.bodyFatPercent ? `${assessment.bodyFatPercent}%` : '—'} icon="flame" />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0e1a' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' }, sub: { color: '#94a3b8', fontSize: 14, marginTop: 2 }, sectionTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { backgroundColor: '#1a2035', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#252d47' }, date: { color: '#94a3b8', fontSize: 12, marginBottom: 12 }, grid: { flexDirection: 'row', gap: 8 },
});
