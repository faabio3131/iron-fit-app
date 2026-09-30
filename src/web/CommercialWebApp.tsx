import { RecordList } from './RecordList';
import { IronBrand } from '../components/IronBrand';
import { IronInput as TextInput } from '../components/IronInput';
import { DashboardOverview } from './DashboardOverview';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AccountSecurityPanel } from '../components/AccountSecurityPanel';
import { SaasBillingPanel } from '../components/SaasBillingPanel';
import { IntegrationCredentialsPanel } from '../components/IntegrationCredentialsPanel';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';
import { api } from '../services/api';

type ModuleKey = 'overview' | 'onboarding' | 'students' | 'team' | 'equipment' | 'exercises' | 'assessments' | 'workouts' | 'schedule' | 'access' | 'financial' | 'saasBilling' | 'security' | 'entitlements' | 'integrations' | 'creator';
type Entitlement = { featureKey: string; kind: 'FEATURE' | 'LIMIT' | 'POLICY'; value: boolean | number | string[] | null; source?: string; reason?: string | null };
type ModuleDefinition = { key: ModuleKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; roles?: string[]; entitlement?: string[] };

const operational = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION'];
const staff = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION', 'TRAINER'];
const modules: ModuleDefinition[] = [
  { key: 'overview', label: 'Visão geral', icon: 'grid-outline', roles: operational },
  { key: 'onboarding', label: 'Configuração inicial', icon: 'rocket-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'students', label: 'Alunos', icon: 'people-outline', roles: staff },
  { key: 'team', label: 'Equipe', icon: 'shield-checkmark-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'equipment', label: 'Equipamentos', icon: 'barbell-outline', roles: staff, entitlement: ['equipment.catalog', 'equipment.inventory'] },
  { key: 'exercises', label: 'Exercícios', icon: 'fitness-outline', roles: staff },
  { key: 'assessments', label: 'Avaliações', icon: 'pulse-outline', roles: staff },
  { key: 'workouts', label: 'Treinos', icon: 'clipboard-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'] },
  { key: 'schedule', label: 'Agenda', icon: 'calendar-outline', roles: staff },
  { key: 'access', label: 'Acessos', icon: 'key-outline', roles: operational },
  { key: 'financial', label: 'Financeiro', icon: 'wallet-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] },
  { key: 'saasBilling', label: 'Assinatura IRON', icon: 'card-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'security', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { key: 'entitlements', label: 'Plano e configurações', icon: 'layers-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'integrations', label: 'Integrações', icon: 'git-network-outline', roles: ['OWNER'] },
  { key: 'creator', label: 'Creator Network', icon: 'images-outline', roles: ['OWNER', 'MANAGER'], entitlement: ['content.external_youtube', 'content.iron_managed', 'content.tenant_private'] },
];
const onboardingLabels: Record<string, string> = { ACADEMY_PROFILE: 'Perfil da academia', EQUIPMENT_INVENTORY: 'Inventário de equipamentos', TEAM_REVIEW: 'Revisão da equipe', FINISH: 'Finalizar configuração' };
const teamRoleOptions = [
  { id: 'TRAINER', name: 'Professor' },
  { id: 'RECEPTION', name: 'Recepção' },
  { id: 'MANAGER', name: 'Gerente' },
];
const featureLabels: Record<string, string> = {
  'equipment.catalog': 'Catálogo de equipamentos',
  'equipment.inventory': 'Inventário de equipamentos',
  'ai.workout_generation': 'Geração assistida de treinos',
  'content.external_youtube': 'Conteúdo externo do YouTube',
  'content.iron_managed': 'Conteúdo gerenciado pelo IRON',
  'content.tenant_private': 'Conteúdo privado da academia',
};
const entitlementKindLabels: Record<string, string> = { FEATURE: 'Recurso', LIMIT: 'Limite', POLICY: 'Regra' };
const entitlementSourceLabels: Record<string, string> = {
  PLAN: 'Plano',
  TENANT_CONFIGURATION: 'Configuração da academia',
  FAIL_CLOSED_DEFAULT: 'Bloqueado por segurança',
};
function featureLabel(key: string) {
  return featureLabels[key] ?? key.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
function entitlementValueText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo';
  if (Array.isArray(value)) return value.join(', ') || 'Nenhuma opção';
  if (value == null) return 'Não definido';
  return String(value);
}

function list(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ['items', 'data', 'results', 'students', 'users', 'charges', 'events']) if (Array.isArray(value?.[key])) return value[key];
  return [];
}
function message(error: unknown) {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 403) return 'Seu perfil não possui permissão para esta operação.';
    if (status === 401) return 'Sua sessão expirou. Entre novamente.';
    return error.message;
  }
  return 'Não foi possível concluir a operação.';
}
function Field({ label, value, onChangeText, secureTextEntry, numeric }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; numeric?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={numeric ? 'numeric' : 'default'} placeholderTextColor="#9fb0c5" /></View>;
}
function Button({ label, onPress, disabled, secondary, testID, disabledReason }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; testID?: string; disabledReason?: string }) {
  const hint = disabled ? (disabledReason ?? 'Preencha ou selecione os dados obrigatórios para continuar.') : '';
  return <View style={styles.buttonWrap}><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} testID={testID} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>{hint ? <Text style={styles.buttonHint}>{hint}</Text> : null}</View>;
}
function Section({ title, children, subtitle, compact }: { title: string; children: React.ReactNode; subtitle?: string; compact?: boolean }) {
  return <View style={[styles.section, compact && styles.sectionCompact]}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}<View style={[styles.sectionBody, compact && styles.sectionBodyCompact]}>{children}</View></View>;
}
function Data({ value, empty = 'Nenhum registro encontrado.' }: { value: any; empty?: string }) {
  return <RecordList rows={list(value)} empty={empty} />;
}
function Chips({ rows, selected, onSelect }: { rows: any[]; selected: string; onSelect: (id: string) => void }) {
  return <View style={styles.chips}>{rows.map((row) => <TouchableOpacity key={row.id} style={[styles.chip, selected === row.id && styles.chipActive]} onPress={() => onSelect(row.id)}><Text style={styles.chipText}>{row.name ?? row.user?.name ?? row.id}</Text></TouchableOpacity>)}</View>;
}

