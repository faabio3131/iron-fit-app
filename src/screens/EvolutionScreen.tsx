import React, { useCallback, useEffect, useState } from 'react';
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

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('/me/assessments');
      setAssessments(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Não foi possível carregar sua evolução. Sem conexão ou serviço indisponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadAssessments(); }, 0);
    return () => clearTimeout(timer);
  }, [loadAssessments]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.heading}>Sua evolução</Text><Text style={styles.sub}>Acompanhe seu progresso 📈</Text></View><Ionicons name="trending-up" size={24} color="#2f91ff" /></View>
      {!loading && !loadError ? <AIProjectionCard assessmentCount={assessments.length} latestAssessmentDate={assessments[0]?.createdAt} /> : null}
      <Text style={styles.sectionTitle}>Avaliações Físicas</Text>
      {loading ? <ActivityIndicator size="large" color="#2f91ff" style={styles.loading} /> : loadError ? (
        <RequestErrorState message={loadError} onRetry={() => { void loadAssessments(); }} />
      ) : assessments.length === 0 ? (
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
  scroll: { flex: 1, backgroundColor: '#030811' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#eef7ff', fontSize: 24, fontWeight: '800' }, sub: { color: '#9fb0c5', fontSize: 14, marginTop: 2 }, sectionTitle: { color: '#eef7ff', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { backgroundColor: '#071528', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#203b55' }, date: { color: '#9fb0c5', fontSize: 12, marginBottom: 12 }, grid: { flexDirection: 'row', gap: 8 },
});
