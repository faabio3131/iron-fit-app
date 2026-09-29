import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIProjectionResult, getEvolutionProjection, getStaticWorkoutInsight } from '../services/ai';

type Props = {
  assessmentCount: number;
  latestAssessmentDate?: string;
};

export function AIProjectionCard({ assessmentCount, latestAssessmentDate }: Props) {
  const fallback = getStaticWorkoutInsight();
  const [projection, setProjection] = useState<AIProjectionResult>({ source: 'fallback', ...fallback.projection });

  useEffect(() => {
    let active = true;
    getEvolutionProjection({ assessmentCount, latestAssessmentDate })
      .then((next) => { if (active) setProjection(next); });
    return () => { active = false; };
  }, [assessmentCount, latestAssessmentDate]);

  return (
    <View style={styles.card} testID="iron-intelligence-projection">
      <View style={styles.header}>
        <View style={styles.titleRow}><Ionicons name="analytics" size={18} color="#f59e0b" /><Text style={styles.title}>{projection.label}</Text></View>
        <Text style={styles.source}>{projection.source === 'ai' ? 'IA' : 'Seguro'}</Text>
      </View>
      <Text style={styles.value}>{projection.value}</Text>
      <Text style={styles.detail}>{projection.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1b1728', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f59e0b33' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: '#eef7ff', fontSize: 14, fontWeight: '700' },
  source: { color: '#fbbf24', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  value: { color: '#fde68a', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  detail: { color: '#9fb0c5', fontSize: 12, lineHeight: 17 },
});
