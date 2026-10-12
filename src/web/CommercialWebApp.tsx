import { RecordList } from './RecordList';
import { IronBrand } from '../components/IronBrand';
import { IronInput as TextInput } from '../components/IronInput';
import { DashboardOverview } from './DashboardOverview';
import { ScheduleWorkspace } from './ScheduleWorkspace';
import { AccessCenterWorkspace } from './AccessCenterWorkspace';
import { FinancialWorkspace } from './FinancialWorkspace';
import { EntitlementsWorkspace } from './EntitlementsWorkspace';
import { CreatorNetworkWorkspace } from './CreatorNetworkWorkspace';
import { PrivacyCenter } from './PrivacyCenter';
import { CommunicationCenter } from './CommunicationCenter';
import { FiscalCenter } from './FiscalCenter';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AccountSecurityPanel } from '../components/AccountSecurityPanel';
import { SaasBillingPanel } from '../components/SaasBillingPanel';
import { IntegrationCredentialsPanel } from '../components/IntegrationCredentialsPanel';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_POLICY_TEXT, strongPassword } from '../security/password-policy';
import { api } from '../services/api';

type ModuleKey = 'overview' | 'onboarding' | 'students' | 'team' | 'equipment' | 'exercises' | 'assessments' | 'workouts' | 'schedule' | 'access' | 'communication' | 'financial' | 'fiscal' | 'saasBilling' | 'security' | 'privacy' | 'entitlements' | 'integrations' | 'creator';
type Entitlement = { featureKey: string; kind: 'FEATURE' | 'LIMIT' | 'POLICY'; value: boolean | number | string[] | null; source?: string; reason?: string | null };
type ModuleDefinition = { key: ModuleKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; roles?: string[]; entitlement?: string[] };
const restrictedAdminModules: ModuleKey[] = ['financial', 'fiscal', 'saasBilling', 'entitlements', 'integrations'];

