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
const restrictedAdminModules: ModuleKey[] = ['financial', 'saasBilling', 'entitlements', 'integrations'];

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
  { key: 'creator', label: 'Creator Network', icon: 'images-outline', roles: ['OWNER', 'MANAGER'], entitlement: ['content.external_youtube', 'content.iron_managed', 'content.tenant_private'] },
  { key: 'security', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
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
  const [studentSearch, setStudentSearch] = useState('');
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
  const visible = useMemo(() => modules.filter((item) => allowed(item) && (!blocked || item.key === 'saasBilling' || item.key === 'security')), [allowed, blocked]);

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
  }, [activeTenantId, adminStepUpActive, can, enabled, selectedStudent, subscription]);

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
            testID="team-invite"
            label={saving ? 'Enviando…' : 'Enviar convite'}
            disabled={saving}
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
            testID="team-add"
            secondary
            label={saving ? 'Adicionando…' : 'Cadastrar com senha inicial'}
            disabled={saving}
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
    return <><View style={styles.compactGrid}><View style={styles.compactPane}><Section compact title="Criar treino manual" subtitle="Monte um rascunho para revisar antes de ativar."><Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} /><View style={styles.form}><Field label="Objetivo" value={workoutDraft.goal} onChangeText={(goal) => setWorkoutDraft((v) => ({ ...v, goal }))} /><Field label="Nível" value={workoutDraft.level} onChangeText={(level) => setWorkoutDraft((v) => ({ ...v, level }))} /><Field label="Frequência semanal" value={workoutDraft.weeklyFrequency} numeric onChangeText={(value) => setWorkoutDraft((v) => ({ ...v, weeklyFrequency: value }))} /><Field label="Observações" value={workoutDraft.notes} onChangeText={(notes) => setWorkoutDraft((v) => ({ ...v, notes }))} /></View><Button testID="manual-workout-create" label="Criar rascunho" disabled={saving || !selectedStudent || (weeklyFrequency !== undefined && (!Number.isInteger(weeklyFrequency) || weeklyFrequency < 1))} onPress={() => void mutate(() => api('/workouts', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent, ...(workoutDraft.goal.trim() ? { goal: workoutDraft.goal.trim() } : {}), ...(workoutDraft.level.trim() ? { level: workoutDraft.level.trim() } : {}), ...(weeklyFrequency !== undefined ? { weeklyFrequency } : {}), ...(workoutDraft.notes.trim() ? { notes: workoutDraft.notes.trim() } : {}) }) }), () => setWorkoutDraft({ goal: '', level: '', weeklyFrequency: '', notes: '' }))} /></Section></View>{enabled('ai.workout_generation') ? <View style={styles.compactPane}><Section compact title="Iron Intelligence — candidato de treino" subtitle="Sugestão da IA com revisão humana obrigatória."><Chips rows={students} selected={selectedStudent} onSelect={setSelectedStudent} /><Field label="Instruções opcionais" value={aiInstructions} onChangeText={setAiInstructions} /><Button label="Gerar candidato" disabled={saving || !selectedStudent} onPress={() => void mutate(() => api('/ai/workout-candidates', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedStudent, ...(aiInstructions.trim() ? { instructions: aiInstructions.trim() } : {}) }) }))} /></Section></View> : null}</View><Section compact title="Treinos e revisão humana">{workouts.length ? workouts.map((workout: any) => <View key={workout.id} style={styles.row}><Text style={styles.rowTitle}>{workout.student?.user?.name ?? workout.goal ?? workout.id}</Text><Text style={styles.muted}>Situação: {workout.status} · IA: {workout.createdByAI ? 'sim' : 'não'}</Text>{workout.status === 'PENDING_REVIEW' ? <View style={styles.actions}><Button label="Aprovar" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) }))} /><Button secondary label="Ativar" disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) }))} /></View> : null}</View>) : <Text style={styles.muted}>Nenhum treino encontrado.</Text>}</Section></>;
  }
  function scheduleView() {
    const students = list(data.students); const slots = list(data.slots);
    return <><View style={styles.compactGrid}>{can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? <View style={styles.compactPane}><Section compact title="Criar horário"><View style={styles.form}><Field label="Dia da semana (0 a 6)" value={schedule.weekday} numeric onChangeText={(weekday) => setSchedule((v) => ({ ...v, weekday }))} /><Field label="Início" value={schedule.startTime} onChangeText={(startTime) => setSchedule((v) => ({ ...v, startTime }))} /><Field label="Fim" value={schedule.endTime} onChangeText={(endTime) => setSchedule((v) => ({ ...v, endTime }))} /><Field label="Capacidade" value={schedule.capacity} numeric onChangeText={(capacity) => setSchedule((v) => ({ ...v, capacity }))} /></View><Button label="Criar horário" disabled={saving} onPress={() => void mutate(() => api('/schedule-slots', undefined, { method: 'POST', body: JSON.stringify({ weekday: Number(schedule.weekday), startTime: schedule.startTime.trim(), endTime: schedule.endTime.trim(), capacity: Number(schedule.capacity), active: true }) }))} /></Section></View> : null}{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <View style={styles.compactPane}><Section compact title="Agendar aluno e check-in" subtitle="Selecione aluno, horário e data."><Text style={styles.label}>Aluno</Text><Chips rows={students} selected={selectedScheduleStudent} onSelect={setSelectedScheduleStudent} /><Text style={styles.label}>Horário</Text><Chips rows={slots} selected={selectedScheduleSlot} onSelect={setSelectedScheduleSlot} /><Field label="Data (AAAA-MM-DD)" value={bookingDate} onChangeText={setBookingDate} /><Button testID="schedule-book" label="Agendar aluno" disabled={saving || !selectedScheduleStudent || !selectedScheduleSlot || !bookingDate.trim()} onPress={() => void mutate(async () => { const created = await api('/schedules', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedScheduleStudent, slotId: selectedScheduleSlot, date: bookingDate.trim() }) }); setLastBooking(created); return created; })} />{lastBooking?.id ? <View style={styles.invite}><Text style={styles.rowTitle}>Agendamento criado</Text><Text style={styles.muted}>Identificador: {lastBooking.id}</Text><Button secondary testID="schedule-check-in" label="Registrar check-in" disabled={saving} onPress={() => void mutate(() => api(`/schedules/${lastBooking.id}/check-in`, undefined, { method: 'PATCH' }), () => setLastBooking(null))} /></View> : null}</Section></View> : null}</View><Section compact title="Agenda"><Data value={slots} /></Section></>;
  }
  function accessView() {
    const students = list(data.students);
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Emitir credencial de acesso" subtitle="Guarde a credencial ao emiti-la. O código só é exibido uma vez."><Chips rows={students} selected={selectedAccessStudent} onSelect={setSelectedAccessStudent} /><View style={styles.form}><Field label="Tipo" value={credentialType} onChangeText={setCredentialType} /><Field label="Validade (AAAA-MM-DD, opcional)" value={credentialExpiresAt} onChangeText={setCredentialExpiresAt} /></View><Button testID="access-credential-create" label="Gerar credencial" disabled={saving || !selectedAccessStudent} onPress={() => void mutate(async () => { const created = await api('/access/credentials', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedAccessStudent, ...(credentialType.trim() ? { type: credentialType.trim() } : {}), ...(credentialExpiresAt.trim() ? { expiresAt: credentialExpiresAt.trim() } : {}) }) }); setLastCredential(created); return created; })} />{lastCredential?.qrToken ? <View style={styles.invite}><Text style={styles.rowTitle}>Código QR — exibir uma única vez</Text><Text selectable style={styles.json}>{lastCredential.qrToken}</Text><Text style={styles.muted}>Credencial: {lastCredential.credentialId ?? '—'} · Tipo: {lastCredential.type ?? '—'}</Text><Button secondary label="Ocultar token" onPress={() => setLastCredential(null)} /></View> : null}</Section> : null}<Section title="Histórico de acessos"><Data value={data.events} /></Section></>;
  }
  function financialView() {
    const students = list(data.students); const accounts = list(data.accounts); const charges = list(data.charges);
    return <><Text style={styles.restrictedNote}>Área restrita ao proprietário e à administração autorizada.</Text><View style={styles.compactGrid}><View style={styles.compactPane}><Section compact title="Nova conta financeira"><View style={styles.form}><Field label="Nome" value={account.name} onChangeText={(name) => setAccount((v) => ({ ...v, name }))} /><Field label="Tipo" value={account.type} onChangeText={(type) => setAccount((v) => ({ ...v, type }))} /><Field label="Saldo inicial" value={account.initialBalance} numeric onChangeText={(initialBalance) => setAccount((v) => ({ ...v, initialBalance }))} /></View><Button label="Criar conta" disabled={saving || !account.name.trim()} onPress={() => void mutate(() => api('/financial/accounts', undefined, { method: 'POST', body: JSON.stringify({ name: account.name.trim(), type: account.type.trim(), initialBalance: Number(account.initialBalance) || 0 }) }), () => setAccount({ name: '', type: 'CASH', initialBalance: '0' }))} /></Section></View><View style={styles.compactPane}><Section compact title="Plano do aluno"><Chips rows={students} selected={selectedFinancialStudent} onSelect={setSelectedFinancialStudent} /><View style={styles.form}><Field label="Plano" value={studentPlan.planName} onChangeText={(planName) => setStudentPlan((v) => ({ ...v, planName }))} /><Field label="Valor" value={studentPlan.amount} numeric onChangeText={(amount) => setStudentPlan((v) => ({ ...v, amount }))} /><Field label="Próxima cobrança" value={studentPlan.nextBillingAt} onChangeText={(nextBillingAt) => setStudentPlan((v) => ({ ...v, nextBillingAt }))} /></View><Button label="Criar assinatura do aluno" disabled={saving || !selectedFinancialStudent || !studentPlan.planName.trim() || !studentPlan.amount.trim() || !Number.isInteger(Number(studentPlan.amount))} onPress={() => void mutate(() => api('/financial/subscriptions', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, planName: studentPlan.planName.trim(), amount: Number(studentPlan.amount), ...(studentPlan.nextBillingAt.trim() ? { nextBillingAt: studentPlan.nextBillingAt.trim() } : {}) }) }))} /></Section></View><View style={styles.compactPane}><Section compact title="Cobrança do aluno"><Chips rows={students} selected={selectedFinancialStudent} onSelect={setSelectedFinancialStudent} /><View style={styles.form}><Field label="Valor" value={charge.amount} numeric onChangeText={(amount) => setCharge((v) => ({ ...v, amount }))} /><Field label="Vencimento" value={charge.dueDate} onChangeText={(dueDate) => setCharge((v) => ({ ...v, dueDate }))} /><Field label="Meio de pagamento" value={charge.paymentMethod} onChangeText={(paymentMethod) => setCharge((v) => ({ ...v, paymentMethod }))} /></View><Button label="Criar cobrança" disabled={saving || !selectedFinancialStudent || !charge.amount.trim() || !Number.isInteger(Number(charge.amount)) || !charge.dueDate.trim()} onPress={() => void mutate(() => api('/financial/charges', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, amount: Number(charge.amount), dueDate: charge.dueDate.trim(), ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /></Section></View></View><View style={styles.compactGrid}><View style={styles.compactPaneWide}><Section compact title="Contas"><Chips rows={accounts} selected={selectedAccount} onSelect={setSelectedAccount} /><Data value={accounts} /></Section></View><View style={styles.compactPaneWide}><Section compact title="Cobranças">{charges.length ? charges.map((item: any) => <View key={item.id} style={styles.row}><Text style={styles.rowTitle}>{item.student?.user?.name ?? item.studentId ?? item.id}</Text><Text style={styles.muted}>Situação: {item.status} · Valor: {item.amount} · Vencimento: {String(item.dueDate ?? '—')}</Text>{item.status !== 'PAID' ? <Button label="Marcar como paga" disabled={saving || !selectedAccount} onPress={() => void mutate(() => api(`/financial/charges/${item.id}/pay`, undefined, { method: 'PATCH', body: JSON.stringify({ accountId: selectedAccount, ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /> : null}</View>) : <Text style={styles.muted}>Nenhuma cobrança.</Text>}</Section></View></View></>;
  }
  function entitlementsView() {
    const features = list(data.features);
    const configure = (feature: any) => {
      const raw = (configDraft[feature.featureKey] ?? '').trim();
      if (feature.kind === 'FEATURE') return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ featureEnabled: false }) }));
      if (feature.kind === 'LIMIT') { const limitValue = Number(raw); if (!raw || !Number.isInteger(limitValue) || limitValue < 0) { setError('Informe limite inteiro não negativo.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ limitValue }) })); }
      const policyValues = raw.split(',').map((value) => value.trim()).filter(Boolean); if (!policyValues.length) { setError('Informe as regras separadas por vírgula.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ policyValues }) }));
    };
    return <><Section title="Assinatura atual do IRON"><Data value={data.subscription ? [data.subscription] : []} /></Section><Section title="Recursos e configurações" subtitle="Personalize os recursos disponíveis no plano da sua academia.">{features.map((feature: any) => <View key={feature.featureKey} style={styles.row}><Text style={styles.rowTitle}>{featureLabel(feature.featureKey)}</Text><Text style={styles.muted}>Tipo: {entitlementKindLabels[feature.kind] ?? feature.kind} · Estado: {entitlementValueText(feature.value)} · Origem: {entitlementSourceLabels[feature.source] ?? feature.source ?? '—'} {feature.reason ? `· ${feature.reason}` : ''}</Text>{feature.kind !== 'FEATURE' ? <Field label={feature.kind === 'LIMIT' ? 'Novo limite' : 'Regras separadas por vírgula'} value={configDraft[feature.featureKey] ?? ''} onChangeText={(value) => setConfigDraft((current) => ({ ...current, [feature.featureKey]: value }))} /> : null}<View style={styles.actions}><Button label={feature.kind === 'FEATURE' ? 'Desativar para a academia' : 'Aplicar configuração'} disabled={saving || feature.source === 'FAIL_CLOSED_DEFAULT'} onPress={() => { void configure(feature); }} /><Button secondary label="Herdar do plano" disabled={saving} onPress={() => void mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'DELETE' }))} /></View></View>)}</Section><Section title="Configurações da academia"><Data value={data.configurations} /></Section></>;
  }
  function creatorView() {
    return <View style={styles.creatorWrap}><Text style={styles.moduleIntro}>Conteúdo, utilização e desempenho da rede de criadores vinculada à sua academia.</Text><View style={styles.creatorGrid}><View style={styles.creatorPane}><Section compact title="Visão geral" subtitle="Resumo operacional da rede de criadores."><Data value={data.overview ? [data.overview] : []} /></Section></View><View style={styles.creatorPane}><Section compact title="Conteúdo" subtitle="Materiais disponíveis para utilização na academia."><Data value={data.items} /></Section></View><View style={styles.creatorPane}><Section compact title="Indicadores" subtitle="Desempenho dos últimos 30 dias."><Data value={data.analytics ? [data.analytics] : []} /></Section></View></View></View>;
  }
  function content() {
    if (isRestrictedAdminModule(active) && !adminStepUpActive) return adminGateView();
    if (active === 'overview') return overview(); if (active === 'onboarding') return onboardingView(); if (active === 'students') return studentsView(); if (active === 'team') return teamView(); if (active === 'equipment') return equipmentView(); if (active === 'exercises') return exercisesView(); if (active === 'assessments') return assessmentsView(); if (active === 'workouts') return workoutsView(); if (active === 'schedule') return scheduleView(); if (active === 'access') return accessView(); if (active === 'financial') return financialView(); if (active === 'saasBilling') return <SaasBillingPanel onCommercialStateChanged={loadShell} />; if (active === 'security') return <AccountSecurityPanel />; if (active === 'entitlements') return entitlementsView(); if (active === 'integrations') return <IntegrationCredentialsPanel />; return creatorView();
  }

  const topBar = <View style={styles.top}><IronBrand compact /><View style={styles.actions}><Text style={styles.muted}>{profile?.name ?? profile?.email ?? 'Usuário'}</Text><Button testID="commercial-logout" secondary label="Sair" onPress={() => { void logout(); }} /></View></View>;
  if (!shellReady) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={styles.contentInner}>{error ? <Text style={styles.error}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#2f91ff" /><Text style={styles.muted}>Preparando sua academia…</Text></View>}</View></View>;
  if (blocked) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <React.Fragment key={item.key}>{!compact && item.key === 'financial' ? <Text style={styles.navSection}>ADMINISTRAÇÃO RESTRITA</Text> : null}<TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#dbeafe' : '#9fb0c5'} /><Text style={styles.navText}>{item.label}</Text></TouchableOpacity></React.Fragment>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.warning} testID="subscription-blocked"><Text style={styles.warningTitle}>Acesso comercial limitado</Text><Text style={styles.muted}>Seu acesso operacional está limitado. Consulte sua assinatura para regularizar o acesso. A segurança da conta continua disponível.</Text></View><Section title="Estado comercial"><Data value={[{ trialStatus: trial?.status ?? null, subscriptionStatus: subscription?.status ?? null, subscriptionId: subscription?.id ?? null }]} /></Section>{active === 'security' ? <AccountSecurityPanel /> : <SaasBillingPanel onCommercialStateChanged={loadShell} />}</ScrollView></View></View>;
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
  compactPane: { flexGrow: 1, flexBasis: 330, minWidth: 300 },
  compactPaneWide: { flexGrow: 1, flexBasis: 480, minWidth: 360 },
  creatorWrap: { width: '100%', alignSelf: 'center' },
  moduleIntro: { color: '#9fb0c5', fontSize: 12, lineHeight: 17, marginBottom: 7 },
  creatorGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  creatorPane: { flexGrow: 1, flexBasis: 300, minWidth: 270 },
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
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  buttonWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 11, marginTop: 4 },
  secondary: { backgroundColor: '#111a29', borderWidth: 1, borderColor: '#2a3b52' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonHint: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 360 },
  helper: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 6 },
  disabled: { opacity: 0.42 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  chip: { borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#090f1a' },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#d5deea', fontSize: 12 },
  invite: { backgroundColor: '#08271c', borderWidth: 1, borderColor: '#145c3c', borderRadius: 13, padding: 14, marginTop: 13 },
  warning: { margin: 12, padding: 14, borderRadius: 13, backgroundColor: '#241b08', borderWidth: 1, borderColor: '#76591b' },
  warningTitle: { color: '#fbbf24', fontWeight: '800' },
  error: { color: '#fecaca', backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#5b2028', padding: 11, borderRadius: 10, marginBottom: 11 },
  success: { color: '#4ade80', fontWeight: '700' },
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 9 },
});
