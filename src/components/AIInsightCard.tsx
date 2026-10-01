import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIWorkoutInsight, getStaticWorkoutInsight, getWorkoutInsights } from '../services/ai';

type Props = {
  workoutCount: number;
  weeklyFrequency: number;
  onOpenAssistant: () => void;
};

export function AIInsightCard({ workoutCount, weeklyFrequency, onOpenAssistant }: Props) {
  const [insight, setInsight] = useState<AIWorkoutInsight>(() => getStaticWorkoutInsight());

  useEffect(() => {
    let active = true;
    getWorkoutInsights({ workoutCount, weeklyFrequency })
      .then((next) => { if (active) setInsight(next); });
    return () => { active = false; };
  }, [workoutCount, weeklyFrequency]);

  return (
    <View style={styles.card} testID="iron-intelligence-card">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={18} color="#67d6ff" />
          <Text style={styles.title}>Iron Intelligence</Text>
        </View>
        <Text style={[styles.badge, insight.source === 'ai' ? styles.badgeAi : styles.badgeSafe]}>
          {insight.source === 'ai' ? 'IA ativa' : 'Modo seguro'}
        </Text>
      </View>
      <Text style={styles.summary}>{insight.summary}</Text>
      {insight.recommendations.slice(0, 2).map((recommendation) => (
        <View key={`${recommendation.title}-${recommendation.detail}`} style={styles.recommendation}>
          <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
          <Text style={styles.recommendationDetail}>{recommendation.detail}</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={onOpenAssistant} accessibilityRole="button">
        <Ionicons name="chatbubble-ellipses-outline" size={17} color="#dbeafe" />
        <Text style={styles.buttonText}>Conversar com assistente</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#071528', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#203b55', marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: '#eef7ff', fontSize: 16, fontWeight: '800' },
  badge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeAi: { color: '#bfdbfe', backgroundColor: '#0b2340' },
  badgeSafe: { color: '#9fb0c5', backgroundColor: '#101722' },
  summary: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  recommendation: { backgroundColor: '#050b14', borderRadius: 12, padding: 11, marginBottom: 8 },
  recommendationTitle: { color: '#dce9f6', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  recommendationDetail: { color: '#9fb0c5', fontSize: 12, lineHeight: 17 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#176bc1', borderRadius: 12, paddingVertical: 11, marginTop: 4 },
  buttonText: { color: '#eef7ff', fontSize: 13, fontWeight: '700' },
});
