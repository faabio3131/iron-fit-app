import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AIInsightCard } from '../components/AIInsightCard';
import { AIWorkoutAssistant } from '../components/AIWorkoutAssistant';
import { EmptyState } from '../components/EmptyState';
import { RequestErrorState } from '../components/RequestErrorState';
import { StatCard } from '../components/StatCard';
import { GuidedWorkoutSession, canGuideSession, type GuidedSession } from '../components/GuidedWorkoutSession';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type WorkoutExecution = {
  id: string; workoutId: string; sessionId: string; sessionName: string;
  completedSets: number; completedAt: string; source: 'STUDENT_SELF_REPORTED';
};

function isWorkoutExecution(value: unknown): value is WorkoutExecution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.workoutId === 'string' &&
    typeof row.sessionId === 'string' && typeof row.sessionName === 'string' &&
    Number.isSafeInteger(row.completedSets) && Number(row.completedSets) > 0 &&
    typeof row.completedAt === 'string' && !Number.isNaN(Date.parse(row.completedAt)) &&
    row.source === 'STUDENT_SELF_REPORTED';
}

export function WorkoutsScreen() {
  const { profile } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<WorkoutExecution[]>([]);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [guidedSelection, setGuidedSelection] = useState<{ workoutId: string; sessionId: string } | null>(null);

  useEffect(() => {
    let active = true;
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

  useEffect(() => {
    let active = true;
    api('/me/workout-executions')
      .then((data: unknown) => {
        if (!active) return;
        if (!Array.isArray(data) || !data.every(isWorkoutExecution)) {
          throw new Error('Invalid workout history response');
        }
        setExecutionHistory(data);
        setHistoryState('ready');
      })
      .catch(() => { if (active) setHistoryState('error'); });
    return () => { active = false; };
  }, [reloadVersion]);

  const weeklyFrequency = workouts.reduce((sum, workout) => sum + (workout.weeklyFrequency || 0), 0);
  const guidedWorkout = workouts.find((workout) => workout.id === guidedSelection?.workoutId);
  const guidedSession: GuidedSession | undefined = guidedWorkout?.sessions?.find((session: GuidedSession) => session.id === guidedSelection?.sessionId);
  if (guidedSession && guidedWorkout?.status === 'ACTIVE') {
    return <GuidedWorkoutSession key={guidedSession.id} session={guidedSession}
      onClose={() => setGuidedSelection(null)}
      onComplete={async (requestId) => {
        const saved: unknown = await api(
          '/me/workouts/' + encodeURIComponent(guidedWorkout.id) +
          '/sessions/' + encodeURIComponent(guidedSession.id) + '/completions',
          undefined, { method: 'POST', body: JSON.stringify({ requestId }) },
        );
        if (!isWorkoutExecution(saved) ||
          saved.workoutId !== guidedWorkout.id || saved.sessionId !== guidedSession.id) {
          throw new Error('O servidor não confirmou o histórico desta sessão.');
        }
        setExecutionHistory((previous) =>
          [saved, ...previous.filter((entry) => entry.id !== saved.id)].slice(0, 30));
        setHistoryState('ready');
      }} />;
  }

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
        {loading ? <ActivityIndicator size="large" color="#2BF47A" style={styles.loading} /> : loadError ? <RequestErrorState message={`Sem conexão ou serviço indisponível. ${loadError}`} onRetry={() => { setLoadError(''); setLoading(true); setHistoryState('loading'); setReloadVersion((n) => n + 1); }} /> : workouts.length === 0 ? (
          <EmptyState icon="barbell-outline" title="Nenhum treino ainda" subtitle="Seu instrutor ainda não liberou treinos para você." />
        ) : workouts.map((workout) => (
          <View key={workout.id} style={styles.card}>
            <Text style={styles.cardTitle}>{workout.goal || 'Treino Personalizado'}</Text>
            <Text style={styles.meta}>{workout.weeklyFrequency || 0}x por semana · Status: {workout.status}</Text>
            {(workout.sessions || []).map((session: any) => (
              <View key={session.id} style={styles.session}>
                <Text style={styles.sessionTitle}>{session.name}</Text>
                {workout.status === 'ACTIVE' ? (canGuideSession(session) ? (
                  <TouchableOpacity testID={'guided-launch-' + session.id} accessibilityRole="button" style={styles.guidedButton}
                    onPress={() => setGuidedSelection({ workoutId: workout.id, sessionId: session.id })}>
                    <Text style={styles.guidedText}>Iniciar treino guiado</Text>
                  </TouchableOpacity>
                ) : <Text style={styles.guidedHint}>Peça ao professor para completar as séries e os descansos antes de iniciar o treino guiado.</Text>)
                : <Text style={styles.guidedHint}>Esta sessão será liberada para execução após a ativação do treino.</Text>}
                {(session.exercises || []).map((item: any, index: number) => (
                  <View key={item.id} style={styles.exercise}>
                    <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
                    <View style={styles.exerciseContent}>
                      <Text style={styles.exerciseName}>{item.exercise?.name}</Text>
                      <Text style={styles.exerciseMeta}>{item.sets && item.reps ? `${item.sets}x${item.reps}` : ''}{item.restSeconds ? ` · ${item.restSeconds}s` : ''}{item.suggestedLoad ? ` · ${item.suggestedLoad}` : ''}</Text>
                      {item.exercise?.videoUrl ? (
                        <TouchableOpacity accessibilityRole="button" style={styles.videoButton} onPress={() => Linking.openURL(item.exercise.videoUrl)}>
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
        <View style={styles.history} testID="workout-execution-history">
          <Text style={styles.sectionTitle}>Histórico de treinos realizados</Text>
          <Text style={styles.historyHint}>Sessões autodeclaradas e confirmadas no servidor, não registros de presença.</Text>
          {historyState === 'loading' ? <ActivityIndicator size="small" color="#2F91FF" />
            : historyState === 'error' ? <Text style={styles.historyHint}>Não foi possível consultar o histórico. Atualize para tentar novamente.</Text>
            : executionHistory.length === 0 ? <Text style={styles.historyHint}>Nenhuma sessão registrada ainda.</Text>
            : executionHistory.map((entry) => <View key={entry.id} style={styles.historyItem}>
              <Text style={styles.sessionTitle}>{entry.sessionName}</Text>
              <Text style={styles.historyHint}>{entry.completedSets} séries · {new Date(entry.completedAt).toLocaleString('pt-BR')}</Text>
            </View>)}
        </View>
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
  guidedButton: { alignSelf: 'flex-start', backgroundColor: '#2BF47A', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 11, marginBottom: 12 },
  guidedText: { color: '#04140b', fontWeight: '800', fontSize: 14 },
  guidedHint: { color: '#9aadc1', fontSize: 12, marginBottom: 12 },
  videoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2BF47A15', borderWidth: 1, borderColor: '#2BF47A40', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8, gap: 6 }, videoText: { color: '#2BF47A', fontWeight: '600', fontSize: 13 },
  history: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: '#111e32', borderWidth: 1, borderColor: '#244563', gap: 8 },
  historyHint: { color: '#b3c3d5', fontSize: 12, lineHeight: 18 },
  historyItem: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#244563' },
});
