import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { GlowCard } from './GlowCard';
import { brlFromMinor } from '../utils/academy-money';

type StudentSummary = { id: string; name: string; email?: string; status?: string };
type StudentProfile = StudentSummary & {
  phone?: string | null; goal?: string | null; level?: string | null;
  enrollmentDate?: string; consentHealth?: boolean; consentComm?: boolean; consentBiometry?: boolean;
};
type Assessment = { id: string; createdAt: string; weight?: number; bmi?: number; bodyFatPercent?: number };
type Workout = { id: string; goal?: string; status: string; sessions?: unknown[] };
type Booking = { id: string; date: string; status: string; slot?: { name?: string; startTime?: string } };
type Credential = { id: string; active: boolean; type?: string; expiresAt?: string };
type Charge = { id: string; amount: number; status?: string; dueDate?: string };
type Subscription = { id: string; planName?: string; status?: string };

const statusText: Record<string, string> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso',
  SCHEDULED: 'Agendado', CHECKED_IN: 'Presença confirmada', CANCELED: 'Cancelado',
  NO_SHOW: 'Não compareceu', DRAFT: 'Rascunho', PENDING_REVIEW: 'Aguardando revisão',
  APPROVED: 'Aprovado', EXPIRED: 'Expirado', PAID: 'Pago', PENDING: 'Pendente',
};
function status(value?: string) { return statusText[value ?? ''] ?? value ?? 'Não informado'; }
function day(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR');
}
function money(value: number) { return brlFromMinor(value); }
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <GlowCard style={styles.block}><Text style={styles.heading}>{title}</Text><View style={styles.blockBody}>{children}</View></GlowCard>;
}
function Action({ label, onPress, testID, disabled }: { label: string; onPress: () => void; testID?: string; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled}
    style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionLabel}>{label}</Text></TouchableOpacity>;
}