export function CommercialWebApp() {
  const { profile, activeTenantId, logout } = useAuth();
  const compact = useWindowDimensions().width < 980;
  const roles = useMemo<string[]>(() => Array.isArray(profile?.roles) ? profile.roles : [], [profile]);
  const permissions = useMemo<string[]>(() => Array.isArray(profile?.permissions) ? profile.permissions : [], [profile]);
  const [active, setActive] = useState<ModuleKey>('overview');
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [trial, setTrial] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shellReady, setShellReady] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedFinancialStudent, setSelectedFinancialStudent] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [student, setStudent] = useState({ name: '', email: '', phone: '' });
  const [lastStudentInvite, setLastStudentInvite] = useState<any>(null);
  const [member, setMember] = useState({ name: '', email: '', password: '', phone: '', roleName: 'TRAINER' });
  const [selectedCatalogEquipment, setSelectedCatalogEquipment] = useState('');
  const [exercise, setExercise] = useState({ name: '', muscleGroup: '', level: '' });
  const [assessment, setAssessment] = useState({ weight: '', height: '', bodyFatPercent: '', notes: '' });
  const [schedule, setSchedule] = useState({ weekday: '1', startTime: '08:00', endTime: '09:00', capacity: '10' });
  const [account, setAccount] = useState({ name: '', type: 'CASH', initialBalance: '0' });
  const [studentPlan, setStudentPlan] = useState({ planName: '', amount: '', nextBillingAt: '' });
  const [charge, setCharge] = useState({ amount: '', dueDate: '', paymentMethod: '' });
  const [academy, setAcademy] = useState({ name: '', timezone: 'America/Sao_Paulo' });
  const [aiInstructions, setAiInstructions] = useState('');
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [workoutDraft, setWorkoutDraft] = useState({ goal: '', level: '', weeklyFrequency: '', notes: '' });
  const [selectedScheduleStudent, setSelectedScheduleStudent] = useState('');
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [selectedAccessStudent, setSelectedAccessStudent] = useState('');
  const [credentialType, setCredentialType] = useState('QR_CODE');
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('');
  const [lastCredential, setLastCredential] = useState<any>(null);

  const entitlementMap = useMemo(() => new Map(entitlements.map((item) => [item.featureKey, item])), [entitlements]);
  const enabled = useCallback((key: string) => entitlementMap.get(key)?.value === true, [entitlementMap]);
  const allowed = useCallback((item: ModuleDefinition) => (!item.roles || item.roles.some((role) => roles.includes(role))) && (!item.entitlement || item.entitlement.some(enabled)), [enabled, roles]);
  const can = useCallback((...targets: string[]) => targets.some((role) => roles.includes(role)), [roles]);
  const blocked = shellReady && (!subscription || trial?.status === 'EXPIRED' || trial?.status === 'INACTIVE' || subscription?.status === 'SUSPENDED');
  const visible = useMemo(() => modules.filter((item) => allowed(item) && (!blocked || item.key === 'saasBilling' || item.key === 'security')), [allowed, blocked]);

  const loadShell = useCallback(async () => {
    setShellReady(false);
    setError('');
    const [features, current, trialState, onboardingState] = await Promise.all([
      api('/product-entitlements/tenant/features'),
      api('/product-entitlements/tenant/current'),
      api('/commercial/trial/status'),
      can('OWNER', 'MANAGER') ? api('/commercial/onboarding') : Promise.resolve(null),
    ]);
    setEntitlements(Array.isArray(features) ? features : []);
    setSubscription(current);
    setTrial(trialState);
    setOnboarding(onboardingState);
    setShellReady(true);
  }, [can]);

  const loadModule = useCallback(async (key: ModuleKey) => {
    setLoading(true); setError('');
    try {
      const next: Record<string, any> = {};
      if (key === 'overview') {
        const canSeeFinancialDashboard = can('SUPER_ADMIN', 'OWNER', 'MANAGER');
        const [summary, revenue, attendance, overdue, birthdays, gym] = await Promise.all([
          api('/dashboard/summary'),
          canSeeFinancialDashboard ? api('/dashboard/revenue?days=30') : Promise.resolve(null),
          api('/dashboard/attendance?days=7'),
          canSeeFinancialDashboard ? api('/dashboard/overdue') : Promise.resolve(null),
          api('/dashboard/birthdays?days=30'),
          activeTenantId && can('OWNER', 'MANAGER') ? api(`/gyms/${activeTenantId}`).catch(() => null) : Promise.resolve(null),
        ]); Object.assign(next, { summary, revenue, attendance, overdue, birthdays, gym });
      }
      if (key === 'students') next.students = await api('/students');
      if (key === 'team') next.users = await api('/users');
      if (key === 'equipment') { const calls: Promise<any>[] = [api('/equipments')]; if (enabled('equipment.catalog')) calls.push(api('/equipments/catalog')); const [inventory, catalog] = await Promise.all(calls); Object.assign(next, { inventory, catalog: catalog ?? [] }); }
      if (key === 'exercises') next.exercises = await api('/exercises');
      if (key === 'assessments') { next.students = await api('/students'); if (selectedStudent) next.assessments = await api(`/students/${selectedStudent}/assessments`); }
      if (key === 'workouts') { [next.workouts, next.students] = await Promise.all([api('/workouts'), api('/students')]); }
      if (key === 'schedule') { [next.slots, next.students] = await Promise.all([api('/schedule-slots'), api('/students')]); }
      if (key === 'access') { [next.events, next.students] = await Promise.all([api('/access/events'), api('/students')]); }
      if (key === 'financial') { [next.accounts, next.charges, next.students] = await Promise.all([api('/financial/accounts'), api('/financial/charges'), api('/students')]); }
      if (key === 'entitlements') { [next.features, next.configurations] = await Promise.all([api('/product-entitlements/tenant/features'), api('/product-entitlements/tenant/configurations')]); next.subscription = subscription; }
      if (key === 'creator') { [next.items, next.overview, next.analytics] = await Promise.all([api('/creator-network/content/tenant/items'), api('/creator-network/operations/tenant/overview'), api('/creator-network/operations/tenant/analytics?days=30')]); }
      setData(next);
    } catch (reason) { setError(message(reason)); setData({}); } finally { setLoading(false); }
  }, [activeTenantId, can, enabled, selectedStudent, subscription]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShell().catch((reason) => { setError(message(reason)); setLoading(false); });
    }, 0);
    return () => clearTimeout(timer);
  }, [loadShell]);
  useEffect(() => {
    if (!shellReady || blocked) return undefined;
    const timer = setTimeout(() => {
      void loadModule(active);
    }, 0);
    return () => clearTimeout(timer);
  }, [active, blocked, loadModule, shellReady]);
  async function mutate(operation: () => Promise<unknown>, reset?: () => void) {
    setSaving(true); setError('');
    try { await operation(); reset?.(); await loadShell(); await loadModule(active); } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  }
  function overview() {
    return <DashboardOverview data={data} showFinancial={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} canNavigate={(key) => visible.some(item => item.key === key)} navigate={(key) => { if (visible.some(item => item.key === key)) setActive(key); }} />;
  }
  function onboardingView() {
    const step = onboarding?.nextStep as string | undefined;
    return <Section title="Primeiros passos" subtitle="Complete as etapas para preparar a operação da sua academia."><Data value={onboarding ? [onboarding] : []} />{step === 'ACADEMY_PROFILE' ? <View style={styles.form}><Field label="Nome da academia" value={academy.name} onChangeText={(name) => setAcademy((v) => ({ ...v, name }))} /><Field label="Fuso horário" value={academy.timezone} onChangeText={(timezone) => setAcademy((v) => ({ ...v, timezone }))} /></View> : null}{step ? <Button testID="onboarding-complete-step" label={saving ? 'Salvando…' : `Concluir: ${onboardingLabels[step] ?? step}`} disabled={saving || (step === 'ACADEMY_PROFILE' && !academy.name.trim())} onPress={() => void mutate(() => api('/commercial/onboarding', undefined, { method: 'PATCH', body: JSON.stringify({ step, ...(step === 'ACADEMY_PROFILE' ? { data: { name: academy.name.trim(), timezone: academy.timezone.trim() } } : {}) }) }))} /> : <Text style={styles.success}>Onboarding concluído.</Text>}</Section>;
  }
  function studentsView() {
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Cadastrar aluno"><View style={styles.form}><Field label="Nome" value={student.name} onChangeText={(name) => setStudent((v) => ({ ...v, name }))} /><Field label="E-mail" value={student.email} onChangeText={(email) => setStudent((v) => ({ ...v, email }))} /><Field label="Telefone" value={student.phone} onChangeText={(phone) => setStudent((v) => ({ ...v, phone }))} /></View><Button testID="student-create" label="Cadastrar aluno" disabled={saving || !student.name.trim() || !student.email.trim()} onPress={() => void mutate(async () => { const created = await api('/students', undefined, { method: 'POST', body: JSON.stringify({ name: student.name.trim(), email: student.email.trim().toLowerCase(), ...(student.phone.trim() ? { phone: student.phone.trim() } : {}) }) }); setLastStudentInvite(created?.onboarding?.required ? created.onboarding : null); return created; }, () => setStudent({ name: '', email: '', phone: '' }))} />{lastStudentInvite ? <View style={styles.invite}><Text style={styles.rowTitle}>Convite de ativação — exibir uma vez</Text><Text selectable style={styles.json}>{lastStudentInvite.token}</Text><Text style={styles.muted}>Expira em: {String(lastStudentInvite.expiresAt ?? '—')}</Text></View> : null}</Section> : null}<Section title="Alunos"><Data value={data.students} /></Section></>;
  }
  function teamView() {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email.trim());
    const roleOk = teamRoleOptions.some((option) => option.id === member.roleName);
    const issue = !member.name.trim()
      ? 'Informe o nome do membro da equipe.'
      : !emailOk
        ? 'Informe um e-mail válido.'
        : !strongPassword(member.password)
          ? PASSWORD_POLICY_TEXT
          : !roleOk
            ? 'Selecione uma função permitida.'
            : '';
    return <><Section title="Adicionar membro à equipe" subtitle="Cadastre somente perfis operacionais autorizados. Funções administrativas superiores não são oferecidas neste formulário."><View style={styles.form}><Field label="Nome" value={member.name} onChangeText={(name) => setMember((v) => ({ ...v, name }))} /><Field label="E-mail" value={member.email} onChangeText={(email) => setMember((v) => ({ ...v, email }))} /><Field label="Senha inicial" value={member.password} secureTextEntry onChangeText={(password) => setMember((v) => ({ ...v, password }))} /></View><Text style={styles.label}>Função</Text><Chips rows={teamRoleOptions} selected={member.roleName} onSelect={(roleName) => setMember((v) => ({ ...v, roleName }))} /><Text style={styles.helper}>{PASSWORD_POLICY_TEXT}</Text>{issue ? <Text style={styles.helper}>Antes de adicionar: {issue}</Text> : null}<Button testID="team-add" label={saving ? 'Adicionando…' : 'Adicionar à equipe'} disabled={saving} onPress={() => { if (issue) { setError(issue); return; } void mutate(() => api('/users', undefined, { method: 'POST', body: JSON.stringify({ name: member.name.trim(), email: member.email.trim().toLowerCase(), password: member.password, roleName: member.roleName }) }), () => setMember({ name: '', email: '', password: '', phone: '', roleName: 'TRAINER' })); }} /></Section><Section title="Equipe"><Data value={data.users} /></Section><Section title="Permissões da sessão" subtitle="Estas permissões são informativas. A autorização final é validada pelo servidor."><Data value={permissions.map((name) => ({ name }))} /></Section></>;
  }
  function equipmentView() {
    const catalog = list(data.catalog);
    return <>
      {enabled('equipment.inventory') && enabled('equipment.catalog') && can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? (
        <Section
          title="Selecionar equipamento do catálogo"
          subtitle="Escolha os equipamentos disponíveis na sua academia."
        >
          <Chips
            rows={catalog}
            selected={selectedCatalogEquipment}
            onSelect={setSelectedCatalogEquipment}
          />
          <Button
            testID="equipment-catalog-select"
            label="Adicionar ao inventário"
            disabled={saving || !selectedCatalogEquipment}
            onPress={() => void mutate(
              () => api('/equipments/catalog/selection', undefined, {
                method: 'POST',
                body: JSON.stringify({ catalogItemIds: [selectedCatalogEquipment] }),
              }),
              () => setSelectedCatalogEquipment(''),
            )}
          />
        </Section>
      ) : null}
      <Section title="Inventário"><Data value={data.inventory} /></Section>
      {enabled('equipment.catalog') ? <Section title="Catálogo canônico"><Data value={data.catalog} /></Section> : null}
    </>;
  }
  function exercisesView() {
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? <Section title="Novo exercício"><View style={styles.form}><Field label="Nome" value={exercise.name} onChangeText={(name) => setExercise((v) => ({ ...v, name }))} /><Field label="Grupo muscular" value={exercise.muscleGroup} onChangeText={(muscleGroup) => setExercise((v) => ({ ...v, muscleGroup }))} /><Field label="Nível" value={exercise.level} onChangeText={(level) => setExercise((v) => ({ ...v, level }))} /></View><Button label="Criar exercício" disabled={saving || !exercise.name.trim()} onPress={() => void mutate(() => api('/exercises', undefined, { method: 'POST', body: JSON.stringify({ name: exercise.name.trim(), ...(exercise.muscleGroup.trim() ? { muscleGroup: exercise.muscleGroup.trim() } : {}), ...(exercise.level.trim() ? { level: exercise.level.trim() } : {}) }) }), () => setExercise({ name: '', muscleGroup: '', level: '' }))} /></Section> : null}<Section title="Biblioteca"><Data value={data.exercises} /></Section></>;
  }
  function assessmentsView() {
    const students = list(data.students);
    const number = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
    return <Section title="Avaliações"><Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} />{selectedStudent && can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? <><View style={styles.form}><Field label="Peso" value={assessment.weight} numeric onChangeText={(weight) => setAssessment((v) => ({ ...v, weight }))} /><Field label="Altura" value={assessment.height} numeric onChangeText={(height) => setAssessment((v) => ({ ...v, height }))} /><Field label="% gordura" value={assessment.bodyFatPercent} numeric onChangeText={(bodyFatPercent) => setAssessment((v) => ({ ...v, bodyFatPercent }))} /><Field label="Observações" value={assessment.notes} onChangeText={(notes) => setAssessment((v) => ({ ...v, notes }))} /></View><Button label="Registrar avaliação" disabled={saving} onPress={() => void mutate(() => api(`/students/${selectedStudent}/assessments`, undefined, { method: 'POST', body: JSON.stringify({ ...(number(assessment.weight) !== undefined ? { weight: number(assessment.weight) } : {}), ...(number(assessment.height) !== undefined ? { height: number(assessment.height) } : {}), ...(number(assessment.bodyFatPercent) !== undefined ? { bodyFatPercent: number(assessment.bodyFatPercent) } : {}), ...(assessment.notes.trim() ? { notes: assessment.notes.trim() } : {}) }) }), () => setAssessment({ weight: '', height: '', bodyFatPercent: '', notes: '' }))} /></> : null}<Data value={data.assessments} empty={selectedStudent ? 'Nenhuma avaliação.' : 'Selecione um aluno.'} /></Section>;
  }
  function workoutsView() {
    const students = list(data.students); const workouts = list(data.workouts);
    const weeklyFrequency = workoutDraft.weeklyFrequency.trim() ? Number(workoutDraft.weeklyFrequency) : undefined;
    return <><Section title="Criar treino manual" subtitle="Monte um rascunho de treino para revisar antes de ativar."><Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} /><View style={styles.form}><Field label="Objetivo" value={workoutDraft.goal} onChangeText={(goal) => setWorkoutDraft((v) => ({ ...v, goal }))} /><Field label="Nível" value={workoutDraft.level} onChangeText={(level) => setWorkoutDraft((v) => ({ ...v, level }))} /><Field label="Frequência semanal" value={workoutDraft.weeklyFrequency} numeric onChangeText={(value) => setWorkoutDraft((v) => ({ ...v, weeklyFrequency: value }))} /><Field label="Observações" value={workoutDraft.notes} onChangeText={(notes) => setWorkoutDraft((v) => ({ ...v, notes }))} /></View><Button testID="manual-workout-create" label="Criar rascunho" disabled={saving || !selectedStudent || (weeklyFrequency !== undefined && (!Number.isInteger(weeklyFrequency) || weeklyFrequency < 1))} onPress={() => void mutate(() => api('/workouts', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent, ...(workoutDraft.goal.trim() ? { goal: workoutDraft.goal.trim() } : {}), ...(workoutDraft.level.trim() ? { level: workoutDraft.level.trim() } : {}), ...(weeklyFrequency !== undefined ? { weeklyFrequency } : {}), ...(workoutDraft.notes.trim() ? { notes: workoutDraft.notes.trim() } : {}) }) }), () => setWorkoutDraft({ goal: '', level: '', weeklyFrequency: '', notes: '' }))} /></Section>{enabled('ai.workout_generation') ? <Section title="Iron Intelligence — candidato de treino" subtitle="Receba uma sugestão da IA e revise antes de aprovar ou ativar."><Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} /><Field label="Instruções opcionais" value={aiInstructions} onChangeText={setAiInstructions} /><Button label="Gerar candidato" disabled={saving || !selectedStudent} onPress={() => void mutate(() => api('/ai/workout-candidates', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent, ...(aiInstructions.trim() ? { instructions: aiInstructions.trim() } : {}) }) }))} /></Section> : null}<Section title="Treinos e revisão humana">{workouts.length ? workouts.map((workout: any) => <View key={workout.id} style={styles.row}><Text style={styles.rowTitle}>{workout.student?.user?.name ?? workout.goal ?? workout.id}</Text><Text style={styles.muted}>Status: {workout.status} · IA: {workout.createdByAI ? 'sim' : 'não'}</Text>{workout.status === 'PENDING_REVIEW' ? <View style={styles.actions}><Button label="Aprovar" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) }))} /><Button secondary label="Ativar" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) }))} /></View> : null}</View>) : <Text style={styles.muted}>Nenhum treino encontrado.</Text>}</Section></>;
  }
  function scheduleView() {
    const students = list(data.students); const slots = list(data.slots);
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? <Section title="Criar horário"><View style={styles.form}><Field label="Dia da semana (0 a 6)" value={schedule.weekday} numeric onChangeText={(weekday) => setSchedule((v) => ({ ...v, weekday }))} /><Field label="Início" value={schedule.startTime} onChangeText={(startTime) => setSchedule((v) => ({ ...v, startTime }))} /><Field label="Fim" value={schedule.endTime} onChangeText={(endTime) => setSchedule((v) => ({ ...v, endTime }))} /><Field label="Capacidade" value={schedule.capacity} numeric onChangeText={(capacity) => setSchedule((v) => ({ ...v, capacity }))} /></View><Button label="Criar horário" disabled={saving} onPress={() => void mutate(() => api('/schedule-slots', undefined, { method: 'POST', body: JSON.stringify({ weekday: Number(schedule.weekday), startTime: schedule.startTime.trim(), endTime: schedule.endTime.trim(), capacity: Number(schedule.capacity), active: true }) }))} /></Section> : null}{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Agendar aluno e check-in" subtitle="Selecione o aluno, o horário e a data do agendamento."><Text style={styles.label}>Aluno</Text><Chips rows={students} selected={selectedScheduleStudent} onSelect={setSelectedScheduleStudent} /><Text style={styles.label}>Horário</Text><Chips rows={slots} selected={selectedScheduleSlot} onSelect={setSelectedScheduleSlot} /><Field label="Data (AAAA-MM-DD)" value={bookingDate} onChangeText={setBookingDate} /><Button testID="schedule-book" label="Agendar aluno" disabled={saving || !selectedScheduleStudent || !selectedScheduleSlot || !bookingDate.trim()} onPress={() => void mutate(async () => { const created = await api('/schedules', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedScheduleStudent, slotId: selectedScheduleSlot, date: bookingDate.trim() }) }); setLastBooking(created); return created; })} />{lastBooking?.id ? <View style={styles.invite}><Text style={styles.rowTitle}>Agendamento criado</Text><Text style={styles.muted}>Identificador: {lastBooking.id}</Text><Button secondary testID="schedule-check-in" label="Registrar check-in" disabled={saving} onPress={() => void mutate(() => api(`/schedules/${lastBooking.id}/check-in`, undefined, { method: 'PATCH' }), () => setLastBooking(null))} /></View> : null}</Section> : null}<Section title="Agenda"><Data value={slots} /></Section></>;
  }
  function accessView() {
    const students = list(data.students);
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Emitir credencial de acesso" subtitle="Guarde a credencial ao emiti-la. O código só é exibido uma vez."><Chips rows={students} selected={selectedAccessStudent} onSelect={setSelectedAccessStudent} /><View style={styles.form}><Field label="Tipo" value={credentialType} onChangeText={setCredentialType} /><Field label="Validade (AAAA-MM-DD, opcional)" value={credentialExpiresAt} onChangeText={setCredentialExpiresAt} /></View><Button testID="access-credential-create" label="Gerar credencial" disabled={saving || !selectedAccessStudent} onPress={() => void mutate(async () => { const created = await api('/access/credentials', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedAccessStudent, ...(credentialType.trim() ? { type: credentialType.trim() } : {}), ...(credentialExpiresAt.trim() ? { expiresAt: credentialExpiresAt.trim() } : {}) }) }); setLastCredential(created); return created; })} />{lastCredential?.qrToken ? <View style={styles.invite}><Text style={styles.rowTitle}>Código QR — exibir uma única vez</Text><Text selectable style={styles.json}>{lastCredential.qrToken}</Text><Text style={styles.muted}>Credencial: {lastCredential.credentialId ?? '—'} · Tipo: {lastCredential.type ?? '—'}</Text><Button secondary label="Ocultar token" onPress={() => setLastCredential(null)} /></View> : null}</Section> : null}<Section title="Histórico de acessos"><Data value={data.events} /></Section></>;
  }
  function financialView() {
    const students = list(data.students); const accounts = list(data.accounts); const charges = list(data.charges);
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? <Section title="Nova conta financeira"><View style={styles.form}><Field label="Nome" value={account.name} onChangeText={(name) => setAccount((v) => ({ ...v, name }))} /><Field label="Tipo" value={account.type} onChangeText={(type) => setAccount((v) => ({ ...v, type }))} /><Field label="Saldo inicial" value={account.initialBalance} numeric onChangeText={(initialBalance) => setAccount((v) => ({ ...v, initialBalance }))} /></View><Button label="Criar conta" disabled={saving || !account.name.trim()} onPress={() => void mutate(() => api('/financial/accounts', undefined, { method: 'POST', body: JSON.stringify({ name: account.name.trim(), type: account.type.trim(), initialBalance: Number(account.initialBalance) || 0 }) }), () => setAccount({ name: '', type: 'CASH', initialBalance: '0' }))} /></Section> : null}<Section title="Plano e cobrança do aluno" subtitle="Gerencie os planos e as cobranças dos seus alunos."><Chips rows={students} selected={selectedFinancialStudent} onSelect={setSelectedFinancialStudent} /><View style={styles.form}><Field label="Plano do aluno" value={studentPlan.planName} onChangeText={(planName) => setStudentPlan((v) => ({ ...v, planName }))} /><Field label="Valor" value={studentPlan.amount} numeric onChangeText={(amount) => setStudentPlan((v) => ({ ...v, amount }))} /><Field label="Próxima cobrança (AAAA-MM-DD)" value={studentPlan.nextBillingAt} onChangeText={(nextBillingAt) => setStudentPlan((v) => ({ ...v, nextBillingAt }))} /></View><Button label="Criar assinatura do aluno" disabled={saving || !selectedFinancialStudent || !studentPlan.planName.trim() || !studentPlan.amount.trim() || !Number.isInteger(Number(studentPlan.amount))} onPress={() => void mutate(() => api('/financial/subscriptions', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, planName: studentPlan.planName.trim(), amount: Number(studentPlan.amount), ...(studentPlan.nextBillingAt.trim() ? { nextBillingAt: studentPlan.nextBillingAt.trim() } : {}) }) }))} /><View style={styles.form}><Field label="Valor da cobrança" value={charge.amount} numeric onChangeText={(amount) => setCharge((v) => ({ ...v, amount }))} /><Field label="Vencimento (AAAA-MM-DD)" value={charge.dueDate} onChangeText={(dueDate) => setCharge((v) => ({ ...v, dueDate }))} /><Field label="Meio de pagamento" value={charge.paymentMethod} onChangeText={(paymentMethod) => setCharge((v) => ({ ...v, paymentMethod }))} /></View><Button secondary label="Criar cobrança" disabled={saving || !selectedFinancialStudent || !charge.amount.trim() || !Number.isInteger(Number(charge.amount)) || !charge.dueDate.trim()} onPress={() => void mutate(() => api('/financial/charges', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, amount: Number(charge.amount), dueDate: charge.dueDate.trim(), ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /></Section><Section title="Contas"><Chips rows={accounts} selected={selectedAccount} onSelect={setSelectedAccount} /><Data value={accounts} /></Section><Section title="Cobranças">{charges.length ? charges.map((item: any) => <View key={item.id} style={styles.row}><Text style={styles.rowTitle}>{item.student?.user?.name ?? item.studentId ?? item.id}</Text><Text style={styles.muted}>Status: {item.status} · Valor: {item.amount} · Vencimento: {String(item.dueDate ?? '—')}</Text>{item.status !== 'PAID' ? <Button label="Marcar como paga" disabled={saving || !selectedAccount} onPress={() => void mutate(() => api(`/financial/charges/${item.id}/pay`, undefined, { method: 'PATCH', body: JSON.stringify({ accountId: selectedAccount, ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /> : null}</View>) : <Text style={styles.muted}>Nenhuma cobrança.</Text>}</Section></>;
  }
  function entitlementsView() {
    const features = list(data.features);
    const configure = (feature: any) => {
      const raw = (configDraft[feature.featureKey] ?? '').trim();
      if (feature.kind === 'FEATURE') return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ featureEnabled: false }) }));
      if (feature.kind === 'LIMIT') { const limitValue = Number(raw); if (!raw || !Number.isInteger(limitValue) || limitValue < 0) { setError('Informe limite inteiro não negativo.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ limitValue }) })); }
      const policyValues = raw.split(',').map((value) => value.trim()).filter(Boolean); if (!policyValues.length) { setError('Informe valores de policy separados por vírgula.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ policyValues }) }));
    };
    return <><Section title="Assinatura atual do IRON"><Data value={data.subscription ? [data.subscription] : []} /></Section><Section title="Recursos e configurações" subtitle="Personalize os recursos disponíveis no plano da sua academia.">{features.map((feature: any) => <View key={feature.featureKey} style={styles.row}><Text style={styles.rowTitle}>{featureLabel(feature.featureKey)}</Text><Text style={styles.muted}>Tipo: {entitlementKindLabels[feature.kind] ?? feature.kind} · Estado: {entitlementValueText(feature.value)} · Origem: {entitlementSourceLabels[feature.source] ?? feature.source ?? '—'} {feature.reason ? `· ${feature.reason}` : ''}</Text>{feature.kind !== 'FEATURE' ? <Field label={feature.kind === 'LIMIT' ? 'Novo limite' : 'Regras separadas por vírgula'} value={configDraft[feature.featureKey] ?? ''} onChangeText={(value) => setConfigDraft((current) => ({ ...current, [feature.featureKey]: value }))} /> : null}<View style={styles.actions}><Button label={feature.kind === 'FEATURE' ? 'Desativar para a academia' : 'Aplicar configuração'} disabled={saving || feature.source === 'FAIL_CLOSED_DEFAULT'} onPress={() => { void configure(feature); }} /><Button secondary label="Herdar do plano" disabled={saving} onPress={() => void mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'DELETE' }))} /></View></View>)}</Section><Section title="Configurações da academia"><Data value={data.configurations} /></Section></>;
  }
  function creatorView() {
    return <View style={styles.creatorWrap}><View style={styles.creatorHero}><Text style={styles.creatorTitle}>Creator Network</Text><Text style={styles.muted}>Conteúdo, utilização e desempenho da rede de criadores vinculada à sua academia.</Text></View><View style={styles.creatorGrid}><Section compact title="Visão geral" subtitle="Resumo operacional da rede de criadores."><Data value={data.overview ? [data.overview] : []} /></Section><Section compact title="Conteúdo" subtitle="Materiais disponíveis para utilização na academia."><Data value={data.items} /></Section><Section compact title="Indicadores" subtitle="Desempenho dos últimos 30 dias."><Data value={data.analytics ? [data.analytics] : []} /></Section></View></View>;
  }
  function content() {
    if (active === 'overview') return overview(); if (active === 'onboarding') return onboardingView(); if (active === 'students') return studentsView(); if (active === 'team') return teamView(); if (active === 'equipment') return equipmentView(); if (active === 'exercises') return exercisesView(); if (active === 'assessments') return assessmentsView(); if (active === 'workouts') return workoutsView(); if (active === 'schedule') return scheduleView(); if (active === 'access') return accessView(); if (active === 'financial') return financialView(); if (active === 'saasBilling') return <SaasBillingPanel onCommercialStateChanged={loadShell} />; if (active === 'security') return <AccountSecurityPanel />; if (active === 'entitlements') return entitlementsView(); if (active === 'integrations') return <IntegrationCredentialsPanel />; return creatorView();
  }

  const topBar = <View style={styles.top}><IronBrand compact /><View style={styles.actions}><Text style={styles.muted}>{profile?.name ?? profile?.email ?? 'Usuário'}</Text><Button testID="commercial-logout" secondary label="Sair" onPress={() => { void logout(); }} /></View></View>;
  if (!shellReady) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={styles.contentInner}>{error ? <Text style={styles.error}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Preparando sua academia…</Text></View>}</View></View>;
  if (blocked) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#dbeafe' : '#9fb0c5'} /><Text style={styles.navText}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.warning} testID="subscription-blocked"><Text style={styles.warningTitle}>Acesso comercial limitado</Text><Text style={styles.muted}>Seu acesso operacional está limitado. Consulte sua assinatura para regularizar o acesso. A segurança da conta continua disponível.</Text></View><Section title="Estado comercial"><Data value={[{ trialStatus: trial?.status ?? null, subscriptionStatus: subscription?.status ?? null, subscriptionId: subscription?.id ?? null }]} /></Section>{active === 'security' ? <AccountSecurityPanel /> : <SaasBillingPanel onCommercialStateChanged={loadShell} />}</ScrollView></View></View>;
  return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#dbeafe' : '#9fb0c5'} /><Text style={styles.navText}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.pageHead}><View><Text style={styles.title}>{modules.find((item) => item.key === active)?.label}</Text><Text style={styles.muted}>{data.gym?.name ?? 'Gestão da academia'}</Text></View><Button secondary label="Atualizar" onPress={() => { void loadModule(active); }} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Carregando informações…</Text></View> : content()}</ScrollView></View></View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#030811' },
  top: { minHeight: 72, flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingVertical: 0, backgroundColor: '#050b14', borderBottomWidth: 1, borderBottomColor: '#203b55', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#eef7ff', fontSize: 23, fontWeight: '900', letterSpacing: 4 },
  body: { flex: 1, flexDirection: 'row' }, bodyCompact: { flexDirection: 'column' },
  nav: { width: 232, minWidth: 232, maxWidth: 232, flexGrow: 0, flexShrink: 0, backgroundColor: '#050b14', paddingVertical: 8, borderRightWidth: 1, borderRightColor: '#203b55' },
  navCompact: { width: '100%', maxWidth: '100%', minWidth: 0, maxHeight: 74, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#203b55' },
  navHorizontal: { alignItems: 'center', paddingHorizontal: 8 },
  navItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, marginVertical: 1, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  navActive: { backgroundColor: '#10203a', borderColor: '#1e4d7a' },
  navText: { color: '#cbd5e1', fontWeight: '600', fontSize: 13 },
  content: { flex: 1 }, contentInner: { padding: 18, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  pageHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { color: '#eef7ff', fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 16, padding: 18, marginBottom: 12 },
  sectionCompact: { borderRadius: 14, padding: 14, marginBottom: 10 },
  sectionTitle: { color: '#eef7ff', fontSize: 17, fontWeight: '800', marginBottom: 6, letterSpacing: -0.2 },
  sectionBody: { marginTop: 10 },
  sectionBodyCompact: { marginTop: 7 },
  creatorWrap: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  creatorHero: { paddingHorizontal: 2, paddingVertical: 4, marginBottom: 10 },
  creatorTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 4 },
  creatorGrid: { width: '100%' },
  row: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 9 },
  rowTitle: { color: '#eef7ff', fontWeight: '700', marginBottom: 5 },
  json: { color: '#9fb0c5', fontSize: 11, lineHeight: 17 },
  muted: { color: '#9fb0c5', fontSize: 13, lineHeight: 19 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  fieldWrap: { minWidth: 180, flexGrow: 1, flexBasis: 220 },
  label: { color: '#9fb0c5', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11 },
  buttonWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11, marginTop: 4 },
  secondary: { backgroundColor: '#111a29', borderWidth: 1, borderColor: '#2a3b52' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonHint: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 360 },
  helper: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 6 },
  disabled: { opacity: 0.42 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  chip: { borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#090f1a' },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#d5deea', fontSize: 12 },
  invite: { backgroundColor: '#08271c', borderWidth: 1, borderColor: '#145c3c', borderRadius: 13, padding: 14, marginTop: 13 },
  warning: { margin: 12, padding: 14, borderRadius: 13, backgroundColor: '#241b08', borderWidth: 1, borderColor: '#76591b' },
  warningTitle: { color: '#fbbf24', fontWeight: '800' },
  error: { color: '#fecaca', backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#5b2028', padding: 11, borderRadius: 10, marginBottom: 11 },
  success: { color: '#4ade80', fontWeight: '700' },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 9 },
});
