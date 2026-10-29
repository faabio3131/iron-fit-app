import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type Student = { id: string; name?: string };
type Assessment = {
  id: string; createdAt: string; weight?: number | null; height?: number | null;
  bmi?: number | null; bodyFatPercent?: number | null; notes?: string | null;
  workoutCount?: number; measurements?: Record<string, unknown> | null;
  restrictions?: { notes?: string; injuries?: string[]; conditions?: string[] } | null;
};
const measurementNames: Record<string, string> = {
  chest: 'Tórax', waist: 'Cintura', hip: 'Quadril', rightArm: 'Braço direito',
  leftArm: 'Braço esquerdo', rightThigh: 'Coxa direita', leftThigh: 'Coxa esquerda',
  rightCalf: 'Panturrilha direita', leftCalf: 'Panturrilha esquerda',
};
function Field({ label, value, onChangeText, numeric = false, testID }: {
  label: string; value: string; onChangeText: (text: string) => void; numeric?: boolean; testID?: string;
}) {
  return <View style={styles.field}><Text style={styles.muted}>{label}</Text>
    <TextInput testID={testID} value={value} onChangeText={onChangeText} style={styles.input}
      keyboardType={numeric ? 'decimal-pad' : 'default'} placeholderTextColor="#64748b" />
  </View>;
}
function formatDay(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); }
function numeric(value: string): number | undefined {
  const clean = value.trim().replace(',', '.');
  return clean !== '' && Number.isFinite(Number(clean)) ? Number(clean) : undefined;
}

