import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIInsightCard } from '../components/AIInsightCard';
import { AIWorkoutAssistant } from '../components/AIWorkoutAssistant';
import { AIContentRecommendation, getContentRecommendations } from '../services/ai';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { RequestErrorState } from '../components/RequestErrorState';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function WorkoutsScreen() {
  const { profile } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [contentRecommendations, setContentRecommendations] = useState<AIContentRecommendation[]>([]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('/me/workouts');
      setWorkouts(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Não foi possível carregar seus treinos. Sem conexão ou serviço indisponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadWorkouts(); }, 0);
    return () => clearTimeout(timer);
  }, [loadWorkouts]);

  const weeklyFrequency = workouts.reduce((sum, workout) => sum + (workout.weeklyFrequency || 0), 0);
  const recommendationExerciseIds = useMemo(
    () => [...new Set(
      workouts.flatMap((workout) =>
        (workout.sessions || []).flatMap((session: any) =>
          (session.exercises || []).map((item: any) => item.exercise?.id).filter(Boolean),
        ),
      ),
    )].slice(0, 20) as string[],
    [workouts],
  );

  useEffect(() => {
    if (recommendationExerciseIds.length === 0) return undefined;
    let active = true;
    getContentRecommendations(recommendationExerciseIds)
      .then((result) => {
        if (active) setContentRecommendations(result.recommendations);
      });
    return () => { active = false; };
  }, [recommendationExerciseIds]);

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View><Text style={styles.heading}>Olá, {profile?.name?.split(' ')[0] || 'Atleta'}</Text><Text style={styles.sub}>Bora treinar hoje? 💪</Text></View>
          <View style={styles.avatar}><Ionicons name="person" size={24} color="#2f91ff" /></View>
        </View>
        <View style={styles.stats}>
          <StatCard icon="barbell" value={loading || loadError ? "—" : String(workouts.length)} label="Treinos" color="#2f91ff" />
          <StatCard icon="calendar" value={loading || loadError ? "—" : String(weeklyFrequency)} label="Dias/semana" color="#67d6ff" />
        </View>
        {!loading && !loadError ? <AIInsightCard workoutCount={workouts.length} weeklyFrequency={weeklyFrequency} onOpenAssistant={() => setAssistantVisible(true)} /> : null}
        {!loading && !loadError && contentRecommendations.length > 0 ? (
          <View style={styles.contentRecommendationSection} testID="ai-content-recommendations">
            <View style={styles.contentRecommendationHeader}>
              <Ionicons name="play-circle-outline" size={19} color="#67d6ff" />
              <View style={styles.contentRecommendationHeaderCopy}>
                <Text style={styles.contentRecommendationTitle}>Conteúdo recomendado</Text>
                <Text style={styles.contentRecommendationSubtitle}>
                  Sugestões consultivas para exercícios do seu treino. O conteúdo final é validado pelo IRON.
                </Text>
              </View>
            </View>
            {contentRecommendations.map((recommendation) => (
              <TouchableOpacity
                key={recommendation.exerciseId}
                accessibilityRole="button"
                style={styles.contentRecommendationCard}
                onPress={() => { void Linking.openURL(recommendation.url); }}
              >
                <View style={styles.contentRecommendationCopy}>
                  <Text style={styles.contentRecommendationExercise}>{recommendation.exerciseName}</Text>
                  <Text style={styles.contentRecommendationReason}>{recommendation.reason}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color="#2f91ff" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>Seus Treinos</Text>
        {loading ? <ActivityIndicator size="large" color="#2f91ff" style={styles.loading} /> : loadError ? (
          <RequestErrorState message={loadError} onRetry={() => { void loadWorkouts(); }} />
        ) : workouts.length === 0 ? (
          <EmptyState icon="barbell-outline" title="Nenhum treino ainda" subtitle="Seu instrutor ainda não liberou treinos para você." />
        ) : workouts.map((workout) => (
          <View key={workout.id} style={styles.card}>
            <Text style={styles.cardTitle}>{workout.goal || 'Treino Personalizado'}</Text>
            <Text style={styles.meta}>{workout.weeklyFrequency || 0}x por semana · Status: {workout.status}</Text>
            {(workout.sessions || []).map((session: any) => (
              <View key={session.id} style={styles.session}>
                <Text style={styles.sessionTitle}>{session.name}</Text>
                {(session.exercises || []).map((item: any, index: number) => (
                  <View key={item.id} style={styles.exercise}>
                    <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                    <View style={styles.exerciseContent}>
                      <Text style={styles.exerciseName}>{item.exercise?.name}</Text>
                      <Text style={styles.exerciseMeta}>{item.sets && item.reps ? `${item.sets}x${item.reps}` : ''}{item.restSeconds ? ` · ${item.restSeconds}s` : ''}{item.suggestedLoad ? ` · ${item.suggestedLoad}` : ''}</Text>
                      {item.exercise?.videoUrl ? (
                        <TouchableOpacity style={styles.videoButton} onPress={() => Linking.openURL(item.exercise.videoUrl)}>
                          <Ionicons name="play-circle" size={16} color="#2f91ff" /><Text style={styles.videoText}>Ver vídeo</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <AIWorkoutAssistant
        visible={assistantVisible}
        onClose={() => setAssistantVisible(false)}
        workoutCount={workouts.length}
        weeklyFrequency={weeklyFrequency}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#030811' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#eef7ff', fontSize: 24, fontWeight: '800' }, sub: { color: '#9fb0c5', fontSize: 14, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 }, sectionTitle: { color: '#eef7ff', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { backgroundColor: '#071528', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#203b55' }, cardTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '700' }, meta: { color: '#9fb0c5', fontSize: 12, marginTop: 2, marginBottom: 16 },
  session: { marginBottom: 12 }, sessionTitle: { color: '#2f91ff', fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }, exercise: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#203b55' },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#050b14', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, numberText: { color: '#2f91ff', fontWeight: '700', fontSize: 12 }, exerciseContent: { flex: 1 }, exerciseName: { color: '#eef7ff', fontSize: 15, fontWeight: '600' }, exerciseMeta: { color: '#9fb0c5', fontSize: 11, marginTop: 4 },
  videoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2f91ff15', borderWidth: 1, borderColor: '#2f91ff40', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, gap: 6 }, videoText: { color: '#2f91ff', fontWeight: '600', fontSize: 13 },
  contentRecommendationSection: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 16, padding: 14, marginBottom: 20 },
  contentRecommendationHeader: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 9 },
  contentRecommendationHeaderCopy: { flex: 1 },
  contentRecommendationTitle: { color: '#eef7ff', fontSize: 15, fontWeight: '800' },
  contentRecommendationSubtitle: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 2 },
  contentRecommendationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 11, marginTop: 7 },
  contentRecommendationCopy: { flex: 1 },
  contentRecommendationExercise: { color: '#dce9f6', fontSize: 13, fontWeight: '800' },
  contentRecommendationReason: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 3 },
});
