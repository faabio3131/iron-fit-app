import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { GlowCard } from './GlowCard';

type Exercise = {
  id: string; name: string; muscleGroup?: string | null; movement?: string | null; level?: string | null;
  videoUrl?: string | null; contraindications?: unknown;
  _count?: { workoutExercises?: number };
};
type Equipment = { id: string; name?: string; catalogItem?: { name?: string }; exerciseMapping?: unknown };
function Action({ label, testID, disabled, onPress }: {
  label: string; testID?: string; disabled?: boolean; onPress: () => void;
}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function warning(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string').slice(0, 12);
  const item = value as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of ['notes', 'description', 'warning', 'restrictions']) {
    if (typeof item[key] === 'string') lines.push(item[key] as string);
  }
  if (Array.isArray(item.conditions)) {
    lines.push(...item.conditions.filter((x): x is string => typeof x === 'string').slice(0, 12));
  }
  return lines;
}
export function ExercisesLibraryPanel({ exercises, canCreate, onUpdated }: {
  exercises: Exercise[]; canCreate: boolean; onUpdated: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [level, setLevel] = useState('');
  const [serverRows, setServerRows] = useState<Exercise[] | null>(null);
  const [compatible, setCompatible] = useState<Record<string, Equipment[]>>({});
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [movement, setMovement] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [caution, setCaution] = useState('');

  const groups = useMemo(() => Array.from(new Set(exercises.map((x) => x.muscleGroup).filter((x): x is string => !!x))).sort(), [exercises]);
  const levels = useMemo(() => Array.from(new Set(exercises.map((x) => x.level).filter((x): x is string => !!x))).sort(), [exercises]);
  const visible = (serverRows ?? exercises).filter((x) =>
    (!group || x.muscleGroup === group) && (!level || x.level === level) &&
    [x.name, x.muscleGroup, x.movement].some((v) => (v ?? '').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))),
  ).slice(0, 80);
  const validVideo = !videoUrl.trim() || /^https:\/\//i.test(videoUrl.trim());

  async function searchLibrary() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api(`/exercises${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
      setServerRows(Array.isArray(result) ? result : []);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível pesquisar exercícios.');
    } finally { setBusy(false); }
  }
  async function loadCompatible(id: string) {
    setSelectedExerciseId(id);
    setBusy(true); setError('');
    try {
      const result = await api(`/equipments/exercises/${id}/compatible`);
      setCompatible((current) => ({ ...current, [id]: Array.isArray(result) ? result : [] }));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Compatibilidade indisponível.');
    } finally { setBusy(false); }
  }
  async function createExercise() {
    if (!canCreate || !name.trim() || !validVideo || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/exercises', undefined, { method: 'POST', body: JSON.stringify({
        name: name.trim(),
        ...(newGroup.trim() ? { muscleGroup: newGroup.trim() } : {}),
        ...(movement.trim() ? { movement: movement.trim() } : {}),
        ...(newLevel.trim() ? { level: newLevel.trim() } : {}),
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
        ...(caution.trim() ? { contraindications: { notes: caution.trim() } } : {}),
      }) });
      setName(''); setNewGroup(''); setMovement(''); setNewLevel(''); setVideoUrl(''); setCaution('');
      setServerRows(null);
      setNotice('Exercício registrado na biblioteca canônica.');
      await onUpdated();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao criar exercício.');
    } finally { setBusy(false); }
  }

  return <View>
    <GlowCard style={styles.card}>
      <Text style={styles.heading}>Biblioteca de exercícios</Text>
      <Text style={styles.muted}>Pesquise exercícios globais e identifique equipamentos compatíveis do inventário da academia.</Text>
      <TextInput testID="exercise-search" value={search} onChangeText={setSearch} style={styles.input}
        placeholder="Buscar pelo exercício ou movimento" placeholderTextColor="#64748b" />
      <View style={styles.actions}>
        <Action label="Pesquisar na biblioteca" testID="exercise-search-server" disabled={busy}
          onPress={() => { void searchLibrary(); }} />
        <Action label="Limpar" onPress={() => { setSearch(''); setGroup(''); setLevel(''); setServerRows(null); }} />
      </View>
      <Text style={styles.muted}>Grupo muscular</Text>
      <ScrollView horizontal contentContainerStyle={styles.actions}>
        <Action label="Todos" onPress={() => setGroup('')} />
        {groups.map((g) => <Action key={g} label={g} onPress={() => setGroup(g)} />)}
      </ScrollView>
      <Text style={styles.muted}>Nível</Text>
      <ScrollView horizontal contentContainerStyle={styles.actions}>
        <Action label="Todos" onPress={() => setLevel('')} />
        {levels.map((l) => <Action key={l} label={l} onPress={() => setLevel(l)} />)}
      </ScrollView>
      <Text style={styles.muted}>Exibindo {visible.length} exercício(s)</Text>
      {visible.map((x) => {
        const notes = warning(x.contraindications);
        const hasVideo = typeof x.videoUrl === 'string' && /^https:\/\//i.test(x.videoUrl);
        return <View key={x.id} style={styles.entry}>
          <Text style={styles.exerciseName}>{x.name}</Text>
          <Text style={styles.muted}>
            {x.muscleGroup ?? 'Grupo não informado'} · {x.movement ?? 'Movimento não informado'} · {x.level ?? 'Nível não informado'}
          </Text>
          <Text style={styles.muted}>Utilizado em {x._count?.workoutExercises ?? 0} prescrição(ões) de treino.</Text>
          {notes.length ? <View style={styles.caution}>
            <Text style={styles.cautionTitle}>Contraindicações e cuidados</Text>
            {notes.map((n, i) => <Text key={i} style={styles.muted}>{n}</Text>)}
          </View> : null}
          <View style={styles.actions}>
            {hasVideo ? <Action testID={`exercise-video-${x.id}`} label="Abrir vídeo" onPress={() => { void Linking.openURL(x.videoUrl as string).catch(() => setError('Não foi possível abrir o vídeo.')); }} /> : null}
            <Action testID={`exercise-compatibility-${x.id}`} label="Ver equipamentos compatíveis"
              disabled={busy} onPress={() => { void loadCompatible(x.id); }} />
          </View>
          {selectedExerciseId === x.id && compatible[x.id] ? <View style={styles.compat}>
            <Text style={styles.white}>Compatibilidade com o inventário</Text>
            {compatible[x.id].length ? compatible[x.id].map((e) => <Text key={e.id} style={styles.muted}>
              {e.catalogItem?.name ?? e.name ?? 'Equipamento'}
            </Text>) : <Text style={styles.muted}>Nenhum equipamento compatível no inventário atual.</Text>}
          </View> : null}
        </View>;
      })}
      {visible.length === 0 ? <Text style={styles.muted}>Nenhum exercício corresponde aos filtros.</Text> : null}
    </GlowCard>
    {canCreate ? <GlowCard style={styles.card}>
      <Text style={styles.heading}>Cadastrar exercício</Text>
      <Text style={styles.muted}>Os campos são persistidos no domínio canônico de exercícios.</Text>
      <TextInput testID="exercise-name" placeholder="Nome do exercício" value={name} onChangeText={setName}
        placeholderTextColor="#64748b" style={styles.input} />
      <TextInput placeholder="Grupo muscular" value={newGroup} onChangeText={setNewGroup}
        placeholderTextColor="#64748b" style={styles.input} />
      <TextInput placeholder="Movimento" value={movement} onChangeText={setMovement}
        placeholderTextColor="#64748b" style={styles.input} />
      <TextInput placeholder="Nível" value={newLevel} onChangeText={setNewLevel}
        placeholderTextColor="#64748b" style={styles.input} />
      <TextInput placeholder="URL HTTPS do vídeo (opcional)" value={videoUrl} onChangeText={setVideoUrl}
        placeholderTextColor="#64748b" style={styles.input} />
      <TextInput placeholder="Contraindicações e observações de segurança" value={caution} onChangeText={setCaution}
        placeholderTextColor="#64748b" style={styles.input} />
      {!validVideo ? <Text testID="exercise-video-error" style={styles.error}>Informe endereço de vídeo HTTPS válido.</Text> : null}
      <Action label={busy ? 'Salvando…' : 'Criar exercício'} testID="exercise-create" disabled={busy || !name.trim() || !validVideo}
        onPress={() => { void createExercise(); }} />
    </GlowCard> : null}
    {notice ? <Text testID="exercise-success" style={styles.accent}>{notice}</Text> : null}
    {error ? <Text testID="exercise-error" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 }, heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  white: { color: '#f8fafc', fontSize: 13, fontWeight: '700' }, exerciseName: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 }, accent: { color: '#2BF47A', fontSize: 12 },
  input: { color: '#f8fafc', backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#334155', borderRadius: 9, padding: 10 },
  entry: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#273248', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { alignSelf: 'flex-start', padding: 10, borderRadius: 9, backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#2BF47A', fontSize: 12, fontWeight: '700' }, disabled: { opacity: 0.45 },
  compat: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, gap: 5 },
  caution: { borderLeftWidth: 2, borderLeftColor: '#eab308', paddingLeft: 10, gap: 4 },
  cautionTitle: { color: '#fde68a', fontSize: 12, fontWeight: '700' },
  error: { color: '#fca5a5', fontSize: 12, padding: 8 },
});