export function AssessmentEvolutionPanel({ students, canCreate }: { students: Student[]; canCreate: boolean }) {
  const [studentId, setStudentId] = useState('');
  const [version, setVersion] = useState(0);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fat, setFat] = useState('');
  const [waist, setWaist] = useState('');
  const [notes, setNotes] = useState('');
  const [restrictionNote, setRestrictionNote] = useState('');

  useEffect(() => {
    if (!studentId) return;
    let mounted = true;
    api(`/students/${studentId}/assessments`).then((rows) => {
      if (mounted) { setHistory(Array.isArray(rows) ? rows : []); setLoading(false); }
    }).catch((reason: unknown) => {
      if (mounted) { setError(reason instanceof Error ? reason.message : 'Falha ao consultar avaliações.'); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [studentId, version]);

  function select(id: string) {
    setStudentId(id); setHistory([]); setError(''); setLoading(true);
  }
  function refresh() { setError(''); setLoading(true); setVersion((x) => x + 1); }

  const values = { weight: numeric(weight), height: numeric(height), bodyFatPercent: numeric(fat), waist: numeric(waist) };
  const invalid = [values.weight, values.height, values.waist].some((n) => n !== undefined && n <= 0) ||
    (values.bodyFatPercent !== undefined && (values.bodyFatPercent < 0 || values.bodyFatPercent > 100)) ||
    [weight, height, fat, waist].some((input) => input.trim() !== '' && numeric(input) === undefined);
  const filled = !!(weight.trim() || height.trim() || fat.trim() || waist.trim() || notes.trim() || restrictionNote.trim());
  const ordered = useMemo(() => [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [history]);
  const first = ordered[0], previous = ordered[1];
  const delta = first?.weight != null && previous?.weight != null ? Number(first.weight) - Number(previous.weight) : null;

  async function create() {
    if (!canCreate || !studentId || saving || invalid || !filled) return;
    setSaving(true); setError('');
    try {
      await api(`/students/${studentId}/assessments`, undefined, {
        method: 'POST', body: JSON.stringify({
          ...(values.weight !== undefined ? { weight: values.weight } : {}),
          ...(values.height !== undefined ? { height: values.height } : {}),
          ...(values.bodyFatPercent !== undefined ? { bodyFatPercent: values.bodyFatPercent } : {}),
          ...(values.waist !== undefined ? { measurements: { waist: values.waist } } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(restrictionNote.trim() ? { restrictions: { notes: restrictionNote.trim() } } : {}),
        }),
      });
      setWeight(''); setHeight(''); setFat(''); setWaist(''); setNotes(''); setRestrictionNote('');
      refresh();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a avaliação.'); }
    finally { setSaving(false); }
  }

  return <View>
    <GlowCard style={styles.block}>
      <Text style={styles.heading}>Histórico de evolução física</Text>
      <Text style={styles.muted}>Selecione o aluno. Os dados vêm das avaliações registradas nesta academia.</Text>
      <ScrollView horizontal contentContainerStyle={styles.chips}>
        {students.map((s) => <TouchableOpacity key={s.id} accessibilityRole="button"
          testID={`assessment-select-${s.id}`} onPress={() => select(s.id)}
          style={[styles.chip, studentId === s.id && styles.selected]}>
          <Text style={styles.white}>{s.name ?? 'Aluno'}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      {!studentId ? <Text style={styles.muted}>Escolha um aluno para consultar as avaliações.</Text> : null}
      {loading ? <ActivityIndicator color="#2BF47A" /> : null}
      {error ? <View style={styles.errorRow}><Text testID="assessment-error" style={styles.error}>{error}</Text>
        <TouchableOpacity testID="assessment-retry" accessibilityRole="button" onPress={refresh}><Text style={styles.accent}>Tentar novamente</Text></TouchableOpacity>
      </View> : null}
      {studentId && !loading && !error ? <>
        {first ? <View style={styles.summary}>
          <Text style={styles.white}>Última avaliação · {formatDay(first.createdAt)}</Text>
          <Text style={styles.metric}>{first.weight ?? '—'} kg</Text>
          <Text style={styles.muted}>IMC: {first.bmi ?? '—'} · Gordura corporal: {first.bodyFatPercent ?? '—'}%</Text>
          {delta !== null ? <Text testID="assessment-weight-delta" style={styles.accent}>
            Variação de peso desde a avaliação anterior: {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
          </Text> : <Text style={styles.muted}>Comparação de peso indisponível: são necessárias duas medidas.</Text>}
        </View> : <Text style={styles.muted}>Nenhuma avaliação registrada.</Text>}
        {ordered.map((a) => <View key={a.id} style={styles.entry}>
          <Text style={styles.white}>{formatDay(a.createdAt)} · {a.weight ?? '—'} kg · IMC {a.bmi ?? '—'} · {a.bodyFatPercent ?? '—'}% gordura</Text>
          {a.height != null ? <Text style={styles.muted}>Altura: {a.height} cm</Text> : null}
          {a.measurements && typeof a.measurements === 'object' ? Object.entries(a.measurements)
            .filter(([key, value]) => measurementNames[key] && typeof value === 'number')
            .map(([key, value]) => <Text key={key} style={styles.muted}>{measurementNames[key]}: {String(value)} cm</Text>) : null}
          {a.restrictions?.notes ? <Text style={styles.muted}>Restrições: {a.restrictions.notes}</Text> : null}
          {a.restrictions?.injuries?.length ? <Text style={styles.muted}>Lesões: {a.restrictions.injuries.join(', ')}</Text> : null}
          {a.notes ? <Text style={styles.muted}>Observações: {a.notes}</Text> : null}
          <Text style={styles.muted}>Treinos vinculados: {a.workoutCount ?? 0}</Text>
        </View>)}
      </> : null}
    </GlowCard>
    {canCreate && studentId ? <GlowCard style={styles.block}>
      <Text style={styles.heading}>Registrar avaliação</Text>
      <Text style={styles.muted}>Campos opcionais; quando preenchidos, medidas devem ser válidas. Altura em centímetros.</Text>
      <View style={styles.grid}>
        <Field testID="assessment-weight" label="Peso (kg)" numeric value={weight} onChangeText={setWeight} />
        <Field label="Altura (cm)" numeric value={height} onChangeText={setHeight} />
        <Field label="Gordura corporal (%)" numeric value={fat} onChangeText={setFat} />
        <Field label="Cintura (cm)" numeric value={waist} onChangeText={setWaist} />
        <Field label="Observações" value={notes} onChangeText={setNotes} />
        <Field label="Restrições / cuidados" value={restrictionNote} onChangeText={setRestrictionNote} />
      </View>
      {invalid ? <Text testID="assessment-validation" style={styles.error}>Verifique as medidas: peso, altura e cintura devem ser positivos; gordura corporal entre 0 e 100%.</Text> : null}
      <TouchableOpacity accessibilityRole="button" testID="assessment-create" style={[styles.button, (saving || invalid || !filled) && styles.disabled]}
        disabled={saving || invalid || !filled} onPress={() => { void create(); }}>
        <Text style={styles.buttonText}>{saving ? 'Salvando…' : 'Registrar avaliação'}</Text>
      </TouchableOpacity>
    </GlowCard> : null}
  </View>;
}

const styles = StyleSheet.create({
  block: { padding: 16, marginBottom: 12, gap: 10 }, heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  white: { color: '#f8fafc', fontSize: 13, fontWeight: '600' }, muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  accent: { color: '#2BF47A', fontSize: 12, fontWeight: '700' }, metric: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
  chips: { gap: 8, paddingVertical: 4 }, chip: { padding: 10, borderWidth: 1, borderColor: '#334155', borderRadius: 10 },
  selected: { borderColor: '#2BF47A', backgroundColor: '#123524' }, summary: { paddingVertical: 12, gap: 5 },
  entry: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#273248', gap: 4 },
  grid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, field: { flexGrow: 1, flexBasis: 175, gap: 5 },
  input: { backgroundColor: '#0b1120', color: '#f8fafc', padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#334155' },
  button: { backgroundColor: '#2BF47A', padding: 11, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#04140b', fontWeight: '800', fontSize: 12 }, disabled: { opacity: 0.45 },
  errorRow: { gap: 7 }, error: { color: '#fca5a5', fontSize: 12 },
});