const operational = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION'];
const staff = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION', 'TRAINER'];
const modules: ModuleDefinition[] = [
  { key: 'overview', label: 'Visão geral', icon: 'grid-outline', roles: operational },
  { key: 'onboarding', label: 'Configuração inicial', icon: 'rocket-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'students', label: 'Alunos', icon: 'people-outline', roles: staff },
  { key: 'team', label: 'Equipe', icon: 'shield-checkmark-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] },
  { key: 'equipment', label: 'Equipamentos', icon: 'barbell-outline', roles: staff, entitlement: ['equipment.catalog', 'equipment.inventory'] },
  { key: 'exercises', label: 'Exercícios', icon: 'fitness-outline', roles: staff },
  { key: 'assessments', label: 'Avaliações', icon: 'pulse-outline', roles: staff },
  { key: 'workouts', label: 'Treinos', icon: 'clipboard-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'] },
  { key: 'schedule', label: 'Agenda', icon: 'calendar-outline', roles: staff },
  { key: 'access', label: 'Acessos', icon: 'key-outline', roles: operational },
  { key: 'communication', label: 'Comunicação', icon: 'chatbubbles-outline', roles: operational },
  { key: 'creator', label: 'Creator Network', icon: 'images-outline', roles: ['OWNER', 'MANAGER'], entitlement: ['content.external_youtube', 'content.iron_managed', 'content.tenant_private'] },
  { key: 'security', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { key: 'privacy', label: 'Privacidade', icon: 'document-lock-outline' },
  { key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'fiscal', label: 'Fiscal / NFS-e', icon: 'document-text-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'saasBilling', label: 'Assinatura IRON', icon: 'card-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'entitlements', label: 'Plano e configurações', icon: 'layers-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'integrations', label: 'Integrações', icon: 'git-network-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
];
const onboardingLabels: Record<string, string> = { ACADEMY_PROFILE: 'Perfil da academia', EQUIPMENT_INVENTORY: 'Inventário de equipamentos', TEAM_REVIEW: 'Revisão da equipe', FINISH: 'Finalizar configuração' };
const baseTeamRoleOptions = [
  { id: 'TRAINER', name: 'Professor' },
  { id: 'RECEPTION', name: 'Recepção' },
];
const ownerTeamRoleOptions = [
  ...baseTeamRoleOptions,
  { id: 'MANAGER', name: 'Gerente' },
];
const equipmentCategoryOptions = [
  { id: '', name: 'Todas as categorias' },
  { id: 'CARDIO', name: 'Cardio' },
  { id: 'SELECTORIZED_STRENGTH', name: 'Musculação guiada' },
  { id: 'PLATE_LOADED', name: 'Carga com anilhas' },
  { id: 'CABLE_FUNCTIONAL', name: 'Cabos e funcional' },
  { id: 'RACKS_BENCHES', name: 'Racks e bancos' },
  { id: 'FREE_WEIGHTS', name: 'Pesos livres' },
  { id: 'FUNCTIONAL_CONDITIONING', name: 'Condicionamento funcional' },
  { id: 'PILATES_REHAB', name: 'Pilates e reabilitação' },
  { id: 'SPECIALIZED_STRENGTH', name: 'Força especializada' },
];
const equipmentCategoryLabel = (value: string) => equipmentCategoryOptions.find((item) => item.id === value)?.name ?? value;
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
  return <View style={styles.chips}>{rows.map((row) => <TouchableOpacity key={row.id} accessibilityRole="button" accessibilityState={{ selected: selected === row.id }} style={[styles.chip, selected === row.id && styles.chipActive]} onPress={() => onSelect(row.id)}><Text style={styles.chipText}>{row.name ?? row.user?.name ?? row.id}</Text></TouchableOpacity>)}</View>;
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
  const [studentSearch, setStudentSearch] = useState('');
  const [student, setStudent] = useState({ name: '', email: '', phone: '' });
  const [lastStudentInvite, setLastStudentInvite] = useState<any>(null);
  const [member, setMember] = useState({ name: '', email: '', password: '', phone: '', roleName: 'TRAINER' });
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState('');
  const [selectedEquipmentExercise, setSelectedEquipmentExercise] = useState('');
  const [equipmentCandidate, setEquipmentCandidate] = useState({ proposedName: '', proposedCategory: '', manufacturerName: '', modelName: '', evidenceUrl: '', notes: '' });
  const [equipmentReviewNotes, setEquipmentReviewNotes] = useState('');
  const [exercise, setExercise] = useState({ name: '', muscleGroup: '', movement: '', level: '', videoUrl: '', contraindications: '' });
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseMuscleGroup, setExerciseMuscleGroup] = useState('');
  const [exerciseLevel, setExerciseLevel] = useState('');
  const [selectedExerciseLibrary, setSelectedExerciseLibrary] = useState('');
  const [assessment, setAssessment] = useState({ weight: '', height: '', bodyFatPercent: '', chest: '', waist: '', hip: '', restrictions: '', notes: '' });
  const [academy, setAcademy] = useState({ name: '', timezone: 'America/Sao_Paulo' });
  const [aiInstructions, setAiInstructions] = useState('');
  const [workoutDraft, setWorkoutDraft] = useState({ goal: '', level: '', weeklyFrequency: '', notes: '' });
  const [workoutAssessmentId, setWorkoutAssessmentId] = useState('');
  const [workoutSessions, setWorkoutSessions] = useState<any[]>([]);
  const [workoutSessionDraft, setWorkoutSessionDraft] = useState({ name: 'Treino A', sessionType: '', estimatedMinutes: '60' });
  const [workoutSessionExercises, setWorkoutSessionExercises] = useState<any[]>([]);
  const [selectedWorkoutExercise, setSelectedWorkoutExercise] = useState('');
  const [selectedWorkoutEquipment, setSelectedWorkoutEquipment] = useState('');
  const [workoutExerciseDraft, setWorkoutExerciseDraft] = useState({ sets: '3', reps: '10', restSeconds: '60', suggestedLoad: '', notes: '' });
  const [adminStepUpActive, setAdminStepUpActive] = useState(false);
  const [adminStepUpExpiresAt, setAdminStepUpExpiresAt] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminSecondFactor, setAdminSecondFactor] = useState('');
  const [adminGateLoading, setAdminGateLoading] = useState(false);
  const [adminGateError, setAdminGateError] = useState('');

  const entitlementMap = useMemo(() => new Map(entitlements.map((item) => [item.featureKey, item])), [entitlements]);
  const enabled = useCallback((key: string) => entitlementMap.get(key)?.value === true, [entitlementMap]);
  const allowed = useCallback((item: ModuleDefinition) => (!item.roles || item.roles.some((role) => roles.includes(role))) && (!item.entitlement || item.entitlement.some(enabled)), [enabled, roles]);
  const can = useCallback((...targets: string[]) => targets.some((role) => roles.includes(role)), [roles]);
  const isRestrictedAdminModule = useCallback((key: ModuleKey) => restrictedAdminModules.includes(key), []);
  const blocked = shellReady && (!subscription || trial?.status === 'EXPIRED' || trial?.status === 'INACTIVE' || subscription?.status === 'SUSPENDED');
  const visible = useMemo(() => modules.filter((item) => allowed(item) && (!blocked || item.key === 'saasBilling' || item.key === 'security' || item.key === 'privacy')), [allowed, blocked]);

  const loadShell = useCallback(async () => {
    setShellReady(false);
    setError('');
    const [features, current, trialState, onboardingState, stepUpState] = await Promise.all([
      api('/product-entitlements/tenant/features'),
      api('/product-entitlements/tenant/current'),
      api('/commercial/trial/status'),
      can('OWNER', 'MANAGER') ? api('/commercial/onboarding') : Promise.resolve(null),
      can('SUPER_ADMIN', 'OWNER') ? api('/auth/step-up/status') : Promise.resolve({ active: false, expiresAt: null }),
    ]);
    setEntitlements(Array.isArray(features) ? features : []);
    setSubscription(current);
    setTrial(trialState);
    setOnboarding(onboardingState);
    setAdminStepUpActive(stepUpState?.active === true);
    setAdminStepUpExpiresAt(stepUpState?.expiresAt ? String(stepUpState.expiresAt) : null);
    setShellReady(true);
  }, [can]);

  const loadModule = useCallback(async (key: ModuleKey) => {
    setLoading(true); setError('');
    try {
      const next: Record<string, any> = {};
      if (key === 'overview') {
        const canSeeFinancialDashboard = can('SUPER_ADMIN', 'OWNER') && adminStepUpActive;
        const canSeeWorkoutOperations = can('SUPER_ADMIN', 'OWNER', 'MANAGER');
        const [summary, revenue, attendance, overdue, birthdays, agendaSlots, cockpitWorkouts, gym] = await Promise.all([
          api('/dashboard/summary'),
          canSeeFinancialDashboard ? api('/dashboard/revenue?days=30') : Promise.resolve(null),
          api('/dashboard/attendance?days=7'),
          canSeeFinancialDashboard ? api('/dashboard/overdue') : Promise.resolve(null),
          api('/dashboard/birthdays?days=30'),
          api('/schedule-slots'),
          canSeeWorkoutOperations ? api('/workouts') : Promise.resolve([]),
          activeTenantId && can('OWNER', 'MANAGER') ? api(`/gyms/${activeTenantId}`).catch(() => null) : Promise.resolve(null),
        ]); Object.assign(next, { summary, revenue, attendance, overdue, birthdays, agendaSlots, cockpitWorkouts, gym });
      }
      if (key === 'students') {
        next.students = await api('/students');
        if (selectedStudent) {
          const canSeeWorkoutHistory = can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER');
          const canSeeAccessHistory = can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION');
          const canSeeStudentFinance = can('SUPER_ADMIN', 'OWNER') && adminStepUpActive;
          const [studentDetail, assessments, schedules, workouts, accessEvents, subscriptions, charges] = await Promise.all([
            api(`/students/${selectedStudent}`),
            api(`/students/${selectedStudent}/assessments`),
            api(`/students/${selectedStudent}/schedules`),
            canSeeWorkoutHistory ? api(`/students/${selectedStudent}/workouts`) : Promise.resolve([]),
            canSeeAccessHistory ? api(`/access/events?studentId=${encodeURIComponent(selectedStudent)}`) : Promise.resolve([]),
            canSeeStudentFinance ? api(`/financial/subscriptions?studentId=${encodeURIComponent(selectedStudent)}`) : Promise.resolve([]),
            canSeeStudentFinance ? api(`/financial/charges?studentId=${encodeURIComponent(selectedStudent)}`) : Promise.resolve([]),
          ]);
          Object.assign(next, { studentDetail, assessments, schedules, workouts, accessEvents, subscriptions, charges });
        }
      }
      if (key === 'team') next.users = await api('/users');
      if (key === 'equipment') {
        const params = new URLSearchParams();
        if (equipmentSearch.trim()) params.set('search', equipmentSearch.trim());
        if (equipmentCategory) params.set('category', equipmentCategory);
        const catalogPath = `/equipments/catalog${params.toString() ? `?${params.toString()}` : ''}`;
        const [inventory, catalog, candidates, exercises, governanceCandidates] = await Promise.all([
          api('/equipments'),
          enabled('equipment.catalog') ? api(catalogPath) : Promise.resolve([]),
          can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? api('/equipments/catalog/candidates') : Promise.resolve([]),
          api('/exercises'),
          can('SUPER_ADMIN') ? api('/equipments/catalog/governance/candidates?status=PENDING') : Promise.resolve([]),
        ]);
        Object.assign(next, { inventory, catalog, candidates, equipmentExercises: exercises, governanceCandidates });
      }
      if (key === 'exercises') {
        [next.exercises, next.exerciseInventory] = await Promise.all([api('/exercises'), api('/equipments')]);
      }
      if (key === 'assessments') {
        next.students = await api('/students');
        if (selectedStudent) {
          [next.assessments, next.assessmentWorkouts] = await Promise.all([
            api(`/students/${selectedStudent}/assessments`),
            can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? api(`/students/${selectedStudent}/workouts`) : Promise.resolve([]),
          ]);
        }
      }
      if (key === 'workouts') {
        const [workouts, students, exercises, inventory, assessments] = await Promise.all([
          api('/workouts'),
          api('/students'),
          api('/exercises'),
          api('/equipments'),
          selectedStudent ? api(`/students/${selectedStudent}/assessments`) : Promise.resolve([]),
        ]);
        Object.assign(next, { workouts, students, workoutExercises: exercises, workoutInventory: inventory, workoutAssessments: assessments });
      }
      if (key === 'schedule') { [next.slots, next.students, next.bookings] = await Promise.all([api('/schedule-slots'), api('/students'), api('/schedules')]); }
      if (key === 'access') {
        const [events, students, credentials, devices] = await Promise.all([
          api('/access/events'),
          api('/students'),
          api('/access/credentials'),
          can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? api('/access/devices') : Promise.resolve([]),
        ]);
        Object.assign(next, { events, students, credentials, devices });
      }
      if (key === 'financial') {
        const [accounts, charges, students, subscriptions, transactions, overdueCharges] = await Promise.all([
          api('/financial/accounts'),
          api('/financial/charges'),
          api('/students'),
          api('/financial/subscriptions'),
          api('/financial/transactions'),
          api('/financial/charges?overdue=true'),
        ]);
        Object.assign(next, { accounts, charges, students, subscriptions, transactions, overdueCharges });
      }
      if (key === 'entitlements') { [next.features, next.configurations] = await Promise.all([api('/product-entitlements/tenant/features'), api('/product-entitlements/tenant/configurations')]); next.subscription = subscription; }
      if (key === 'creator') { [next.items, next.overview, next.analytics] = await Promise.all([api('/creator-network/content/tenant/items'), api('/creator-network/operations/tenant/overview'), api('/creator-network/operations/tenant/analytics?days=30')]); }
      setData((current) => key === 'workouts'
        ? { ...next, workoutCompatibleEquipment: current.workoutCompatibleEquipment ?? [] }
        : next);
    } catch (reason) { setError(message(reason)); setData({}); } finally { setLoading(false); }
  }, [activeTenantId, adminStepUpActive, can, enabled, equipmentCategory, equipmentSearch, selectedStudent, subscription]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShell().catch((reason) => { setError(message(reason)); setLoading(false); });
    }, 0);
    return () => clearTimeout(timer);
  }, [loadShell]);
  useEffect(() => {
    if (!shellReady || blocked) return undefined;
    if (isRestrictedAdminModule(active) && !adminStepUpActive) {
      const timer = setTimeout(() => {
        setLoading(false);
        setData({});
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      void loadModule(active);
    }, 0);
    return () => clearTimeout(timer);
  }, [active, adminStepUpActive, blocked, isRestrictedAdminModule, loadModule, shellReady]);

  useEffect(() => {
    if (!adminStepUpActive || !adminStepUpExpiresAt) return undefined;
    const remaining = new Date(adminStepUpExpiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      const timer = setTimeout(() => setAdminStepUpActive(false), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setAdminStepUpActive(false), remaining);
    return () => clearTimeout(timer);
  }, [adminStepUpActive, adminStepUpExpiresAt]);
  async function unlockAdministrativeArea() {
    if (!adminPassword.trim()) {
      setAdminGateError('Informe sua senha atual.');
      return;
    }
    setAdminGateLoading(true);
    setAdminGateError('');
    try {
      const factor = adminSecondFactor.trim();
      const state = await api('/auth/step-up', undefined, {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: adminPassword,
          ...(factor
            ? /^\d{6}$/.test(factor)
              ? { mfaCode: factor }
              : { recoveryCode: factor.toUpperCase() }
            : {}),
        }),
      });
      setAdminStepUpActive(state?.active === true);
      setAdminStepUpExpiresAt(state?.expiresAt ? String(state.expiresAt) : null);
      setAdminPassword('');
      setAdminSecondFactor('');
      if (state?.active === true) await loadModule(active);
    } catch (reason) {
      setAdminStepUpActive(false);
      setAdminGateError(message(reason));
    } finally {
      setAdminGateLoading(false);
    }
  }

  function adminGateView() {
    return <Section compact title="Acesso administrativo protegido" subtitle="Confirme sua identidade para entrar nesta área restrita. A autorização é temporária e vinculada à sua sessão atual."><View style={styles.adminGateIdentity}><Ionicons name="lock-closed-outline" size={24} color="#60a5fa" /><View><Text style={styles.rowTitle}>{profile?.name ?? 'Proprietário'}</Text><Text style={styles.muted}>{profile?.email ?? 'Conta administrativa'}</Text></View></View><View style={styles.adminGateForm}><Field label="Senha atual" value={adminPassword} secureTextEntry onChangeText={setAdminPassword} />{profile?.mfaEnabled ? <Field label="Código MFA ou código de recuperação" value={adminSecondFactor} onChangeText={setAdminSecondFactor} /> : null}</View>{adminGateError ? <Text style={styles.error}>{adminGateError}</Text> : null}<Button testID="admin-step-up-submit" label={adminGateLoading ? 'Validando…' : 'Entrar na área administrativa'} disabled={adminGateLoading || !adminPassword.trim()} onPress={() => { void unlockAdministrativeArea(); }} /><Text style={styles.helper}>Por segurança, o acesso administrativo expira automaticamente após 15 minutos.</Text></Section>;
  }

  async function mutate(operation: () => Promise<unknown>, reset?: () => void) {
    setSaving(true); setError('');
    try { await operation(); reset?.(); await loadShell(); await loadModule(active); } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  }
  function overview() {
    return <DashboardOverview data={data} showFinancial={can('SUPER_ADMIN', 'OWNER') && adminStepUpActive} canNavigate={(key) => visible.some(item => item.key === key)} navigate={(key) => { if (visible.some(item => item.key === key)) setActive(key); }} />;
  }
  function onboardingView() {
    const step = onboarding?.nextStep as string | undefined;
    return <Section title="Primeiros passos" subtitle="Complete as etapas para preparar a operação da sua academia."><Data value={onboarding ? [onboarding] : []} />{step === 'ACADEMY_PROFILE' ? <View style={styles.form}><Field label="Nome da academia" value={academy.name} onChangeText={(name) => setAcademy((v) => ({ ...v, name }))} /><Field label="Fuso horário" value={academy.timezone} onChangeText={(timezone) => setAcademy((v) => ({ ...v, timezone }))} /></View> : null}{step ? <Button testID="onboarding-complete-step" label={saving ? 'Salvando…' : `Concluir: ${onboardingLabels[step] ?? step}`} disabled={saving || (step === 'ACADEMY_PROFILE' && !academy.name.trim())} onPress={() => void mutate(() => api('/commercial/onboarding', undefined, { method: 'PATCH', body: JSON.stringify({ step, ...(step === 'ACADEMY_PROFILE' ? { data: { name: academy.name.trim(), timezone: academy.timezone.trim() } } : {}) }) }))} /> : <Text style={styles.success}>Configuração inicial concluída.</Text>}</Section>;
  }
  function studentsView() {
    const students = list(data.students);
    const normalizedSearch = studentSearch.trim().toLocaleLowerCase('pt-BR');
    const filteredStudents = normalizedSearch
      ? students.filter((row: any) => [row.name, row.email, row.phone, row.status].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)))
      : students;
    const detail = data.studentDetail;
    const schedules = list(data.schedules).map((row: any) => ({
      id: row.id,
      status: row.status,
      date: row.date,
      weekday: row.slot?.weekday,
      startTime: row.slot?.startTime,
      endTime: row.slot?.endTime,
      checkedInAt: row.checkedInAt,
    }));
    const canSeeStudentFinance = can('SUPER_ADMIN', 'OWNER') && adminStepUpActive;
    const canManageConsents = can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION');

    return <>
      {can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section compact title="Cadastrar aluno"><View style={styles.form}><Field label="Nome" value={student.name} onChangeText={(name) => setStudent((v) => ({ ...v, name }))} /><Field label="E-mail" value={student.email} onChangeText={(email) => setStudent((v) => ({ ...v, email }))} /><Field label="Telefone" value={student.phone} onChangeText={(phone) => setStudent((v) => ({ ...v, phone }))} /></View><Button testID="student-create" label="Cadastrar aluno" disabled={saving || !student.name.trim() || !student.email.trim()} onPress={() => void mutate(async () => { const created = await api('/students', undefined, { method: 'POST', body: JSON.stringify({ name: student.name.trim(), email: student.email.trim().toLowerCase(), ...(student.phone.trim() ? { phone: student.phone.trim() } : {}) }) }); setLastStudentInvite(created?.onboarding?.required ? created.onboarding : null); return created; }, () => setStudent({ name: '', email: '', phone: '' }))} />{lastStudentInvite ? <View style={styles.invite}><Text style={styles.rowTitle}>Convite de ativação — exibir uma vez</Text><Text selectable style={styles.json}>{lastStudentInvite.token}</Text><Text style={styles.muted}>Expira em: {String(lastStudentInvite.expiresAt ?? '—')}</Text></View> : null}</Section> : null}
      <Section compact title="Alunos" subtitle="Pesquise e selecione um aluno para abrir o workspace 360°.">
        <Field label="Buscar por nome, e-mail, telefone ou situação" value={studentSearch} onChangeText={setStudentSearch} />
        <Chips rows={filteredStudents} selected={selectedStudent} onSelect={setSelectedStudent} />
        {!filteredStudents.length ? <Text style={styles.muted}>Nenhum aluno encontrado.</Text> : null}
      </Section>
      {selectedStudent && detail ? <View testID="student-360-workspace">
        <View style={styles.compactGrid}>
          <View style={styles.compactPane}><Section compact title="Perfil"><Data value={[detail]} /></Section></View>
          <View style={styles.compactPane}><Section compact title="Consentimentos" subtitle="Autoridade final validada pelo servidor.">
            <Text style={styles.muted}>Saúde: {detail.consentHealth ? 'Autorizado' : 'Não autorizado'}</Text>
            <Text style={styles.muted}>Comunicação: {detail.consentComm ? 'Autorizado' : 'Não autorizado'}</Text>
            <Text style={styles.muted}>Biometria: {detail.consentBiometry ? 'Autorizado' : 'Não autorizado'}</Text>
            {canManageConsents ? <View style={styles.actions}>
              <Button secondary label={detail.consentHealth ? 'Revogar saúde' : 'Autorizar saúde'} disabled={saving} onPress={() => void mutate(() => api(`/students/${selectedStudent}/consents`, undefined, { method: 'PATCH', body: JSON.stringify({ consentHealth: !detail.consentHealth }) }))} />
              <Button secondary label={detail.consentComm ? 'Revogar comunicação' : 'Autorizar comunicação'} disabled={saving} onPress={() => void mutate(() => api(`/students/${selectedStudent}/consents`, undefined, { method: 'PATCH', body: JSON.stringify({ consentComm: !detail.consentComm }) }))} />
              <Button secondary label={detail.consentBiometry ? 'Revogar biometria' : 'Autorizar biometria'} disabled={saving} onPress={() => void mutate(() => api(`/students/${selectedStudent}/consents`, undefined, { method: 'PATCH', body: JSON.stringify({ consentBiometry: !detail.consentBiometry }) }))} />
            </View> : null}
          </Section></View>
        </View>
        <View style={styles.compactGrid}>
          <View style={styles.compactPane}><Section compact title="Avaliações"><Data value={data.assessments} empty="Nenhuma avaliação registrada." /></Section></View>
          {can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? <View style={styles.compactPane}><Section compact title="Treinos"><Data value={data.workouts} empty="Nenhum treino registrado." /></Section></View> : null}
          <View style={styles.compactPane}><Section compact title="Agenda"><Data value={schedules} empty="Nenhum agendamento registrado." /></Section></View>
        </View>
        <View style={styles.compactGrid}>
          {can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <View style={styles.compactPane}><Section compact title="Acessos"><Data value={data.accessEvents} empty="Nenhum evento de acesso registrado." /></Section></View> : null}
          {can('SUPER_ADMIN', 'OWNER') ? <View style={styles.compactPaneWide}><Section compact title="Plano e financeiro" subtitle={canSeeStudentFinance ? 'Dados financeiros liberados pela reautenticação administrativa.' : 'Dados protegidos. Reautentique na área Financeiro para consultar.'}>{canSeeStudentFinance ? <><Data value={data.subscriptions} empty="Nenhum plano financeiro." /><Data value={data.charges} empty="Nenhuma cobrança." /></> : <Button secondary label="Abrir Financeiro protegido" onPress={() => setActive('financial')} />}</Section></View> : null}
        </View>
      </View> : null}
    </>;
  }
  function teamView() {
    const teamRoleOptions = can('SUPER_ADMIN', 'OWNER') ? ownerTeamRoleOptions : baseTeamRoleOptions;
    const members = list(data.users);
    const teamLoaded = Array.isArray(data.users);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email.trim());
    const roleOk = teamRoleOptions.some((option) => option.id === member.roleName);
    const inviteIssue = !member.name.trim()
      ? 'Informe o nome do membro da equipe.'
      : !emailOk
        ? 'Informe um e-mail válido.'
        : !roleOk
          ? 'Selecione uma função permitida.'
          : '';
    const passwordIssue = member.password && !strongPassword(member.password) ? PASSWORD_POLICY_TEXT : '';
    const roleLabel = (value: string) => ownerTeamRoleOptions.find((option) => option.id === value)?.name ?? value;
    const permissionLabel = (value: string) => value
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const resetMember = () => setMember({ name: '', email: '', password: '', phone: '', roleName: 'TRAINER' });

    return <>
      <Section compact title="Adicionar membro à equipe" subtitle="Envie um convite para o membro definir a própria senha ou, se necessário, cadastre uma senha inicial forte.">
        <View style={styles.form}>
          <Field label="Nome" value={member.name} onChangeText={(name) => setMember((v) => ({ ...v, name }))} />
          <Field label="E-mail" value={member.email} onChangeText={(email) => setMember((v) => ({ ...v, email }))} />
          <Field label="Telefone (opcional)" value={member.phone} onChangeText={(phone) => setMember((v) => ({ ...v, phone }))} />
          <Field label="Senha inicial (opcional)" value={member.password} secureTextEntry onChangeText={(password) => setMember((v) => ({ ...v, password }))} />
        </View>
        <Text style={styles.label}>Função</Text>
        <Chips rows={teamRoleOptions} selected={member.roleName} onSelect={(roleName) => setMember((v) => ({ ...v, roleName }))} />
        <Text style={styles.helper}>O convite usa o fluxo seguro de definição de senha do IRON. Para cadastro direto, a senha inicial deve respeitar: {PASSWORD_POLICY_TEXT}</Text>
        {inviteIssue ? <Text style={styles.helper}>Antes de continuar: {inviteIssue}</Text> : null}
        {passwordIssue ? <Text style={styles.helper}>Senha inicial: {passwordIssue}</Text> : null}
        <View style={styles.actions}>
          <Button
            testID={teamLoaded ? "team-invite" : undefined}
            label={saving ? 'Enviando…' : 'Enviar convite'}
            disabled={saving || !teamLoaded}
            onPress={() => {
              if (inviteIssue) { setError(inviteIssue); return; }
              void mutate(
                () => api('/users/invite', undefined, {
                  method: 'POST',
                  body: JSON.stringify({
                    name: member.name.trim(),
                    email: member.email.trim().toLowerCase(),
                    ...(member.phone.trim() ? { phone: member.phone.trim() } : {}),
                    roleName: member.roleName,
                  }),
                }),
                resetMember,
              );
            }}
          />
          <Button
            testID={teamLoaded ? "team-add" : undefined}
            secondary
            label={saving ? 'Adicionando…' : 'Cadastrar com senha inicial'}
            disabled={saving || !teamLoaded}
            onPress={() => {
              const directIssue = inviteIssue || (!member.password ? 'Informe a senha inicial ou use Enviar convite.' : passwordIssue);
              if (directIssue) { setError(directIssue); return; }
              void mutate(
                () => api('/users', undefined, {
                  method: 'POST',
                  body: JSON.stringify({
                    name: member.name.trim(),
                    email: member.email.trim().toLowerCase(),
                    password: member.password,
                    ...(member.phone.trim() ? { phone: member.phone.trim() } : {}),
                    roleName: member.roleName,
                  }),
                }),
                resetMember,
              );
            }}
          />
        </View>
      </Section>
      <Section compact title="Equipe" subtitle="Funções, situação de acesso e permissões efetivas vêm do servidor.">
        {members.length ? members.map((row: any) => {
          const permissions = Array.isArray(row.permissions) ? row.permissions : [];
          const activeMembership = row.membershipActive !== false;
          return <View key={row.id} style={styles.row}>
            <View style={styles.teamRowHead}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{row.name ?? row.email ?? 'Membro da equipe'}</Text>
                <Text style={styles.muted}>{row.email ?? '—'}{row.phone ? ` · ${row.phone}` : ''}</Text>
              </View>
              <Text style={[styles.teamStatus, activeMembership ? styles.teamStatusActive : styles.teamStatusInactive]}>{activeMembership ? 'Acesso ativo' : 'Acesso suspenso'}</Text>
            </View>
            <Text style={styles.muted}>Função: {roleLabel(String(row.roleName ?? '—'))}</Text>
            <Text style={styles.muted}>Permissões efetivas: {permissions.length ? permissions.map(permissionLabel).join(' · ') : 'Nenhuma permissão adicional'}</Text>
            {row.canManage ? <View style={styles.actions}>
              <Button
                testID={`team-status-${row.id}`}
                secondary
                label={activeMembership ? 'Suspender acesso' : 'Reativar acesso'}
                disabled={saving}
                onPress={() => void mutate(() => api(`/users/${row.id}/membership/status`, undefined, {
                  method: 'PATCH',
                  body: JSON.stringify({ active: !activeMembership }),
                }))}
              />
              {teamRoleOptions.filter((option) => option.id !== row.roleName).map((option) => <Button
                key={option.id}
                secondary
                label={`Alterar para ${option.name}`}
                disabled={saving}
                onPress={() => void mutate(() => api(`/users/${row.id}/membership/role`, undefined, {
                  method: 'PATCH',
                  body: JSON.stringify({ roleName: option.id }),
                }))}
              />)}
            </View> : <Text style={styles.helper}>Este vínculo está fora da sua autoridade de alteração.</Text>}
          </View>;
        }) : <Text style={styles.muted}>Nenhum membro de equipe encontrado para este perfil.</Text>}
      </Section>
      <Section compact title="Permissões da sua sessão" subtitle="Informativas. A autorização final de cada ação continua sendo validada pelo servidor."><Data value={permissions.map((name) => ({ name: permissionLabel(name) }))} /></Section>
    </>;
  }
  function equipmentView() {
    const catalog = list(data.catalog);
    const inventory = list(data.inventory);
    const candidates = list(data.candidates);
    const exercises = list(data.equipmentExercises);
    const compatibility = list(data.compatibility);
    const governanceCandidates = list(data.governanceCandidates);
    const canManageInventory = can('SUPER_ADMIN', 'OWNER', 'MANAGER');
    const canSubmitCandidate = can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER');

    return <>
      <View style={styles.compactGrid}>
        <View style={styles.compactPaneWide}>
          <Section compact title="Catálogo mestre" subtitle="Pesquise no catálogo canônico antes de solicitar um novo equipamento.">
            <View style={styles.form}>
              <Field label="Buscar equipamento" value={equipmentSearch} onChangeText={setEquipmentSearch} />
            </View>
            <Text style={styles.label}>Categoria</Text>
            <Chips rows={equipmentCategoryOptions} selected={equipmentCategory} onSelect={setEquipmentCategory} />
            <Button secondary label="Aplicar filtros" disabled={loading} onPress={() => { void loadModule('equipment'); }} />
            <View style={styles.equipmentCatalogGrid}>
              {catalog.length ? catalog.map((item: any) => <View key={item.id} style={styles.equipmentCard}>
                <View style={styles.teamRowHead}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{item.name ?? item.slug ?? 'Equipamento'}</Text>
                    <Text style={styles.muted}>{equipmentCategoryLabel(String(item.category ?? ''))}{item.primaryMuscle ? ` · ${item.primaryMuscle}` : ''}</Text>
                  </View>
                  <Text style={[styles.teamStatus, item.selected ? styles.teamStatusActive : styles.teamStatusInactive]}>{item.selected ? 'No inventário' : 'Disponível'}</Text>
                </View>
                {canManageInventory ? <Button
                  testID={`equipment-catalog-select-${item.id}`}
                  secondary={item.selected}
                  label={item.selected ? 'Remover do inventário' : 'Adicionar ao inventário'}
                  disabled={saving}
                  onPress={() => void mutate(() => item.selected
                    ? api(`/equipments/catalog/${item.id}/selection`, undefined, { method: 'DELETE' })
                    : api('/equipments/catalog/selection', undefined, { method: 'POST', body: JSON.stringify({ catalogItemIds: [item.id] }) }))}
                /> : null}
              </View>) : <Text style={styles.muted}>Nenhum item encontrado com os filtros atuais.</Text>}
            </View>
          </Section>
        </View>
        <View style={styles.compactPane}>
          <Section compact title="Inventário inteligente" subtitle="Equipamentos ativos selecionados pela academia.">
            {inventory.length ? inventory.map((item: any) => <View key={item.id} style={styles.row}>
              <Text style={styles.rowTitle}>{item.catalogItem?.name ?? item.name ?? 'Equipamento'}</Text>
              <Text style={styles.muted}>{equipmentCategoryLabel(String(item.catalogItem?.category ?? item.type ?? ''))}{item.primaryMuscle ? ` · ${item.primaryMuscle}` : ''}</Text>
            </View>) : <Text style={styles.muted}>Nenhum equipamento ativo no inventário.</Text>}
          </Section>
        </View>
      </View>

      <View style={styles.compactGrid}>
        <View style={styles.compactPane}>
          <Section compact title="Compatibilidade por exercício" subtitle="Consulte apenas equipamentos ativos do inventário compatíveis com o exercício selecionado.">
            <Chips rows={exercises} selected={selectedEquipmentExercise} onSelect={setSelectedEquipmentExercise} />
            <Button
              secondary
              label="Consultar compatibilidade"
              disabled={saving || !selectedEquipmentExercise}
              onPress={() => { void (async () => {
                setSaving(true); setError('');
                try {
                  const result = await api(`/equipments/exercises/${selectedEquipmentExercise}/compatible`);
                  setData((current) => ({ ...current, compatibility: result }));
                } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
              })(); }}
            />
            {compatibility.length ? <Data value={compatibility} /> : <Text style={styles.muted}>Selecione um exercício para consultar a compatibilidade.</Text>}
          </Section>
        </View>

        {canSubmitCandidate ? <View style={styles.compactPaneWide}>
          <Section compact title="Não encontrou o equipamento?" subtitle="Envie um candidato para revisão do catálogo mestre. O envio não cria equipamento canônico automaticamente.">
            <View style={styles.form}>
              <Field label="Nome proposto" value={equipmentCandidate.proposedName} onChangeText={(proposedName) => setEquipmentCandidate((v) => ({ ...v, proposedName }))} />
              <Field label="Fabricante (opcional)" value={equipmentCandidate.manufacturerName} onChangeText={(manufacturerName) => setEquipmentCandidate((v) => ({ ...v, manufacturerName }))} />
              <Field label="Modelo (opcional)" value={equipmentCandidate.modelName} onChangeText={(modelName) => setEquipmentCandidate((v) => ({ ...v, modelName }))} />
              <Field label="URL de evidência (opcional)" value={equipmentCandidate.evidenceUrl} onChangeText={(evidenceUrl) => setEquipmentCandidate((v) => ({ ...v, evidenceUrl }))} />
              <Field label="Observações (opcional)" value={equipmentCandidate.notes} onChangeText={(notes) => setEquipmentCandidate((v) => ({ ...v, notes }))} />
            </View>
            <Text style={styles.label}>Categoria proposta</Text>
            <Chips rows={equipmentCategoryOptions.filter((item) => item.id)} selected={equipmentCandidate.proposedCategory} onSelect={(proposedCategory) => setEquipmentCandidate((v) => ({ ...v, proposedCategory }))} />
            <Button
              testID="equipment-candidate-submit"
              label="Enviar para revisão"
              disabled={saving || equipmentCandidate.proposedName.trim().length < 2}
              onPress={() => void mutate(() => api('/equipments/catalog/candidates', undefined, {
                method: 'POST',
                body: JSON.stringify({
                  proposedName: equipmentCandidate.proposedName.trim(),
                  ...(equipmentCandidate.proposedCategory ? { proposedCategory: equipmentCandidate.proposedCategory } : {}),
                  ...(equipmentCandidate.manufacturerName.trim() ? { manufacturerName: equipmentCandidate.manufacturerName.trim() } : {}),
                  ...(equipmentCandidate.modelName.trim() ? { modelName: equipmentCandidate.modelName.trim() } : {}),
                  ...(equipmentCandidate.evidenceUrl.trim() ? { evidenceUrl: equipmentCandidate.evidenceUrl.trim() } : {}),
                  ...(equipmentCandidate.notes.trim() ? { notes: equipmentCandidate.notes.trim() } : {}),
                }),
              }), () => setEquipmentCandidate({ proposedName: '', proposedCategory: '', manufacturerName: '', modelName: '', evidenceUrl: '', notes: '' }))}
            />
            <Text style={styles.label}>Solicitações da academia</Text>
            <Data value={candidates} empty="Nenhum candidato enviado." />
          </Section>
        </View> : null}
      </View>

      {can('SUPER_ADMIN') ? <Section compact title="Governança do catálogo" subtitle="Somente SUPER_ADMIN revisa candidatos e cria identidade canônica.">
        <Field label="Observação da revisão" value={equipmentReviewNotes} onChangeText={setEquipmentReviewNotes} />
        {governanceCandidates.length ? governanceCandidates.map((candidate: any) => <View key={candidate.id} style={styles.row}>
          <Text style={styles.rowTitle}>{candidate.proposedName}</Text>
          <Text style={styles.muted}>Academia: {candidate.gymId} · Categoria: {equipmentCategoryLabel(String(candidate.proposedCategory ?? 'Não definida'))}</Text>
          <View style={styles.actions}>
            <Button
              label="Aprovar no catálogo"
              disabled={saving || !candidate.proposedCategory}
              onPress={() => void mutate(() => api(`/equipments/catalog/governance/candidates/${candidate.id}/review`, undefined, {
                method: 'POST',
                body: JSON.stringify({ decision: 'APPROVE', canonicalCategory: candidate.proposedCategory, ...(equipmentReviewNotes.trim() ? { reviewNotes: equipmentReviewNotes.trim() } : {}) }),
              }))}
            />
            <Button
              secondary
              label="Rejeitar"
              disabled={saving || !equipmentReviewNotes.trim()}
              onPress={() => void mutate(() => api(`/equipments/catalog/governance/candidates/${candidate.id}/review`, undefined, {
                method: 'POST',
                body: JSON.stringify({ decision: 'REJECT', reviewNotes: equipmentReviewNotes.trim() }),
              }))}
            />
          </View>
        </View>) : <Text style={styles.muted}>Nenhum candidato pendente de governança.</Text>}
      </Section> : null}
    </>;
  }
  function exercisesView() {
    const exercises = list(data.exercises);
    const inventory = list(data.exerciseInventory);
    const normalized = exerciseSearch.trim().toLocaleLowerCase('pt-BR');
    const filtered = exercises.filter((item: any) => {
      const matchesSearch = !normalized || [item.name, item.muscleGroup, item.movement, item.level].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(normalized));
      const matchesGroup = !exerciseMuscleGroup || String(item.muscleGroup ?? '') === exerciseMuscleGroup;
      const matchesLevel = !exerciseLevel || String(item.level ?? '') === exerciseLevel;
      return matchesSearch && matchesGroup && matchesLevel;
    });
    const muscleGroups = [...new Set(exercises.map((item: any) => String(item.muscleGroup ?? '')).filter(Boolean))].sort().map((name) => ({ id: name, name }));
    const levels = [...new Set(exercises.map((item: any) => String(item.level ?? '')).filter(Boolean))].sort().map((name) => ({ id: name, name }));
    const compatibility = list(data.exerciseCompatibility);
    const selected = exercises.find((item: any) => item.id === selectedExerciseLibrary);
    const contraindicationsText = (value: unknown) => {
      if (!value) return 'Nenhuma contraindicação informada.';
      if (Array.isArray(value)) return value.join(' · ');
      if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : String(item)}`).join(' · ');
      return String(value);
    };

    return <>
      {can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? <Section compact title="Novo exercício" subtitle="Cadastre conteúdo canônico para uso no Workout Studio.">
        <View style={styles.form}>
          <Field label="Nome" value={exercise.name} onChangeText={(name) => setExercise((v) => ({ ...v, name }))} />
          <Field label="Grupo muscular" value={exercise.muscleGroup} onChangeText={(muscleGroup) => setExercise((v) => ({ ...v, muscleGroup }))} />
          <Field label="Movimento" value={exercise.movement} onChangeText={(movement) => setExercise((v) => ({ ...v, movement }))} />
          <Field label="Nível" value={exercise.level} onChangeText={(level) => setExercise((v) => ({ ...v, level }))} />
          <Field label="Vídeo / conteúdo (URL)" value={exercise.videoUrl} onChangeText={(videoUrl) => setExercise((v) => ({ ...v, videoUrl }))} />
          <Field label="Contraindicações (texto)" value={exercise.contraindications} onChangeText={(contraindications) => setExercise((v) => ({ ...v, contraindications }))} />
        </View>
        <Button
          label="Criar exercício"
          disabled={saving || !exercise.name.trim()}
          onPress={() => void mutate(() => api('/exercises', undefined, {
            method: 'POST',
            body: JSON.stringify({
              name: exercise.name.trim(),
              ...(exercise.muscleGroup.trim() ? { muscleGroup: exercise.muscleGroup.trim() } : {}),
              ...(exercise.movement.trim() ? { movement: exercise.movement.trim() } : {}),
              ...(exercise.level.trim() ? { level: exercise.level.trim() } : {}),
              ...(exercise.videoUrl.trim() ? { videoUrl: exercise.videoUrl.trim() } : {}),
              ...(exercise.contraindications.trim() ? { contraindications: { notes: exercise.contraindications.trim() } } : {}),
            }),
          }), () => setExercise({ name: '', muscleGroup: '', movement: '', level: '', videoUrl: '', contraindications: '' }))}
        />
      </Section> : null}

      <View style={styles.compactGrid}>
        <View style={styles.compactPaneWide}><Section compact title="Biblioteca de exercícios" subtitle="Pesquise e filtre por grupo muscular e nível.">
          <Field label="Buscar exercício" value={exerciseSearch} onChangeText={setExerciseSearch} />
          <Text style={styles.label}>Grupo muscular</Text>
          <Chips rows={[{ id: '', name: 'Todos' }, ...muscleGroups]} selected={exerciseMuscleGroup} onSelect={setExerciseMuscleGroup} />
          <Text style={styles.label}>Nível</Text>
          <Chips rows={[{ id: '', name: 'Todos' }, ...levels]} selected={exerciseLevel} onSelect={setExerciseLevel} />
          <View style={styles.equipmentCatalogGrid}>
            {filtered.length ? filtered.map((item: any) => <TouchableOpacity
              key={item.id}
              accessibilityRole="button"
              style={[styles.equipmentCard, selectedExerciseLibrary === item.id && styles.exerciseCardSelected]}
              onPress={() => setSelectedExerciseLibrary(item.id)}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.muted}>{item.muscleGroup || 'Grupo não informado'}{item.level ? ` · ${item.level}` : ''}</Text>
              {item.movement ? <Text style={styles.muted}>Movimento: {item.movement}</Text> : null}
              <Text style={styles.helper}>{item.videoUrl ? 'Conteúdo em vídeo disponível' : 'Sem conteúdo em vídeo'}</Text>
            </TouchableOpacity>) : <Text style={styles.muted}>Nenhum exercício encontrado.</Text>}
          </View>
        </Section></View>

        <View style={styles.compactPane}><Section compact title="Detalhes e compatibilidade" subtitle="A compatibilidade usa somente o inventário ativo da academia.">
          {selected ? <>
            <Text style={styles.rowTitle}>{selected.name}</Text>
            <Text style={styles.muted}>Grupo: {selected.muscleGroup || '—'} · Nível: {selected.level || '—'}</Text>
            {selected.movement ? <Text style={styles.muted}>Movimento: {selected.movement}</Text> : null}
            <Text style={styles.muted}>Contraindicações: {contraindicationsText(selected.contraindications)}</Text>
            <Text style={styles.muted}>Conteúdo: {selected.videoUrl || 'Nenhum vídeo cadastrado'}</Text>
            <Button
              secondary
              label="Consultar equipamentos compatíveis"
              disabled={saving}
              onPress={() => { void (async () => {
                setSaving(true); setError('');
                try {
                  const result = await api(`/equipments/exercises/${selected.id}/compatible`);
                  setData((current) => ({ ...current, exerciseCompatibility: result }));
                } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
              })(); }}
            />
            {compatibility.length ? <Data value={compatibility} /> : <Text style={styles.helper}>{inventory.length ? 'Consulte a compatibilidade para relacionar este exercício ao inventário ativo.' : 'A academia ainda não possui equipamentos ativos no inventário.'}</Text>}
            <Text style={styles.helper}>A associação do exercício às sessões acontece no Workout Studio; esta tela mantém a biblioteca e a compatibilidade canônicas.</Text>
          </> : <Text style={styles.muted}>Selecione um exercício da biblioteca.</Text>}
        </Section></View>
      </View>
    </>;
  }
  function assessmentsView() {
    const students = list(data.students);
    const assessments = list(data.assessments);
    const workouts = list(data.assessmentWorkouts);
    const number = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
    const latest = assessments[0];
    const previous = assessments[1];
    const delta = (current: unknown, before: unknown, suffix = '') => {
      if (typeof current !== 'number' || typeof before !== 'number') return '—';
      const value = Math.round((current - before) * 10) / 10;
      return `${value > 0 ? '+' : ''}${value}${suffix}`;
    };
    const dateLabel = (value: unknown) => {
      if (!value) return '—';
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
    };
    const measurementSummary = (value: any) => {
      if (!value || typeof value !== 'object') return 'Sem medidas adicionais';
      const labels: Record<string, string> = { chest: 'Peito', waist: 'Cintura', hip: 'Quadril', rightArm: 'Braço D', leftArm: 'Braço E', rightThigh: 'Coxa D', leftThigh: 'Coxa E', rightCalf: 'Panturrilha D', leftCalf: 'Panturrilha E' };
      return Object.entries(value).filter(([, item]) => item != null).map(([key, item]) => `${labels[key] ?? key}: ${String(item)} cm`).join(' · ') || 'Sem medidas adicionais';
    };
    const restrictionsSummary = (value: any) => {
      if (!value || typeof value !== 'object') return 'Nenhuma restrição informada';
      const entries = [
        ...(Array.isArray(value.injuries) ? value.injuries : []),
        ...(Array.isArray(value.conditions) ? value.conditions : []),
        ...(Array.isArray(value.medications) ? value.medications : []),
        ...(value.notes ? [value.notes] : []),
      ];
      return entries.join(' · ') || 'Nenhuma restrição informada';
    };

    return <>
      <Section compact title="Avaliações" subtitle="Histórico corporal e contexto para evolução do treino.">
        <Text style={styles.label}>Aluno</Text>
        <Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} />
        {selectedStudent && can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER') ? <>
          <View style={styles.form}>
            <Field label="Peso (kg)" value={assessment.weight} numeric onChangeText={(weight) => setAssessment((v) => ({ ...v, weight }))} />
            <Field label="Altura (cm)" value={assessment.height} numeric onChangeText={(height) => setAssessment((v) => ({ ...v, height }))} />
            <Field label="Gordura corporal (%)" value={assessment.bodyFatPercent} numeric onChangeText={(bodyFatPercent) => setAssessment((v) => ({ ...v, bodyFatPercent }))} />
            <Field label="Peito (cm)" value={assessment.chest} numeric onChangeText={(chest) => setAssessment((v) => ({ ...v, chest }))} />
            <Field label="Cintura (cm)" value={assessment.waist} numeric onChangeText={(waist) => setAssessment((v) => ({ ...v, waist }))} />
            <Field label="Quadril (cm)" value={assessment.hip} numeric onChangeText={(hip) => setAssessment((v) => ({ ...v, hip }))} />
            <Field label="Restrições / lesões" value={assessment.restrictions} onChangeText={(restrictions) => setAssessment((v) => ({ ...v, restrictions }))} />
            <Field label="Observações" value={assessment.notes} onChangeText={(notes) => setAssessment((v) => ({ ...v, notes }))} />
          </View>
          <Button
            testID="assessment-create"
            label="Registrar avaliação"
            disabled={saving}
            onPress={() => void mutate(() => api(`/students/${selectedStudent}/assessments`, undefined, {
              method: 'POST',
              body: JSON.stringify({
                ...(number(assessment.weight) !== undefined ? { weight: number(assessment.weight) } : {}),
                ...(number(assessment.height) !== undefined ? { height: number(assessment.height) } : {}),
                ...(number(assessment.bodyFatPercent) !== undefined ? { bodyFatPercent: number(assessment.bodyFatPercent) } : {}),
                ...([assessment.chest, assessment.waist, assessment.hip].some((value) => number(value) !== undefined) ? {
                  measurements: {
                    ...(number(assessment.chest) !== undefined ? { chest: number(assessment.chest) } : {}),
                    ...(number(assessment.waist) !== undefined ? { waist: number(assessment.waist) } : {}),
                    ...(number(assessment.hip) !== undefined ? { hip: number(assessment.hip) } : {}),
                  },
                } : {}),
                ...(assessment.restrictions.trim() ? { restrictions: { notes: assessment.restrictions.trim() } } : {}),
                ...(assessment.notes.trim() ? { notes: assessment.notes.trim() } : {}),
              }),
            }), () => setAssessment({ weight: '', height: '', bodyFatPercent: '', chest: '', waist: '', hip: '', restrictions: '', notes: '' }))}
          />
        </> : null}
      </Section>

      {selectedStudent ? <View style={styles.compactGrid}>
        <View style={styles.compactPane}><Section compact title="Evolução corporal" subtitle="Comparação da avaliação mais recente com a anterior.">
          {latest ? <>
            <View style={styles.assessmentMetricGrid}>
              <View style={styles.assessmentMetric}><Text style={styles.kpiValue}>{latest.weight ?? '—'}</Text><Text style={styles.muted}>Peso kg · Δ {delta(latest.weight, previous?.weight, ' kg')}</Text></View>
              <View style={styles.assessmentMetric}><Text style={styles.kpiValue}>{latest.bmi ?? '—'}</Text><Text style={styles.muted}>IMC · Δ {delta(latest.bmi, previous?.bmi)}</Text></View>
              <View style={styles.assessmentMetric}><Text style={styles.kpiValue}>{latest.bodyFatPercent ?? '—'}</Text><Text style={styles.muted}>Gordura % · Δ {delta(latest.bodyFatPercent, previous?.bodyFatPercent, ' p.p.')}</Text></View>
            </View>
            <Text style={styles.helper}>Última avaliação: {dateLabel(latest.createdAt)}</Text>
            <Text style={styles.muted}>{measurementSummary(latest.measurements)}</Text>
            <Text style={styles.muted}>Restrições: {restrictionsSummary(latest.restrictions)}</Text>
          </> : <Text style={styles.muted}>Nenhuma avaliação registrada.</Text>}
        </Section></View>
        <View style={styles.compactPane}><Section compact title="Contexto de treino" subtitle="Treinos do aluno disponíveis para revisão junto ao histórico físico.">
          {workouts.length ? workouts.slice(0, 8).map((workout: any) => <View key={workout.id} style={styles.row}><Text style={styles.rowTitle}>{workout.goal ?? 'Treino'}</Text><Text style={styles.muted}>Situação: {workout.status ?? '—'} · Nível: {workout.level ?? '—'}{workout.createdByAI ? ' · candidato da IA/revisado' : ''}</Text></View>) : <Text style={styles.muted}>Nenhum treino encontrado para este aluno.</Text>}
        </Section></View>
      </View> : null}

      {selectedStudent ? <Section compact title="Histórico de avaliações">
        {assessments.length ? assessments.map((item: any) => <View key={item.id} style={styles.row}>
          <View style={styles.teamRowHead}><Text style={styles.rowTitle}>{dateLabel(item.createdAt)}</Text><Text style={styles.muted}>{item.weight != null ? `${item.weight} kg` : 'Peso —'} · IMC {item.bmi ?? '—'} · Gordura {item.bodyFatPercent ?? '—'}%</Text></View>
          <Text style={styles.muted}>{measurementSummary(item.measurements)}</Text>
          <Text style={styles.muted}>Restrições: {restrictionsSummary(item.restrictions)}</Text>
          {item.notes ? <Text style={styles.helper}>Observações: {item.notes}</Text> : null}
        </View>) : <Text style={styles.muted}>Nenhuma avaliação registrada.</Text>}
      </Section> : <Section compact title="Histórico de avaliações"><Text style={styles.muted}>Selecione um aluno para visualizar o histórico.</Text></Section>}
    </>;
  }
  function workoutsView() {
    const students = list(data.students);
    const workouts = list(data.workouts);
    const exercises = list(data.workoutExercises);
    const inventory = list(data.workoutInventory);
    const assessments = list(data.workoutAssessments);
    const compatibleEquipment = list(data.workoutCompatibleEquipment);
    const weeklyFrequency = workoutDraft.weeklyFrequency.trim() ? Number(workoutDraft.weeklyFrequency) : undefined;
    const intValue = (value: string) => value.trim() && Number.isInteger(Number(value)) ? Number(value) : undefined;
    const assessmentOptions = assessments.map((item: any) => ({
      id: item.id,
      name: `${item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'Avaliação'} · IMC ${item.bmi ?? '—'} · Gordura ${item.bodyFatPercent ?? '—'}%`,
    }));
    const selectedExercise = exercises.find((item: any) => item.id === selectedWorkoutExercise);

    const resetStudio = () => {
      setWorkoutDraft({ goal: '', level: '', weeklyFrequency: '', notes: '' });
      setWorkoutAssessmentId('');
      setWorkoutSessions([]);
      setWorkoutSessionExercises([]);
      setWorkoutSessionDraft({ name: 'Treino A', sessionType: '', estimatedMinutes: '60' });
      setSelectedWorkoutExercise('');
      setSelectedWorkoutEquipment('');
      setWorkoutExerciseDraft({ sets: '3', reps: '10', restSeconds: '60', suggestedLoad: '', notes: '' });
      setData((current) => ({ ...current, workoutCompatibleEquipment: [] }));
    };

    const addExerciseToSession = () => {
      if (!selectedExercise) {
        setError('Selecione um exercício para adicionar à sessão.');
        return;
      }
      const equipment = compatibleEquipment.find((item: any) => item.id === selectedWorkoutEquipment);
      setWorkoutSessionExercises((current) => [...current, {
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        ...(equipment ? { equipmentId: equipment.id, equipmentName: equipment.catalogItem?.name ?? equipment.name ?? equipment.id } : {}),
        ...(intValue(workoutExerciseDraft.sets) !== undefined ? { sets: intValue(workoutExerciseDraft.sets) } : {}),
        ...(workoutExerciseDraft.reps.trim() ? { reps: workoutExerciseDraft.reps.trim() } : {}),
        ...(intValue(workoutExerciseDraft.restSeconds) !== undefined ? { restSeconds: intValue(workoutExerciseDraft.restSeconds) } : {}),
        ...(workoutExerciseDraft.suggestedLoad.trim() ? { suggestedLoad: workoutExerciseDraft.suggestedLoad.trim() } : {}),
        ...(workoutExerciseDraft.notes.trim() ? { notes: workoutExerciseDraft.notes.trim() } : {}),
      }]);
      setSelectedWorkoutExercise('');
      setSelectedWorkoutEquipment('');
      setWorkoutExerciseDraft({ sets: '3', reps: '10', restSeconds: '60', suggestedLoad: '', notes: '' });
      setData((current) => ({ ...current, workoutCompatibleEquipment: [] }));
      setError('');
    };

    const addSessionToWorkout = () => {
      if (!workoutSessionDraft.name.trim()) {
        setError('Informe o nome da sessão.');
        return;
      }
      if (!workoutSessionExercises.length) {
        setError('Adicione pelo menos um exercício à sessão.');
        return;
      }
      setWorkoutSessions((current) => [...current, {
        name: workoutSessionDraft.name.trim(),
        ...(workoutSessionDraft.sessionType.trim() ? { sessionType: workoutSessionDraft.sessionType.trim() } : {}),
        ...(intValue(workoutSessionDraft.estimatedMinutes) !== undefined ? { estimatedMinutes: intValue(workoutSessionDraft.estimatedMinutes) } : {}),
        order: current.length + 1,
        exercises: workoutSessionExercises,
      }]);
      setWorkoutSessionExercises([]);
      setWorkoutSessionDraft((current) => ({ ...current, name: `Treino ${String.fromCharCode(65 + workoutSessions.length + 1)}` }));
      setError('');
    };

    const manualPayload = () => ({
      studentId: selectedStudent,
      ...(workoutAssessmentId ? { assessmentId: workoutAssessmentId } : {}),
      ...(workoutDraft.goal.trim() ? { goal: workoutDraft.goal.trim() } : {}),
      ...(workoutDraft.level.trim() ? { level: workoutDraft.level.trim() } : {}),
      ...(weeklyFrequency !== undefined ? { weeklyFrequency } : {}),
      ...(workoutDraft.notes.trim() ? { notes: workoutDraft.notes.trim() } : {}),
      sessions: workoutSessions.map((session: any, sessionIndex: number) => ({
        name: session.name,
        ...(session.sessionType ? { sessionType: session.sessionType } : {}),
        order: sessionIndex + 1,
        ...(session.estimatedMinutes ? { estimatedMinutes: session.estimatedMinutes } : {}),
        exercises: session.exercises.map((item: any, exerciseIndex: number) => ({
          exerciseId: item.exerciseId,
          ...(item.equipmentId ? { equipmentId: item.equipmentId } : {}),
          order: exerciseIndex + 1,
          ...(item.sets ? { sets: item.sets } : {}),
          ...(item.reps ? { reps: item.reps } : {}),
          ...(item.restSeconds ? { restSeconds: item.restSeconds } : {}),
          ...(item.suggestedLoad ? { suggestedLoad: item.suggestedLoad } : {}),
          ...(item.notes ? { notes: item.notes } : {}),
        })),
      })),
    });

    return <>
      <Section compact title="Workout Studio" subtitle="Aluno → avaliação → exercícios/equipamentos → sessões → revisão → aprovação → ativação.">
        <View style={styles.compactGrid}>
          <View style={styles.compactPane}>
            <View style={styles.studioStep}>
              <Text style={styles.rowTitle}>1. Aluno e avaliação</Text>
              <Text style={styles.label}>Aluno</Text>
              <Chips rows={students} selected={selectedStudent} onSelect={(id) => { setSelectedStudent(id); setWorkoutAssessmentId(''); }} />
              {selectedStudent ? <>
                <Text style={styles.label}>Avaliação de referência</Text>
                {assessmentOptions.length ? <Chips rows={[{ id: '', name: 'Sem avaliação vinculada' }, ...assessmentOptions]} selected={workoutAssessmentId} onSelect={setWorkoutAssessmentId} /> : <Text style={styles.helper}>Este aluno ainda não possui avaliação registrada.</Text>}
              </> : <Text style={styles.helper}>Selecione um aluno para carregar avaliações e montar o treino.</Text>}
            </View>
          </View>

          <View style={styles.compactPane}>
            <View style={styles.studioStep}>
              <Text style={styles.rowTitle}>2. Estrutura do treino</Text>
              <View style={styles.form}>
                <Field label="Objetivo" value={workoutDraft.goal} onChangeText={(goal) => setWorkoutDraft((v) => ({ ...v, goal }))} />
                <Field label="Nível" value={workoutDraft.level} onChangeText={(level) => setWorkoutDraft((v) => ({ ...v, level }))} />
                <Field label="Frequência semanal" value={workoutDraft.weeklyFrequency} numeric onChangeText={(value) => setWorkoutDraft((v) => ({ ...v, weeklyFrequency: value }))} />
                <Field label="Observações" value={workoutDraft.notes} onChangeText={(notes) => setWorkoutDraft((v) => ({ ...v, notes }))} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.studioStep}>
          <Text style={styles.rowTitle}>3. Montar sessão</Text>
          <View style={styles.form}>
            <Field label="Nome da sessão" value={workoutSessionDraft.name} onChangeText={(name) => setWorkoutSessionDraft((v) => ({ ...v, name }))} />
            <Field label="Tipo da sessão" value={workoutSessionDraft.sessionType} onChangeText={(sessionType) => setWorkoutSessionDraft((v) => ({ ...v, sessionType }))} />
            <Field label="Duração estimada (min)" value={workoutSessionDraft.estimatedMinutes} numeric onChangeText={(estimatedMinutes) => setWorkoutSessionDraft((v) => ({ ...v, estimatedMinutes }))} />
          </View>

          <Text style={styles.label}>Exercício</Text>
          <Chips rows={exercises} selected={selectedWorkoutExercise} onSelect={(id) => {
            setSelectedWorkoutExercise(id);
            setSelectedWorkoutEquipment('');
            setData((current) => ({ ...current, workoutCompatibleEquipment: [] }));
          }} />
          {selectedExercise ? <View style={styles.actions}>
            <Button secondary label="Buscar equipamentos compatíveis" onPress={() => { void (async () => {
              setSaving(true); setError('');
              try {
                const result = await api(`/equipments/exercises/${selectedExercise.id}/compatible`);
                setData((current) => ({ ...current, workoutCompatibleEquipment: result }));
              } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
            })(); }} />
          </View> : null}

          {selectedExercise ? <>
            <Text style={styles.label}>Equipamento compatível (opcional)</Text>
            {compatibleEquipment.length ? <Chips rows={[{ id: '', name: 'Sem equipamento' }, ...compatibleEquipment.map((item: any) => ({ ...item, name: item.catalogItem?.name ?? item.name ?? item.id }))]} selected={selectedWorkoutEquipment} onSelect={setSelectedWorkoutEquipment} /> : <Text style={styles.helper}>{inventory.length ? 'Busque a compatibilidade para selecionar equipamento do inventário.' : 'A academia não possui equipamentos ativos no inventário.'}</Text>}
            <View style={styles.form}>
              <Field label="Séries" value={workoutExerciseDraft.sets} numeric onChangeText={(sets) => setWorkoutExerciseDraft((v) => ({ ...v, sets }))} />
              <Field label="Repetições" value={workoutExerciseDraft.reps} onChangeText={(reps) => setWorkoutExerciseDraft((v) => ({ ...v, reps }))} />
              <Field label="Descanso (s)" value={workoutExerciseDraft.restSeconds} numeric onChangeText={(restSeconds) => setWorkoutExerciseDraft((v) => ({ ...v, restSeconds }))} />
              <Field label="Carga sugerida" value={workoutExerciseDraft.suggestedLoad} onChangeText={(suggestedLoad) => setWorkoutExerciseDraft((v) => ({ ...v, suggestedLoad }))} />
              <Field label="Observação do exercício" value={workoutExerciseDraft.notes} onChangeText={(notes) => setWorkoutExerciseDraft((v) => ({ ...v, notes }))} />
            </View>
            <Button testID="workout-add-exercise" secondary label="Adicionar exercício à sessão" onPress={addExerciseToSession} />
          </> : null}

          {workoutSessionExercises.length ? <View style={styles.studioList}>
            {workoutSessionExercises.map((item: any, index: number) => <View key={`${item.exerciseId}-${index}`} style={styles.studioSessionCard}>
              <View style={styles.teamRowHead}><Text style={styles.rowTitle}>{index + 1}. {item.exerciseName}</Text><Button secondary label="Remover" onPress={() => setWorkoutSessionExercises((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></View>
              <Text style={styles.muted}>{item.sets ?? '—'} séries · {item.reps ?? '—'} reps · {item.restSeconds ?? '—'}s descanso{item.suggestedLoad ? ` · carga ${item.suggestedLoad}` : ''}</Text>
              {item.equipmentName ? <Text style={styles.helper}>Equipamento: {item.equipmentName}</Text> : null}
            </View>)}
            <Button testID="workout-add-session" label="Adicionar sessão ao treino" onPress={addSessionToWorkout} />
          </View> : null}
        </View>

        {workoutSessions.length ? <View style={styles.studioStep}>
          <Text style={styles.rowTitle}>4. Sessões prontas para o rascunho</Text>
          <View style={styles.compactGrid}>
            {workoutSessions.map((session: any, index: number) => <View key={`${session.name}-${index}`} style={styles.studioSessionCard}>
              <View style={styles.teamRowHead}><Text style={styles.rowTitle}>{session.name}</Text><Button secondary label="Remover sessão" onPress={() => setWorkoutSessions((current) => current.filter((_, itemIndex) => itemIndex !== index))} /></View>
              <Text style={styles.muted}>{session.exercises.length} exercícios · {session.estimatedMinutes ?? '—'} min</Text>
              {session.exercises.map((item: any, exerciseIndex: number) => <Text key={`${item.exerciseId}-${exerciseIndex}`} style={styles.helper}>{exerciseIndex + 1}. {item.exerciseName} · {item.sets ?? '—'}×{item.reps ?? '—'}</Text>)}
            </View>)}
          </View>
        </View> : null}

        <Button
          testID="manual-workout-create"
          label="Criar rascunho para revisão"
          disabled={saving || !selectedStudent || !workoutSessions.length || (weeklyFrequency !== undefined && (!Number.isInteger(weeklyFrequency) || weeklyFrequency < 1))}
          disabledReason={!selectedStudent ? 'Selecione o aluno.' : !workoutSessions.length ? 'Monte e adicione pelo menos uma sessão.' : 'Revise a frequência semanal.'}
          onPress={() => void mutate(() => api('/workouts', undefined, { method: 'POST', body: JSON.stringify(manualPayload()) }), resetStudio)}
        />
      </Section>

      {enabled('ai.workout_generation') ? <Section compact title="IRON Intelligence — candidato de treino" subtitle="A IA recebe contexto reconstruído pelo servidor e nunca aprova ou ativa o treino.">
        <Text style={styles.label}>Aluno</Text>
        <Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} />
        {selectedStudent ? <Text style={styles.helper}>Contexto disponível: {assessments.length} avaliações · {inventory.length} equipamentos ativos. A seleção final é validada pelo backend.</Text> : null}
        <Field label="Instruções opcionais" value={aiInstructions} onChangeText={setAiInstructions} />
        <Button label="Gerar candidato para revisão" disabled={saving || !selectedStudent} onPress={() => void mutate(() => api('/ai/workout-candidates', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent, ...(aiInstructions.trim() ? { instructions: aiInstructions.trim() } : {}) }) }))} />
      </Section> : null}

      <Section compact title="Treinos e revisão humana" subtitle="Nenhum treino entra em ACTIVE sem passar por aprovação humana.">
        {workouts.length ? workouts.map((workout: any) => <View key={workout.id} style={styles.row}>
          <View style={styles.teamRowHead}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{workout.student?.user?.name ?? workout.goal ?? 'Treino'}</Text>
              <Text style={styles.muted}>Situação: {workout.status} · Origem: {workout.createdByAI ? 'IRON Intelligence' : 'Profissional'}</Text>
            </View>
            <Text style={[styles.teamStatus, workout.status === 'ACTIVE' ? styles.teamStatusActive : styles.teamStatusInactive]}>{workout.status}</Text>
          </View>
          {workout.assessmentId ? <Text style={styles.helper}>Avaliação vinculada: {workout.assessmentId}</Text> : null}
          {Array.isArray(workout.sessions) && workout.sessions.length ? <View style={styles.studioList}>{workout.sessions.map((session: any) => <View key={session.id ?? session.name} style={styles.studioSessionCard}>
            <Text style={styles.rowTitle}>{session.name ?? 'Sessão'}</Text>
            {(session.exercises ?? []).map((item: any, index: number) => <Text key={item.id ?? index} style={styles.helper}>{index + 1}. {item.exercise?.name ?? 'Exercício'} · {item.sets ?? '—'}×{item.reps ?? '—'}{item.equipment?.name ? ` · ${item.equipment.name}` : ''}</Text>)}
          </View>)}</View> : null}
          {(workout.status === 'DRAFT' || workout.status === 'PENDING_REVIEW') ? <View style={styles.actions}>
            <Button testID={`workout-approve-${workout.id}`} label="Aprovar após revisão" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) }))} />
          </View> : null}
          {workout.status === 'APPROVED' ? <View style={styles.actions}>
            <Button testID={`workout-activate-${workout.id}`} label="Ativar treino aprovado" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) }))} />
          </View> : null}
          {workout.status === 'ACTIVE' ? <Button secondary label="Encerrar treino" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'EXPIRED' }) }))} /> : null}
        </View>) : <Text style={styles.muted}>Nenhum treino encontrado.</Text>}
      </Section>
    </>;
  }
  function scheduleView() {
    return <ScheduleWorkspace
      students={list(data.students)}
      slots={list(data.slots)}
      bookings={list(data.bookings)}
      saving={saving}
      canCreateSlot={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}
      canManageBookings={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')}
      onCreateSlot={async (payload) => {
        await mutate(() => api('/schedule-slots', undefined, {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }}
      onBook={async (payload) => {
        await mutate(() => api('/schedules', undefined, {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }}
      onCheckIn={async (bookingId) => {
        await mutate(() => api(`/schedules/${bookingId}/check-in`, undefined, {
          method: 'PATCH',
        }));
      }}
    />;
  }
  function accessView() {
    return <AccessCenterWorkspace
      students={list(data.students)}
      credentials={list(data.credentials)}
      events={list(data.events)}
      devices={list(data.devices)}
      saving={saving}
      canManageDevices={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}
      onCreateCredential={async (payload) => {
        let created: any = null;
        await mutate(async () => {
          created = await api('/access/credentials', undefined, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          return created;
        });
        return created;
      }}
      onRevokeCredential={async (credentialId) => {
        await mutate(() => api(`/access/credentials/${credentialId}/revoke`, undefined, {
          method: 'PATCH',
        }));
      }}
      onRotateDeviceToken={async (deviceId) => {
        let created: any = null;
        await mutate(async () => {
          created = await api(`/access/devices/${deviceId}/token`, undefined, {
            method: 'POST',
          });
          return created;
        });
        return created;
      }}
    />;
  }
  function financialView() {
    return <FinancialWorkspace
      students={list(data.students)}
      accounts={list(data.accounts)}
      subscriptions={list(data.subscriptions)}
      charges={list(data.charges)}
      overdueCharges={list(data.overdueCharges)}
      transactions={list(data.transactions)}
      saving={saving}
      onCreateAccount={async (payload) => {
        await mutate(() => api('/financial/accounts', undefined, {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }}
      onCreateSubscription={async (payload) => {
        await mutate(() => api('/financial/subscriptions', undefined, {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }}
      onCreateCharge={async (payload) => {
        await mutate(() => api('/financial/charges', undefined, {
          method: 'POST',
          body: JSON.stringify(payload),
        }));
      }}
      onPayCharge={async (chargeId, payload) => {
        await mutate(() => api(`/financial/charges/${chargeId}/pay`, undefined, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }));
      }}
    />;
  }
  function entitlementsView() {
    return <EntitlementsWorkspace
      subscription={data.subscription ?? subscription}
      features={list(data.features)}
      saving={saving}
      onSetConfiguration={async (featureKey, payload) => {
        await mutate(() => api(`/product-entitlements/tenant/configurations/${featureKey}`, undefined, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }));
      }}
      onResetConfiguration={async (featureKey) => {
        await mutate(() => api(`/product-entitlements/tenant/configurations/${featureKey}`, undefined, {
          method: 'DELETE',
        }));
      }}
    />;
  }
  function creatorView() {
    return <CreatorNetworkWorkspace
      items={list(data.items)}
      overview={data.overview}
      analytics={data.analytics}
      externalYoutubeEnabled={enabled('content.external_youtube')}
      ironManagedEnabled={enabled('content.iron_managed')}
      tenantPrivateEnabled={enabled('content.tenant_private')}
    />;
  }
  function content() {
    if (isRestrictedAdminModule(active) && !adminStepUpActive) return adminGateView();
    if (active === 'overview') return overview(); if (active === 'onboarding') return onboardingView(); if (active === 'students') return studentsView(); if (active === 'team') return teamView(); if (active === 'equipment') return equipmentView(); if (active === 'exercises') return exercisesView(); if (active === 'assessments') return assessmentsView(); if (active === 'workouts') return workoutsView(); if (active === 'schedule') return scheduleView(); if (active === 'access') return accessView(); if (active === 'communication') return <CommunicationCenter canManageAutomations={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} canInspectIntegrations={can('SUPER_ADMIN', 'OWNER')} />; if (active === 'financial') return financialView(); if (active === 'fiscal') return <FiscalCenter />; if (active === 'saasBilling') return <SaasBillingPanel onCommercialStateChanged={loadShell} canAdministerBilling={can('SUPER_ADMIN')} />; if (active === 'security') return <AccountSecurityPanel />; if (active === 'privacy') return <PrivacyCenter canOperatePrivacy={can('SUPER_ADMIN')} />; if (active === 'entitlements') return entitlementsView(); if (active === 'integrations') return <IntegrationCredentialsPanel canStartOAuth={can('OWNER')} />; return creatorView();
  }

  const topBar = <View style={styles.top}><IronBrand compact /><View style={styles.actions}><Text style={styles.muted}>{profile?.name ?? profile?.email ?? 'Usuário'}</Text><Button testID="commercial-logout" secondary label="Sair" onPress={() => { void logout(); }} /></View></View>;
  if (!shellReady) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={styles.contentInner}>{error ? <Text style={styles.error}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Preparando sua academia…</Text></View>}</View></View>;
  if (blocked) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <React.Fragment key={item.key}>{!compact && item.key === 'financial' ? <Text style={styles.navSection}>ADMINISTRAÇÃO RESTRITA</Text> : null}<TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#dbeafe' : '#9fb0c5'} /><Text style={styles.navText}>{item.label}</Text></TouchableOpacity></React.Fragment>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.warning} testID="subscription-blocked"><Text style={styles.warningTitle}>Acesso comercial limitado</Text><Text style={styles.muted}>Seu acesso operacional está limitado. Consulte sua assinatura para regularizar o acesso. A segurança da conta continua disponível.</Text></View><Section title="Estado comercial"><Data value={[{ trialStatus: trial?.status ?? null, subscriptionStatus: subscription?.status ?? null, subscriptionId: subscription?.id ?? null }]} /></Section>{active === 'security' ? <AccountSecurityPanel /> : active === 'privacy' ? <PrivacyCenter canOperatePrivacy={can('SUPER_ADMIN')} /> : <SaasBillingPanel onCommercialStateChanged={loadShell} canAdministerBilling={can('SUPER_ADMIN')} />}</ScrollView></View></View>;
  return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <React.Fragment key={item.key}>{!compact && item.key === 'financial' ? <Text style={styles.navSection}>ADMINISTRAÇÃO RESTRITA</Text> : null}<TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#dbeafe' : '#9fb0c5'} /><Text style={styles.navText}>{item.label}</Text></TouchableOpacity></React.Fragment>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.pageHead}><View><Text style={styles.title}>{modules.find((item) => item.key === active)?.label}</Text><Text style={styles.muted}>{active === 'financial' ? 'Área restrita · Proprietário / Administrador' : (data.gym?.name ?? 'Gestão da academia')}</Text></View><Button secondary label="Atualizar" onPress={() => { void loadModule(active); }} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Carregando informações…</Text></View> : content()}</ScrollView></View></View>;
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
  content: { flex: 1 }, contentInner: { padding: 14, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  pageHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9 },
  title: { color: '#eef7ff', fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 15, marginBottom: 9 },
  sectionCompact: { borderRadius: 13, padding: 11, marginBottom: 7 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  sectionBody: { marginTop: 8 },
  sectionBodyCompact: { marginTop: 5 },
  compactGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  compactPane: { flexGrow: 1, flexBasis: 330, minWidth: 0 },
  compactPaneWide: { flexGrow: 1, flexBasis: 480, minWidth: 0 },
  creatorWrap: { width: '100%', alignSelf: 'center' },
  moduleIntro: { color: '#9fb0c5', fontSize: 12, lineHeight: 17, marginBottom: 7 },
  creatorGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  creatorPane: { flexGrow: 1, flexBasis: 300, minWidth: 270 },
  equipmentCatalogGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  equipmentCard: { flexGrow: 1, flexBasis: 260, minWidth: 240, maxWidth: 420, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  exerciseCardSelected: { borderColor: '#2f91ff', backgroundColor: '#071a31' },
  assessmentMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  assessmentMetric: { flexGrow: 1, flexBasis: 120, minWidth: 110, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 10 },
  kpiValue: { color: '#eef7ff', fontSize: 22, fontWeight: '900' },
  studioStep: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11, marginBottom: 8 },
  studioList: { width: '100%', gap: 7, marginTop: 8 },
  studioSessionCard: { flexGrow: 1, flexBasis: 260, minWidth: 240, backgroundColor: '#08172a', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  navSection: { color: '#6fa8dc', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginTop: 10, marginBottom: 4, marginHorizontal: 12 },
  restrictedNote: { color: '#bfdbfe', backgroundColor: '#08172a', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  adminGateIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  adminGateForm: { width: '100%', maxWidth: 760, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  row: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 9 },
  rowTitle: { color: '#eef7ff', fontWeight: '700', marginBottom: 5 },
  rowText: { flex: 1, minWidth: 0 },
  teamRowHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  teamStatus: { fontSize: 11, fontWeight: '800', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  teamStatusActive: { color: '#86efac', borderColor: '#166534', backgroundColor: '#08271c' },
  teamStatusInactive: { color: '#fca5a5', borderColor: '#7f1d1d', backgroundColor: '#2b1015' },
  json: { color: '#9fb0c5', fontSize: 11, lineHeight: 17 },
  muted: { color: '#9fb0c5', fontSize: 13, lineHeight: 19 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  fieldWrap: { minWidth: 180, flexGrow: 1, flexBasis: 220 },
  label: { color: '#9fb0c5', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { minHeight: 44, color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  buttonWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11, marginTop: 4 },
  secondary: { backgroundColor: '#111a29', borderWidth: 1, borderColor: '#2a3b52' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonHint: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 360 },
  helper: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 6 },
  disabled: { opacity: 0.42 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  chip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#090f1a' },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#d5deea', fontSize: 12 },
  invite: { backgroundColor: '#08271c', borderWidth: 1, borderColor: '#145c3c', borderRadius: 13, padding: 14, marginTop: 13 },
  warning: { margin: 12, padding: 14, borderRadius: 13, backgroundColor: '#241b08', borderWidth: 1, borderColor: '#76591b' },
  warningTitle: { color: '#fbbf24', fontWeight: '800' },
  error: { color: '#fecaca', backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#5b2028', padding: 11, borderRadius: 10, marginBottom: 11 },
  success: { color: '#4ade80', fontWeight: '700' },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 9 },
});
