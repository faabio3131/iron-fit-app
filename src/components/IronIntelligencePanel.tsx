import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';
type Student = { id: string; name?: string };
type Assessment = { id: string; createdAt: string };
type Workout = { id: string; status?: string; createdByAI?: boolean; goal?: string; studentId?: string };
type CandidateResponse = {
  workout?: { id: string; status?: string; createdByAI?: boolean };
  provenance?: { executionTraceId?: string; requestId?: string };
  requiresHumanReview?: boolean;
};

function Action({ testID, label, onPress, disabled }: {
  testID?: string; label: string; onPress: () => void; disabled?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}

export function IronIntelligencePanel({ students, workouts, onUpdated }: {
  students: Student[]; workouts: Workout[]; onUpdated: () => Promise<void>;
}) {
  const [studentId, setStudentId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CandidateResponse | null>(null);
  const candidates = workouts.filter((w) => w.createdByAI);

  useEffect(() => {
    if (!studentId) return;
    let mounted = true;
    api(`/students/${studentId}/assessments`).then((rows) => {
      if (mounted) setAssessments(Array.isArray(rows) ? rows : []);
    }).catch((e: unknown) => {
      if (mounted) setError(e instanceof Error ? e.message : 'Não foi possível consultar avaliações do aluno.');
    }).finally(() => { if (mounted) setFetching(false); });
    return () => { mounted = false; };
  }, [studentId]);

  function chooseStudent(id: string) {
    setStudentId(id); setAssessmentId(''); setAssessments([]); setFetching(true);
    setError(''); setResult(null);
  }

  async function generate() {
    if (!studentId || busy || fetching) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const generated: CandidateResponse = await api('/ai/workout-candidates', undefined, {
        method: 'POST', body: JSON.stringify({
          studentId,
          ...(assessmentId ? { assessmentId } : {}),
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        }),
      });
      if (generated?.workout?.status !== 'PENDING_REVIEW' ||
        generated.workout?.createdByAI !== true || generated.requiresHumanReview !== true) {
        throw new Error('O backend não confirmou um candidato aguardando revisão. Confira o histórico antes de repetir.');
      }
      setResult(generated);
      await onUpdated();
    } catch (reason: unknown) {
      const status = reason && typeof reason === 'object' && 'status' in reason ? Number(reason.status) : 0;
      if (status === 403) setError('A geração de IA não está liberada para esta academia ou perfil.');
      else if ([502, 503, 504].includes(status)) setError('O serviço de IA está indisponível. Você pode criar o treino manualmente no Workout Studio.');
      else setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o candidato.');
    } finally { setBusy(false); }
  }

  return <View>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>IRON Intelligence — sugestão de treino</Text>
      <Text style={styles.muted}>IA é consultiva. Somente o backend FM autorizado usa provedores e credenciais centrais; a academia não configura chave de modelo. Esta tela não é um chat de aluno.</Text>
      <Text style={styles.muted}>O candidato produzido fica em “Aguardando revisão”. Ele não substitui avaliação e só pode ser aprovado por profissional autenticado.</Text>
      <Text style={styles.label}>Aluno da academia</Text>
      <View style={styles.actions}>{students.map((s) => <Action key={s.id} testID={`intelligence-student-${s.id}`}
        label={`${s.name ?? 'Aluno'}${studentId === s.id ? ' ✓' : ''}`}
        onPress={() => chooseStudent(s.id)} />)}</View>
      {fetching ? <ActivityIndicator color="#2BF47A" /> : null}
      {assessments.length > 0 ? <>
        <Text style={styles.label}>Avaliação de referência (opcional)</Text>
        <View style={styles.actions}>
          <Action label="Sem vínculo" onPress={() => setAssessmentId('')} />
          {assessments.slice(0, 12).map((a) => <Action key={a.id} testID={`intelligence-assessment-${a.id}`}
            label={`${new Date(a.createdAt).toLocaleDateString('pt-BR')}${assessmentId === a.id ? ' ✓' : ''}`}
            onPress={() => setAssessmentId(a.id)} />)}
        </View>
      </> : null}
      <TextInput testID="intelligence-instructions" value={instructions} onChangeText={setInstructions}
        placeholder="Orientações do profissional (opcional)" placeholderTextColor="#64748b"
        multiline maxLength={1000} style={styles.input} />
      <Action testID="intelligence-generate" label={busy ? 'Consultando IA…' : 'Gerar candidato para revisão'}
        disabled={busy || fetching || !studentId} onPress={() => { void generate(); }} />
      {error ? <View testID="intelligence-error"><Text style={styles.error}>{error}</Text>
        <Text style={styles.muted}>Nenhum treino é ativado automaticamente. O fluxo manual permanece disponível.</Text></View> : null}
      {result?.workout ? <View testID="intelligence-result" style={styles.highlight}>
        <Text style={styles.success}>Candidato criado — aguardando revisão humana</Text>
        <Text style={styles.muted}>Aprovação e ativação são realizadas no Workout Studio, com trilha de auditoria no backend.</Text>
        {result.provenance?.executionTraceId ? <Text style={styles.muted}>Rastreabilidade de execução registrada.</Text> : null}
      </View> : null}
    </GlowCard>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Candidatos e revisão pendente</Text>
      {candidates.length ? candidates.slice(0, 35).map((workout) => <View key={workout.id} style={styles.entry}>
        <Text style={styles.label}>{workout.goal ?? 'Treino sugerido'}</Text>
        <Text style={styles.muted}>Estado: {workout.status === 'PENDING_REVIEW' ? 'Aguardando revisão' :
          workout.status === 'APPROVED' ? 'Aprovado por profissional' : workout.status === 'ACTIVE' ? 'Ativo' : workout.status ?? 'Não informado'}</Text>
      </View>) : <Text style={styles.muted}>Nenhum candidato IA registrado para esta academia.</Text>}
    </GlowCard>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 }, title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  label: { color: '#f8fafc', fontSize: 13, fontWeight: '700' }, muted: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { color: '#f8fafc', backgroundColor: '#0b1120', borderRadius: 9, borderWidth: 1, borderColor: '#334155', padding: 11, minHeight: 80 },
  button: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155', padding: 10, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#2BF47A', fontSize: 12, fontWeight: '700' }, disabled: { opacity: 0.4 },
  error: { color: '#fca5a5', fontSize: 12 }, success: { color: '#2BF47A', fontSize: 13, fontWeight: '800' },
  entry: { borderBottomWidth: 1, borderBottomColor: '#273248', paddingVertical: 9, gap: 5 },
  highlight: { borderWidth: 1, borderColor: '#2BF47A', borderRadius: 10, padding: 12, gap: 6 },
});
