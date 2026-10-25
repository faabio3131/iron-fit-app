import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type Student = { id: string; name?: string };
type Exercise = { id: string; name: string; muscleGroup?: string | null };
type Assessment = { id: string; createdAt: string; weight?: number | null };
type PrescribedExercise = { exerciseId: string; sets: string; reps: string; restSeconds: string };
type SessionDraft = { key: number; name: string; estimatedMinutes: string; exercises: PrescribedExercise[] };
const seed = (): SessionDraft[] => [{ key: 1, name: 'Sessão A', estimatedMinutes: '', exercises: [] }];

function Button({ label, onPress, disabled, testID }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function Input({ label, value, onChangeText, testID }: {
  label: string; value: string; onChangeText: (v: string) => void; testID?: string;
}) {
  return <View style={styles.field}><Text style={styles.muted}>{label}</Text>
    <TextInput style={styles.input} testID={testID} value={value} onChangeText={onChangeText} placeholderTextColor="#64748b" />
  </View>;
}
function positiveInt(text: string) {
  if (!text.trim()) return undefined;
  const value = Number(text.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}
export function WorkoutComposer({ students, onUpdated }: {
  students: Student[]; onUpdated: () => Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [fetching, setFetching] = useState(false);
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [frequency, setFrequency] = useState('3');
  const [notes, setNotes] = useState('');
  const [sessions, setSessions] = useState<SessionDraft[]>(seed);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    api('/exercises').then((rows) => { if (mounted) setExerciseLibrary(Array.isArray(rows) ? rows : []); })
      .catch((e: unknown) => { if (mounted) setError(e instanceof Error ? e.message : 'Não foi possível carregar exercícios.'); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!studentId) return;
    let mounted = true;
    api(`/students/${studentId}/assessments`).then((rows) => {
      if (mounted) setAssessments(Array.isArray(rows) ? rows : []);
    }).catch((e: unknown) => {
      if (mounted) setError(e instanceof Error ? e.message : 'Não foi possível consultar avaliações.');
    }).finally(() => { if (mounted) setFetching(false); });
    return () => { mounted = false; };
  }, [studentId]);

  function chooseStudent(id: string) {
    setStudentId(id); setAssessmentId(''); setAssessments([]); setFetching(true); setError('');
  }
  function changeSession(key: number, update: Partial<SessionDraft>) {
    setSessions((rows) => rows.map((row) => row.key === key ? { ...row, ...update } : row));
  }
  function addExercise(key: number) {
    if (!selectedExerciseId || !exerciseLibrary.some((row) => row.id === selectedExerciseId)) return;
    setSessions((rows) => rows.map((session) => session.key === key
      ? { ...session, exercises: [...session.exercises, { exerciseId: selectedExerciseId, sets: '3', reps: '12', restSeconds: '60' }] } : session));
  }
  function changeExercise(key: number, index: number, patch: Partial<PrescribedExercise>) {
    setSessions((rows) => rows.map((session) => session.key === key
      ? { ...session, exercises: session.exercises.map((entry, i) => i === index ? { ...entry, ...patch } : entry) } : session));
  }

  const invalid = useMemo(() =>
    positiveInt(frequency) === null || (positiveInt(frequency) ?? 0) > 14 ||
    sessions.some((session) => !session.name.trim() || session.exercises.length === 0 ||
      positiveInt(session.estimatedMinutes) === null ||
      session.exercises.some((exercise) =>
        positiveInt(exercise.sets) === null || exercise.reps.trim().length === 0 || exercise.reps.trim().length > 80 ||
        (exercise.restSeconds.trim() !== '' && (!Number.isInteger(Number(exercise.restSeconds)) || Number(exercise.restSeconds) < 0)),
      )), [frequency, sessions]);
  const ready = !!studentId && !invalid && sessions.length > 0 &&
    sessions.every((s) => s.exercises.length > 0) && exerciseLibrary.length > 0 && !busy && !fetching;

  async function create() {
    if (!ready) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const draft = await api('/workouts', undefined, { method: 'POST', body: JSON.stringify({
        studentId,
        ...(assessmentId ? { assessmentId } : {}),
        ...(goal.trim() ? { goal: goal.trim() } : {}),
        ...(level.trim() ? { level: level.trim() } : {}),
        ...(positiveInt(frequency) !== undefined ? { weeklyFrequency: Number(frequency) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        sessions: sessions.map((s, i) => ({
          name: s.name.trim(), order: i + 1,
          ...(s.estimatedMinutes.trim() ? { estimatedMinutes: Number(s.estimatedMinutes) } : {}),
          exercises: s.exercises.map((entry, j) => ({
            exerciseId: entry.exerciseId, order: j + 1,
            ...(entry.sets.trim() ? { sets: Number(entry.sets) } : {}),
            ...(entry.reps.trim() ? { reps: entry.reps.trim() } : {}),
            ...(entry.restSeconds.trim() ? { restSeconds: Number(entry.restSeconds) } : {}),
          })),
        })),
      }) });
      if (draft?.status !== 'DRAFT') {
        throw new Error('O backend não confirmou a criação como rascunho; consulte os treinos antes de repetir.');
      }
      setNotice('Rascunho registrado. A aprovação humana é obrigatória antes da ativação.');
      setSessions(seed()); setGoal(''); setLevel(''); setNotes(''); setAssessmentId('');
      try {
        await onUpdated();
      } catch {
        setNotice('Rascunho registrado no backend, mas não foi possível atualizar a lista. Consulte os treinos antes de criar outro.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o treino.');
    } finally { setBusy(false); }
  }

  return <GlowCard style={styles.card}>
    <Text style={styles.heading}>Workout Studio — criação manual</Text>
    <Text style={styles.muted}>Monte sessões e prescreva exercícios da biblioteca canônica. O treino inicia em rascunho, sem ativação automática.</Text>
    <Text style={styles.label}>Aluno</Text>
    <View style={styles.actions}>{students.map((student) => <Button key={student.id}
      testID={`studio-student-${student.id}`} label={`${student.name ?? 'Aluno'}${student.id === studentId ? ' ✓' : ''}`}
      onPress={() => chooseStudent(student.id)} />)}</View>
    {fetching ? <ActivityIndicator color="#2BF47A" /> : null}
    {studentId && assessments.length ? <>
      <Text style={styles.label}>Avaliação de referência (opcional)</Text>
      <View style={styles.actions}>
        <Button label="Sem avaliação vinculada" onPress={() => setAssessmentId('')} />
        {assessments.slice(0, 8).map((a) => <Button key={a.id} testID={`studio-assessment-${a.id}`}
          label={`${new Date(a.createdAt).toLocaleDateString('pt-BR')}${assessmentId === a.id ? ' ✓' : ''}`}
          onPress={() => setAssessmentId(a.id)} />)}
      </View>
    </> : null}
    <View style={styles.form}>
      <Input label="Objetivo" value={goal} onChangeText={setGoal} />
      <Input label="Nível" value={level} onChangeText={setLevel} />
      <Input label="Frequência semanal (1–14)" testID="studio-frequency" value={frequency} onChangeText={setFrequency} />
      <Input label="Observações profissionais" value={notes} onChangeText={setNotes} />
    </View>
    <Text style={styles.label}>Biblioteca de exercícios</Text>
    <View style={styles.actions}>{exerciseLibrary.slice(0, 60).map((exercise) => <Button key={exercise.id}
      testID={`studio-exercise-${exercise.id}`}
      label={`${exercise.name}${selectedExerciseId === exercise.id ? ' ✓' : ''}`}
      onPress={() => setSelectedExerciseId(exercise.id)} />)}</View>
    {!exerciseLibrary.length ? <Text style={styles.muted}>Exercícios indisponíveis. Atualize a biblioteca antes de prescrever.</Text> : null}
    {sessions.map((session, si) => <View key={session.key} style={styles.session}>
      <Input label={`Sessão ${si + 1}`} testID={`studio-session-name-${session.key}`} value={session.name}
        onChangeText={(name) => changeSession(session.key, { name })} />
      <Input label="Duração estimada (minutos)" value={session.estimatedMinutes}
        onChangeText={(estimatedMinutes) => changeSession(session.key, { estimatedMinutes })} />
      <Button testID={`studio-exercise-add-${session.key}`} label="Adicionar exercício selecionado"
        disabled={!selectedExerciseId} onPress={() => addExercise(session.key)} />
      {session.exercises.map((entry, i) => <View key={i} style={styles.exercise}>
        <Text style={styles.label}>{exerciseLibrary.find((e) => e.id === entry.exerciseId)?.name ?? 'Exercício'}</Text>
        <View style={styles.form}>
          <Input label="Séries" value={entry.sets} onChangeText={(sets) => changeExercise(session.key, i, { sets })} />
          <Input label="Repetições" value={entry.reps} onChangeText={(reps) => changeExercise(session.key, i, { reps })} />
          <Input label="Descanso (segundos)" value={entry.restSeconds} onChangeText={(restSeconds) => changeExercise(session.key, i, { restSeconds })} />
        </View>
        <Button label="Retirar exercício" testID={`studio-exercise-remove-${session.key}-${i}`}
          onPress={() => changeSession(session.key, { exercises: session.exercises.filter((_, j) => j !== i) })} />
      </View>)}
      {sessions.length > 1 ? <Button label="Remover sessão" testID={`studio-session-remove-${session.key}`}
        onPress={() => setSessions((rows) => rows.filter((x) => x.key !== session.key))} /> : null}
    </View>)}
    <Button label="Adicionar outra sessão" testID="studio-add-session" onPress={() =>
      setSessions((rows) => [...rows, { key: Math.max(...rows.map((x) => x.key)) + 1, name: `Sessão ${rows.length + 1}`, estimatedMinutes: '', exercises: [] }])} />
    {invalid ? <Text testID="studio-validation" style={styles.error}>Preencha os nomes de sessão, séries e valores numéricos válidos. Cada sessão precisa de exercícios.</Text> : null}
    <Button testID="manual-workout-create" label={busy ? 'Salvando rascunho…' : 'Criar rascunho com sessões'}
      disabled={!ready} onPress={() => { void create(); }} />
    {notice ? <Text testID="studio-notice" style={styles.success}>{notice}</Text> : null}
    {error ? <Text testID="studio-error" style={styles.error}>{error}</Text> : null}
  </GlowCard>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 10, marginBottom: 12 },
  heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  label: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { paddingHorizontal: 10, paddingVertical: 8, borderColor: '#334155', borderWidth: 1, borderRadius: 8, backgroundColor: '#172033', alignSelf: 'flex-start' },
  buttonText: { color: '#b5fccc', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, flexBasis: 160, gap: 4 },
  input: { backgroundColor: '#0b1120', color: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#334155', padding: 10 },
  session: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, gap: 9 },
  exercise: { borderTopColor: '#273248', borderTopWidth: 1, paddingVertical: 10, gap: 7 },
  error: { color: '#fca5a5', fontSize: 12 },
  success: { color: '#2BF47A', fontSize: 12 },
});