export function Student360Panel({ students, canReadWorkouts, canReadAccess, canReadFinance, canEditConsents }: {
  students: StudentSummary[];
  canReadWorkouts: boolean;
  canReadAccess: boolean;
  canReadFinance: boolean;
  canEditConsents: boolean;
}) {
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [reloadId, setReloadId] = useState(0);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<keyof Pick<StudentProfile, 'consentHealth' | 'consentComm' | 'consentBiometry'> | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let current = true;
    // Refetch from canonical student-scoped endpoints after selection or consent change.
    Promise.all([
      api(`/students/${studentId}`),
      api(`/students/${studentId}/assessments`),
      api(`/students/${studentId}/schedules`),
      canReadWorkouts ? api(`/students/${studentId}/workouts`) : Promise.resolve([]),
      canReadAccess ? api(`/access/credentials?studentId=${encodeURIComponent(studentId)}`) : Promise.resolve([]),
      canReadFinance ? api(`/financial/charges?studentId=${encodeURIComponent(studentId)}`) : Promise.resolve([]),
      canReadFinance ? api(`/financial/subscriptions?studentId=${encodeURIComponent(studentId)}`) : Promise.resolve([]),
    ]).then(([person, history, schedule, training, access, debt, plans]) => {
      if (!current) return;
      setProfile(person);
      setAssessments(Array.isArray(history) ? history : []);
      setBookings(Array.isArray(schedule) ? schedule : []);
      setWorkouts(Array.isArray(training) ? training : []);
      setCredentials(Array.isArray(access) ? access : []);
      setCharges(Array.isArray(debt) ? debt : []);
      setSubscriptions(Array.isArray(plans) ? plans : []);
      setLoading(false);
    }).catch((reason: unknown) => {
      if (current) { setError(reason instanceof Error ? reason.message : 'Falha ao consultar o aluno.'); setLoading(false); }
    });
    return () => { current = false; };
  }, [studentId, reloadId, canReadWorkouts, canReadAccess, canReadFinance]);

  function choose(id: string) {
    setStudentId(id); setProfile(null); setLoading(true); setError('');
    setPendingConsent(null); setCharges([]); setSubscriptions([]);
  }
  function refresh() {
    setLoading(true); setError(''); setReloadId((v) => v + 1);
  }
  async function updateConsent(field: 'consentHealth' | 'consentComm' | 'consentBiometry') {
    if (!profile || !canEditConsents || saving || pendingConsent !== field) return;
    setSaving(true); setError('');
    try {
      await api(`/students/${studentId}/consents`, undefined, {
        method: 'PATCH', body: JSON.stringify({ [field]: !profile[field] }),
      });
      setPendingConsent(null);
      refresh();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o consentimento.');
    } finally { setSaving(false); }
  }

  const filtered = students.filter((s) =>
    `${s.name ?? ''} ${s.email ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  const consents: { key: 'consentHealth' | 'consentComm' | 'consentBiometry'; label: string }[] = [
    { key: 'consentHealth', label: 'Dados de saúde' },
    { key: 'consentComm', label: 'Comunicações' },
    { key: 'consentBiometry', label: 'Biometria' },
  ];

  return <View>
    <Block title="Localizar aluno">
      <TextInput testID="student360-search" placeholder="Buscar pelo nome ou e-mail" placeholderTextColor="#64748b"
        value={search} onChangeText={setSearch} style={styles.input} />
      <ScrollView horizontal contentContainerStyle={styles.chips}>
        {filtered.slice(0, 60).map((s) => <TouchableOpacity key={s.id} accessibilityRole="button"
          testID={`student360-select-${s.id}`} onPress={() => choose(s.id)}
          style={[styles.chip, studentId === s.id && styles.selected]}>
          <Text style={styles.white}>{s.name}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      {filtered.length === 0 ? <Text style={styles.muted}>Nenhum aluno corresponde à busca.</Text> : null}
    </Block>
    {!studentId ? <Text style={styles.muted}>Selecione um aluno para consultar o espaço 360°.</Text> : null}
    {error ? <View style={styles.alert}><Text testID="student360-error" style={styles.error}>{error}</Text><Action label="Tentar novamente" onPress={refresh} /></View> : null}
    {loading ? <ActivityIndicator color="#2BF47A" /> : null}
    {profile && !loading ? <>
      <Block title="Perfil do aluno">
        <Text style={styles.title}>{profile.name}</Text>
        <Text style={styles.muted}>{profile.email ?? 'Sem e-mail'} · {profile.phone ?? 'Sem telefone'}</Text>
        <Text style={styles.white}>Matrícula: {status(profile.status)} · Início: {day(profile.enrollmentDate)}</Text>
        <Text style={styles.white}>Objetivo: {profile.goal ?? 'Não definido'} · Nível: {profile.level ?? 'Não definido'}</Text>
        <Action label="Atualizar dados" testID="student360-refresh" onPress={refresh} />
      </Block>
      <Block title="Consentimentos e privacidade">
        {consents.map(({ key, label }) => <View key={key} style={styles.entry}>
          <Text style={styles.white}>{label}: {profile[key] === true ? 'Autorizado' : 'Não autorizado'}</Text>
          {canEditConsents ? pendingConsent === key ? <View style={styles.actions}>
            <Text style={styles.muted}>Confirma {profile[key] ? 'revogar' : 'conceder'} este consentimento?</Text>
            <Action label="Confirmar alteração" testID={`student360-consent-confirm-${key}`} disabled={saving}
              onPress={() => { void updateConsent(key); }} />
            <Action label="Cancelar" onPress={() => setPendingConsent(null)} />
          </View> : <Action label="Alterar" testID={`student360-consent-${key}`}
            disabled={saving} onPress={() => setPendingConsent(key)} /> : null}
        </View>)}
      </Block>
      <Block title="Avaliações e evolução">
        {assessments.length ? assessments.slice(0, 12).map((a) => <View key={a.id} style={styles.entry}>
          <Text style={styles.white}>{day(a.createdAt)}</Text>
          <Text style={styles.muted}>Peso: {a.weight ?? '—'} kg · IMC: {a.bmi ?? '—'} · Gordura: {a.bodyFatPercent ?? '—'}%</Text>
        </View>) : <Text style={styles.muted}>Sem avaliações registradas.</Text>}
      </Block>
      {canReadWorkouts ? <Block title="Treinos do aluno">
        {workouts.length ? workouts.slice(0, 12).map((w) => <Text key={w.id} style={styles.white}>
          {w.goal ?? 'Treino'} · {status(w.status)} · {w.sessions?.length ?? 0} sessão(ões)
        </Text>) : <Text style={styles.muted}>Sem treinos registrados.</Text>}
      </Block> : null}
      <Block title="Agenda e presenças">
        {bookings.length ? bookings.slice(0, 20).map((b) => <Text key={b.id} style={styles.white}>
          {day(b.date)} · {b.slot?.name ?? b.slot?.startTime ?? 'Horário'} · {status(b.status)}
        </Text>) : <Text style={styles.muted}>Sem agendamentos registrados.</Text>}
      </Block>
      {canReadAccess ? <Block title="Credenciais de acesso">
        {credentials.length ? credentials.map((c) => <Text key={c.id} style={styles.white}>
          {c.type ?? 'Credencial'} · {c.active ? 'Ativa' : 'Inativa'} · Expira: {day(c.expiresAt)}
        </Text>) : <Text style={styles.muted}>Sem credenciais cadastradas.</Text>}
      </Block> : null}
      {canReadFinance ? <Block title="Plano e financeiro da academia">
        <Text style={styles.muted}>Visível somente após a autenticação administrativa reforçada.</Text>
        {subscriptions.length ? subscriptions.map((s) => <Text key={s.id} style={styles.white}>
          {s.planName ?? 'Plano'} · {status(s.status)}
        </Text>) : <Text style={styles.muted}>Sem plano financeiro cadastrado.</Text>}
        {charges.length ? charges.map((c) => <Text key={c.id} style={styles.white}>
          Cobrança: {money(c.amount)} · {day(c.dueDate)} · {status(c.status)}
        </Text>) : <Text style={styles.muted}>Sem cobranças registradas.</Text>}
      </Block> : null}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  block: { padding: 16, marginBottom: 12 }, blockBody: { marginTop: 10, gap: 9 },
  heading: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  title: { color: '#f8fafc', fontSize: 19, fontWeight: '800' },
  white: { color: '#e2e8f0', fontSize: 13 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 10 },
  selected: { borderColor: '#2BF47A', backgroundColor: '#123524' },
  input: { color: '#f8fafc', borderColor: '#334155', borderWidth: 1, borderRadius: 9, padding: 10, backgroundColor: '#0b1120' },
  entry: { borderBottomColor: '#273248', borderBottomWidth: 1, paddingVertical: 8, gap: 6 },
  action: { padding: 8, borderRadius: 8, backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155', alignSelf: 'flex-start' },
  actionLabel: { color: '#2BF47A', fontSize: 12, fontWeight: '700' }, disabled: { opacity: 0.45 },
  actions: { gap: 5 }, alert: { padding: 12, gap: 6 }, error: { color: '#fca5a5', fontSize: 13 },
});
