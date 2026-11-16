import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type GuidedExercise = {
  id: string;
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  suggestedLoad?: string | null;
  notes?: string | null;
  exercise?: { name?: string | null; videoUrl?: string | null };
};

export type GuidedSession = {
  id: string;
  name: string;
  exercises?: GuidedExercise[];
};

export function canGuideSession(session: GuidedSession): boolean {
  return !!session.exercises?.length && session.exercises.every((item) =>
    !!item.exercise?.name
    && Number.isInteger(item.sets)
    && (item.sets ?? 0) > 0
    && (item.sets ?? 0) <= 100
    && (item.restSeconds == null || (Number.isInteger(item.restSeconds) && item.restSeconds >= 0))
  );
}

export function GuidedWorkoutSession({ session, onClose }: { session: GuidedSession; onClose: () => void }) {
  const exercises = session.exercises ?? [];
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const announcedRest = useRef<number | null>(null);
  const current = exercises[exerciseIndex];
  const remaining = restEndsAt === null ? 0 : Math.max(0, Math.ceil((restEndsAt - now) / 1000));
  const resting = restEndsAt !== null && remaining > 0;
  const restReady = restEndsAt !== null && remaining === 0;

  useEffect(() => {
    if (restEndsAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [restEndsAt]);

  useEffect(() => {
    if (!restReady || restEndsAt === null || announcedRest.current === restEndsAt) return;
    announcedRest.current = restEndsAt;
    AccessibilityInfo.announceForAccessibility?.('Descanso concluído. Próxima série liberada.');
  }, [restReady, restEndsAt]);

  function finishSet() {
    if (restEndsAt !== null || finished || !current) return;
    const nextSets = completedSets + 1;
    if (nextSets >= (current.sets ?? 0)) {
      if (exerciseIndex + 1 === exercises.length) {
        setFinished(true);
      } else {
        setExerciseIndex(exerciseIndex + 1);
        setCompletedSets(0);
      }
      setRestEndsAt(null);
      return;
    }
    setCompletedSets(nextSets);
    const rest = current.restSeconds ?? 0;
    if (rest > 0) {
      announcedRest.current = null;
      const start = Date.now();
      setNow(start);
      setRestEndsAt(start + rest * 1000);
    }
  }

  function endRest() {
    setRestEndsAt(null);
    setNow(Date.now());
  }

  if (!canGuideSession(session)) {
    return <View style={styles.wrapper}>
      <Text style={styles.title}>Prescrição incompleta</Text>
      <Text style={styles.muted}>Peça ao professor que defina as séries e o descanso de todos os exercícios antes de iniciar o modo guiado.</Text>
      <Action label="Voltar aos treinos" onPress={onClose} />
    </View>;
  }

  return <ScrollView testID="guided-workout" style={styles.scroll} contentContainerStyle={styles.wrapper}>
    <TouchableOpacity accessibilityRole="button" testID="guided-back" onPress={onClose} style={styles.back}>
      <Text style={styles.backText}>Voltar aos treinos</Text>
    </TouchableOpacity>
    <Text style={styles.overline}>TREINO GUIADO</Text>
    <Text style={styles.title}>{session.name}</Text>
    {finished ? <View style={styles.panel} testID="guided-finished">
      <Text style={styles.success}>Sessão concluída!</Text>
      <Text style={styles.muted}>Você percorreu todos os exercícios e séries desta sessão.</Text>
      <Text style={styles.hint}>Esta confirmação é temporária nesta tela: não registra presença nem histórico de execução no servidor.</Text>
      <Action label="Voltar aos treinos" onPress={onClose} />
    </View> : <View style={styles.panel}>
      <Text style={styles.muted}>Exercício {exerciseIndex + 1} de {exercises.length}</Text>
      <Text style={styles.exerciseName} testID="guided-exercise-name">{current.exercise?.name}</Text>
      <Text style={styles.prescription}>Série {completedSets + 1} de {current.sets} · {current.reps || 'Repetições conforme orientação'}</Text>
      {current.suggestedLoad ? <Text style={styles.muted}>Carga: {current.suggestedLoad}</Text> : null}
      {current.notes ? <Text style={styles.muted}>Observações: {current.notes}</Text> : null}
      <Text style={styles.muted}>Descanso prescrito: {current.restSeconds ?? 0} segundos</Text>
      {current.exercise?.videoUrl ? <TouchableOpacity accessibilityRole="link" testID="guided-video" onPress={() => { void Linking.openURL(current.exercise!.videoUrl!); }} style={styles.video}>
        <Text style={styles.videoText}>Assistir demonstração (opcional)</Text>
      </TouchableOpacity> : null}
      {restEndsAt !== null ? <View style={styles.restBox} accessibilityLiveRegion="polite">
        {resting ? <>
          <Text style={styles.restLabel}>Descanso entre séries</Text>
          <Text style={styles.timer} testID="guided-rest-countdown">{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}</Text>
          <Action testID="guided-skip-rest" label="Pular descanso" onPress={endRest} secondary />
        </> : <>
          <Text testID="guided-rest-ready" style={styles.success}>Descanso concluído! Próxima série liberada.</Text>
          <Action testID="guided-start-next" label="Iniciar próxima série" onPress={endRest} />
        </>}
      </View> : <Action testID="guided-complete-set" label={completedSets + 1 === current.sets
        ? (exerciseIndex + 1 === exercises.length ? 'Concluir última série e finalizar' : 'Concluir série e ir ao próximo exercício')
        : 'Concluir série'} onPress={finishSet} />}
      <Text style={styles.hint}>Marque cada série após executá-la. O vídeo não inicia automaticamente e o descanso segue a prescrição do professor.</Text>
    </View>}
  </ScrollView>;
}

function Action({ label, onPress, secondary, testID }: { label: string; onPress: () => void; secondary?: boolean; testID?: string }) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress} style={[styles.action, secondary && styles.secondary]}>
    <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#050b14' },
  wrapper: { flexGrow: 1, backgroundColor: '#050b14', padding: 20, paddingBottom: 60, gap: 12 },
  back: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 16 },
  backText: { color: '#67d6ff', fontWeight: '700' },
  overline: { fontSize: 12, fontWeight: '800', color: '#67d6ff', letterSpacing: 1.4 },
  title: { fontSize: 24, fontWeight: '800', color: '#f4f9ff' },
  panel: { backgroundColor: '#081629', borderWidth: 1, borderColor: '#214365', borderRadius: 18, padding: 18, gap: 14 },
  exerciseName: { color: '#f4f9ff', fontSize: 23, fontWeight: '800' },
  prescription: { color: '#eef6ff', fontSize: 18, fontWeight: '700' },
  muted: { color: '#b3c3d5', fontSize: 14, lineHeight: 20 },
  hint: { color: '#9aadc1', fontSize: 12, lineHeight: 18 },
  video: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#2f91ff', padding: 10, borderRadius: 10 },
  videoText: { color: '#67d6ff', fontWeight: '700', fontSize: 13 },
  action: { backgroundColor: '#2f91ff', borderRadius: 12, padding: 14, alignItems: 'center' },
  actionText: { color: '#050b14', fontWeight: '800', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#2f91ff', backgroundColor: 'transparent' },
  secondaryText: { color: '#67d6ff' },
  restBox: { gap: 10, alignItems: 'stretch', paddingVertical: 14 },
  restLabel: { color: '#b3c3d5', fontSize: 13, textAlign: 'center' },
  timer: { color: '#67d6ff', fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center' },
  success: { color: '#67d6ff', fontSize: 19, fontWeight: '800', textAlign: 'center' },
});