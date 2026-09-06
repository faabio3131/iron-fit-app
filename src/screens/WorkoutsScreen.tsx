import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIInsightCard } from '../components/AIInsightCard';
import { AIWorkoutAssistant } from '../components/AIWorkoutAssistant';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function WorkoutsScreen() {
  const { profile } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assistantVisible, setAssistantVisible] = useState(false);

  useEffect(() => {
    let active = true;
    api('/me/workouts')
      .then((data) => {
        if (active) setWorkouts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setWorkouts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const weeklyFrequency = workouts.reduce((sum, workout) => sum + (workout.weeklyFrequency || 0), 0);

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View><Text style={styles.heading}>Olá, {profile?.name?.split(' ')[0] || 'Atleta'}</Text><Text style={styles.sub}>Bora treinar hoje? 💪</Text></View>
          <View style={styles.avatar}><Ionicons name="person" size={24} color="#8b5cf6" /></View>
        </View>
        <View style={styles.stats}>
          <StatCard icon="barbell" value={String(workouts.length)} label="Treinos" color="#8b5cf6" />
          <StatCard icon="calendar" value={String(weeklyFrequency)} label="Dias/semana" color="#f59e0b" />
        </View>
        <AIInsightCard workoutCount={workouts.length} weeklyFrequency={weeklyFrequency} onOpenAssistant={() => setAssistantVisible(true)} />
        <Text style={styles.sectionTitle}>Seus Treinos</Text>
        {loading ? <ActivityIndicator size="large" color="#8b5cf6" style={styles.loading} /> : workouts.length === 0 ? (
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
                          <Ionicons name="play-circle" size={16} color="#8b5cf6" /><Text style={styles.videoText}>Ver vídeo</Text>
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
  scroll: { flex: 1, backgroundColor: '#0a0e1a' }, content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' }, sub: { color: '#94a3b8', fontSize: 14, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a2035', borderWidth: 1, borderColor: '#252d47', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 }, sectionTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 }, loading: { marginTop: 40 },
  card: { backgroundColor: '#1a2035', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#252d47' }, cardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' }, meta: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 16 },
  session: { marginBottom: 12 }, sessionTitle: { color: '#8b5cf6', fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }, exercise: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252d47' },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#131826', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, numberText: { color: '#8b5cf6', fontWeight: '700', fontSize: 12 }, exerciseContent: { flex: 1 }, exerciseName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' }, exerciseMeta: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  videoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8b5cf615', borderWidth: 1, borderColor: '#8b5cf640', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, gap: 6 }, videoText: { color: '#8b5cf6', fontWeight: '600', fontSize: 13 },
});
