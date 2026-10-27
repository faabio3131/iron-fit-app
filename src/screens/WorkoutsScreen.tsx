import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIInsightCard } from '../components/AIInsightCard';
import { AIWorkoutAssistant } from '../components/AIWorkoutAssistant';
import { EmptyState } from '../components/EmptyState';
import { RequestErrorState } from '../components/RequestErrorState';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function WorkoutsScreen() {
  const { profile } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [assistantVisible, setAssistantVisible] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError('');
    api('/me/workouts')
      .then((data) => {
        if (active) {
          if (!Array.isArray(data)) throw new Error('O servidor retornou uma lista de treinos inválida.');
          setWorkouts(data);
        }
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : 'Não foi possível consultar seus treinos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadVersion]);

  const weeklyFrequency = workouts.reduce((sum, workout) => sum + (workout.weeklyFrequency || 0), 0);

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View><Text style={styles.heading}>Olá, {profile?.name?.split(' ')[0] || 'Atleta'}</Text><Text style={styles.sub}>Bora treinar hoje? 💪</Text></View>
          <View style={styles.avatar}><Ionicons name="person" size={24} color="#2BF47A" /></View>
        </View>
        {!loadError ? <View>
          <View style={styles.stats}>
          <StatCard icon="barbell" value={String(workouts.length)} label="Treinos" color="#2BF47A" />
          <StatCard icon="calendar" value={String(weeklyFrequency)} label="Dias/semana" color="#f59e0b" />
        </View>
        <AIInsightCard workoutCount={workouts.length} weeklyFrequency={weeklyFrequency} onOpenAssistant={() => setAssistantVisible(true)} /></View> : null}
        <Text style={styles.sectionTitle}>Seus Treinos</Text>
        {loading ? <ActivityIndicator size="large" color="#2BF47A" style={styles.loading} /> : loadError ? <RequestErrorState message={`Sem conexão ou serviço indisponível. ${loadError}`} onRetry={() => { setLoading(true); setReloadVersion((n) => n + 1); }} /> : workouts.length === 0 ? (
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
                          <Ionicons name="play-circle" size={16} color="#2BF47A" /><Text style={styles.videoText}>Ver vídeo</Text>
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
  session: { marginBottom: 12 }, sessionTitle: { color: '#2BF47A', fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }, exercise: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252d47' },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#131826', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, numberText: { color: '#2BF47A', fontWeight: '700', fontSize: 12 }, exerciseContent: { flex: 1 }, exerciseName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' }, exerciseMeta: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  videoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2BF47A15', borderWidth: 1, borderColor: '#2BF47A40', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, gap: 6 }, videoText: { color: '#2BF47A', fontWeight: '600', fontSize: 13 },
});
