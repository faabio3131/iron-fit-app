import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AccountSecurityPanel } from '../components/AccountSecurityPanel';
import { SaasBillingPanel } from '../components/SaasBillingPanel';
import { IntegrationCredentialsPanel } from '../components/IntegrationCredentialsPanel';
import { CommunicationCenterPanel } from '../components/CommunicationCenterPanel';
import { Student360Panel } from '../components/Student360Panel';
import { AssessmentEvolutionPanel } from '../components/AssessmentEvolutionPanel';
import { EquipmentIntelligencePanel } from '../components/EquipmentIntelligencePanel';
import { ExercisesLibraryPanel } from '../components/ExercisesLibraryPanel';
import { TeamManagementPanel } from '../components/TeamManagementPanel';
import { WorkoutComposer } from '../components/WorkoutComposer';
import { ScheduleCalendarPanel } from '../components/ScheduleCalendarPanel';
import { AccessCenterPanel } from '../components/AccessCenterPanel';
import { OperationsCockpitPanel, type CockpitShortcut } from '../components/OperationsCockpitPanel';
import { PrivacyCenterPanel } from '../components/PrivacyCenterPanel';
import { IronIntelligencePanel } from '../components/IronIntelligencePanel';
import { AggregatorHubPanel } from '../components/AggregatorHubPanel';
import { GlowCard } from '../components/GlowCard';
import { CreatorNetworkWorkspace } from '../components/CreatorNetworkWorkspace';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type ModuleKey = 'overview' | 'onboarding' | 'students' | 'team' | 'equipment' | 'exercises' | 'assessments' | 'workouts' | 'intelligence' | 'aggregator' | 'schedule' | 'access' | 'communication' | 'financial' | 'saasBilling' | 'security' | 'privacy' | 'entitlements' | 'integrations' | 'creator';
type Entitlement = { featureKey: string; kind: 'FEATURE' | 'LIMIT' | 'POLICY'; value: boolean | number | string[] | null; source?: string; reason?: string | null };
type ModuleDefinition = { key: ModuleKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; roles?: string[]; entitlement?: string[] };
const restrictedAdminModules: ModuleKey[] = ['financial', 'saasBilling', 'entitlements', 'integrations'];

const operational = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION'];
const staff = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION', 'TRAINER'];
const modules: ModuleDefinition[] = [
  { key: 'overview', label: 'Visão geral', icon: 'grid-outline', roles: operational },
  { key: 'onboarding', label: 'Onboarding', icon: 'rocket-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'students', label: 'Alunos', icon: 'people-outline', roles: staff },
  { key: 'team', label: 'Equipe', icon: 'shield-checkmark-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] },
  { key: 'equipment', label: 'Equipamentos', icon: 'barbell-outline', roles: staff, entitlement: ['equipment.catalog', 'equipment.inventory'] },
  { key: 'exercises', label: 'Exercícios', icon: 'fitness-outline', roles: staff },
  { key: 'assessments', label: 'Avaliações', icon: 'pulse-outline', roles: staff },
  { key: 'workouts', label: 'Treinos', icon: 'clipboard-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'] },
  { key: 'intelligence', label: 'IRON Intelligence', icon: 'sparkles-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'], entitlement: ['ai.workout_generation'] },
  { key: 'aggregator', label: 'Aggregator Hub', icon: 'git-merge-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION'] },
  { key: 'schedule', label: 'Agenda', icon: 'calendar-outline', roles: staff },
  { key: 'access', label: 'Acessos', icon: 'key-outline', roles: operational },
  { key: 'communication', label: 'Comunicação', icon: 'chatbubbles-outline', roles: operational },
  { key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'saasBilling', label: 'Assinatura IRON', icon: 'card-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'security', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { key: 'privacy', label: 'Privacidade', icon: 'document-text-outline' },
  { key: 'entitlements', label: 'Plano e configurações', icon: 'layers-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'integrations', label: 'Integrações', icon: 'git-network-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'creator', label: 'Rede de Criadores', icon: 'images-outline', roles: ['OWNER', 'MANAGER'], entitlement: ['content.external_youtube', 'content.iron_managed', 'content.tenant_private'] },
];
const onboardingLabels: Record<string, string> = { ACADEMY_PROFILE: 'Perfil da academia', EQUIPMENT_INVENTORY: 'Inventário de equipamentos', TEAM_REVIEW: 'Revisão da equipe', FINISH: 'Finalizar onboarding' };

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
const HIDDEN_FIELD_KEYS = ['passwordHash', 'refreshTokenHash', 'id'];
function humanizeFieldKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('pt-BR');
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    if (value.every((item) => item === null || typeof item !== 'object')) return value.join(', ');
    return `${value.length} registro(s)`;
  }
  if (typeof value === 'object') return Object.keys(value as object).length ? 'Ver detalhes' : '—';
  return String(value);
}
function Field({ label, value, onChangeText, secureTextEntry, numeric }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; numeric?: boolean }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={numeric ? 'numeric' : 'default'} placeholderTextColor="#64748b" /></View>;
}
function Button({ label, onPress, disabled, secondary, testID }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; testID?: string }) {
  return <TouchableOpacity testID={testID} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={[styles.buttonText, !secondary && styles.buttonTextOnAccent]}>{label}</Text></TouchableOpacity>;
}
function Section({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <GlowCard style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </GlowCard>
  );
}
function Data({ value, empty = 'Nenhum registro encontrado.' }: { value: any; empty?: string }) {
  const rows = list(value);
  if (!rows.length) return <Text style={styles.muted}>{empty}</Text>;
  return (
    <View style={styles.rowList}>
      {rows.map((row, index) => {
        const titleKey = row?.name !== undefined ? 'name' : row?.email !== undefined ? 'email' : row?.description !== undefined ? 'description' : null;
        const title = row?.[titleKey as string] ?? row?.id ?? `Registro ${index + 1}`;
        const entries = Object.entries(row ?? {}).filter(([key]) => key !== titleKey && !HIDDEN_FIELD_KEYS.includes(key));
        return (
          <GlowCard key={String(row?.id ?? index)} style={styles.row}>
            <Text style={styles.rowTitle}>{String(title)}</Text>
            {entries.length ? (
              <View style={styles.rowFields}>
                {entries.map(([key, fieldValue]) => (
                  <View key={key} style={styles.rowField}>
                    <Text style={styles.rowFieldLabel}>{humanizeFieldKey(key)}</Text>
                    <Text style={styles.rowFieldValue}>{formatFieldValue(fieldValue)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </GlowCard>
        );
      })}
    </View>
  );
}
function Chips({ rows, selected, onSelect }: { rows: any[]; selected: string; onSelect: (id: string) => void }) {
  return <View style={styles.chips}>{rows.map((row) => <TouchableOpacity key={row.id} style={[styles.chip, selected === row.id && styles.chipActive]} onPress={() => onSelect(row.id)}><Text style={[styles.chipText, selected === row.id && styles.chipTextActive]}>{row.name ?? row.user?.name ?? row.id}</Text></TouchableOpacity>)}</View>;
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
  const [selectedCatalogEquipment, setSelectedCatalogEquipment] = useState('');
  const [exercise, setExercise] = useState({ name: '', muscleGroup: '', level: '' });
  const [assessment, setAssessment] = useState({ weight: '', height: '', bodyFatPercent: '', notes: '' });
  const [schedule, setSchedule] = useState({ weekday: '1', startTime: '08:00', endTime: '09:00', capacity: '10' });
  const [account, setAccount] = useState({ name: '', type: 'CASH', initialBalance: '0' });
  const [studentPlan, setStudentPlan] = useState({ planName: '', amount: '', nextBillingAt: '' });
  const [charge, setCharge] = useState({ amount: '', dueDate: '', paymentMethod: '' });
  const [academy, setAcademy] = useState({ name: '', timezone: 'America/Sao_Paulo' });
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [reviewWorkoutId, setReviewWorkoutId] = useState<string | null>(null);
  const [selectedScheduleStudent, setSelectedScheduleStudent] = useState('');
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
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
      can('SUPER_ADMIN', 'OWNER')
        ? api('/auth/step-up/status').catch(() => ({ active: false, expiresAt: null }))
        : Promise.resolve({ active: false, expiresAt: null }),
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
      if (key === 'assessments') next.students = await api('/students');
      if (key === 'workouts' || key === 'intelligence') { [next.workouts, next.students] = await Promise.all([api('/workouts'), api('/students')]); }
      if (key === 'schedule') { [next.slots, next.students] = await Promise.all([api('/schedule-slots'), api('/students')]); }
      if (key === 'access') { [next.events, next.students, next.credentials, next.devices] = await Promise.all([api('/access/events'), api('/students'), api('/access/credentials'), can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? api('/access/devices') : Promise.resolve([])]); }
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
    return <Section title="Acesso administrativo protegido" subtitle="Confirme sua identidade para entrar nesta área restrita. A autorização é temporária e vinculada à sessão atual."><View style={styles.adminGateIdentity}><Ionicons name="lock-closed-outline" size={24} color="#60a5fa" /><View><Text style={styles.rowTitle}>{profile?.name ?? 'Proprietário'}</Text><Text style={styles.muted}>{profile?.email ?? 'Conta administrativa'}</Text></View></View><View style={styles.form}><Field label="Senha atual" value={adminPassword} secureTextEntry onChangeText={setAdminPassword} />{profile?.mfaEnabled ? <Field label="Código MFA ou código de recuperação" value={adminSecondFactor} onChangeText={setAdminSecondFactor} /> : null}</View>{adminGateError ? <Text style={styles.error}>{adminGateError}</Text> : null}<Button testID="admin-step-up-submit" label={adminGateLoading ? 'Validando…' : 'Entrar na área administrativa'} disabled={adminGateLoading || !adminPassword.trim()} onPress={() => { void unlockAdministrativeArea(); }} /><Text style={styles.muted}>Por segurança, o acesso administrativo expira automaticamente após 15 minutos.</Text></Section>;
  }

  async function mutate(operation: () => Promise<unknown>, reset?: () => void) {
    setSaving(true); setError('');
    try { await operation(); reset?.(); await loadShell(); await loadModule(active); if (active === 'schedule') setScheduleRefresh((current) => current + 1); } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  }

  function overview() {
    const financialAuthorized = can('SUPER_ADMIN', 'OWNER') && adminStepUpActive;
    const eligibleShortcuts: CockpitShortcut[] = ['students', 'team', 'equipment', 'workouts', 'schedule', 'access', 'financial'];
    const authorizedShortcuts = eligibleShortcuts.filter((key) => visible.some((module) => module.key === key));
    return <OperationsCockpitPanel academyName={typeof data.gym?.name === 'string' ? data.gym.name : undefined}
      operatorName={profile?.name ?? profile?.email}
      summary={data.summary ?? null}
      attendance={Array.isArray(data.attendance) ? data.attendance : null}
      revenue={financialAuthorized && Array.isArray(data.revenue) ? data.revenue : null}
      overdue={financialAuthorized && Array.isArray(data.overdue) ? data.overdue : null}
      birthdays={Array.isArray(data.birthdays) ? data.birthdays : null}
      financialAuthorized={financialAuthorized}
      availableModules={authorizedShortcuts}
      onNavigate={(key) => setActive(key)}
      onRefresh={() => { void loadModule('overview'); }}
      refreshing={loading}
    />;
  }
  function onboardingView() {
    const step = onboarding?.nextStep as string | undefined;
    return <Section title="Onboarding zero-touch" subtitle="A ordem é autoridade do backend; o navegador não escolhe tenant nem pula etapas."><Data value={onboarding ? [onboarding] : []} />{step === 'ACADEMY_PROFILE' ? <View style={styles.form}><Field label="Nome da academia" value={academy.name} onChangeText={(name) => setAcademy((v) => ({ ...v, name }))} /><Field label="Timezone IANA" value={academy.timezone} onChangeText={(timezone) => setAcademy((v) => ({ ...v, timezone }))} /></View> : null}{step ? <Button testID="onboarding-complete-step" label={saving ? 'Salvando…' : `Concluir: ${onboardingLabels[step] ?? step}`} disabled={saving || (step === 'ACADEMY_PROFILE' && !academy.name.trim())} onPress={() => void mutate(() => api('/commercial/onboarding', undefined, { method: 'PATCH', body: JSON.stringify({ step, ...(step === 'ACADEMY_PROFILE' ? { data: { name: academy.name.trim(), timezone: academy.timezone.trim() } } : {}) }) }))} /> : <Text style={styles.success}>Onboarding concluído.</Text>}</Section>;
  }
  function studentsView() {
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Cadastrar aluno"><View style={styles.form}><Field label="Nome" value={student.name} onChangeText={(name) => setStudent((v) => ({ ...v, name }))} /><Field label="E-mail" value={student.email} onChangeText={(email) => setStudent((v) => ({ ...v, email }))} /><Field label="Telefone" value={student.phone} onChangeText={(phone) => setStudent((v) => ({ ...v, phone }))} /></View><Button testID="student-create" label="Cadastrar aluno" disabled={saving || !student.name.trim() || !student.email.trim()} onPress={() => void mutate(async () => { const created = await api('/students', undefined, { method: 'POST', body: JSON.stringify({ name: student.name.trim(), email: student.email.trim().toLowerCase(), ...(student.phone.trim() ? { phone: student.phone.trim() } : {}) }) }); setLastStudentInvite(created?.onboarding?.required ? created.onboarding : null); return created; }, () => setStudent({ name: '', email: '', phone: '' }))} />{lastStudentInvite ? <View style={styles.invite}><Text style={styles.rowTitle}>Convite de ativação — exibir uma vez</Text><Text selectable style={styles.json}>{lastStudentInvite.token}</Text><Text style={styles.muted}>Expira em: {String(lastStudentInvite.expiresAt ?? '—')}</Text></View> : null}</Section> : null}<Student360Panel key={activeTenantId ?? 'sem-academia'} students={list(data.students)} canReadWorkouts={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER')} canReadAccess={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')} canReadFinance={can('SUPER_ADMIN', 'OWNER') && adminStepUpActive} canEditConsents={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')} /></>;
  }
  function teamView() {
    return <TeamManagementPanel
      key={activeTenantId ?? 'sem-academia'}
      members={list(data.users)}
      actorRoles={roles}
      onUpdated={() => loadModule('team')}
    />;
  }
  function equipmentView() {
    return <EquipmentIntelligencePanel
      key={activeTenantId ?? 'sem-academia'}
      inventory={list(data.inventory)}
      catalog={list(data.catalog)}
      catalogEnabled={enabled('equipment.catalog')}
      canManage={enabled('equipment.inventory') && enabled('equipment.catalog') && can('SUPER_ADMIN', 'OWNER', 'MANAGER')}
      canSuggest={enabled('equipment.catalog') && can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER')}
      canGovern={can('SUPER_ADMIN')}
      onUpdated={() => loadModule('equipment')}
    />;
  }
  function exercisesView() {
    return <ExercisesLibraryPanel
      key={activeTenantId ?? 'sem-academia'}
      exercises={list(data.exercises)}
      canCreate={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER')}
      onUpdated={() => loadModule('exercises')}
    />;
  }
  function assessmentsView() {
    return <AssessmentEvolutionPanel key={activeTenantId ?? 'sem-academia'}
      students={list(data.students)}
      canCreate={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER')} />;
  }
  function workoutsView() {
    const students = list(data.students);
    const workouts = list(data.workouts);
    return <>
      <WorkoutComposer key={activeTenantId ?? 'sem-academia'} students={students}
        onUpdated={() => loadModule('workouts')} />
      <Section title="Treinos e revisão profissional"
        subtitle="Candidatos de IA e treinos manuais passam pela revisão humana. Examine sessões e exercícios antes de aprovar.">
        {workouts.length ? workouts.map((workout: any) => {
          const reviewing = reviewWorkoutId === workout.id;
          const eligible = workout.status === 'DRAFT' || workout.status === 'PENDING_REVIEW';
          return <View key={workout.id} style={styles.row}>
            <Text style={styles.rowTitle}>{workout.student?.user?.name ?? workout.goal ?? 'Treino'}</Text>
            <Text style={styles.muted}>Objetivo: {workout.goal ?? 'Não definido'} · Situação: {
              workout.status === 'DRAFT' ? 'Rascunho' : workout.status === 'PENDING_REVIEW' ?
                'Aguardando revisão humana' : workout.status === 'APPROVED' ? 'Aprovado' :
                  workout.status === 'ACTIVE' ? 'Ativo' : 'Finalizado'
            } · Origem: {workout.createdByAI ? 'Candidato IA' : 'Manual'}</Text>
            <Text style={styles.muted}>Sessões: {Array.isArray(workout.sessions) ? workout.sessions.length : 0}</Text>
            <Button testID={`workout-details-${workout.id}`} secondary
              label={reviewing ? 'Ocultar detalhes' : 'Revisar detalhes'} onPress={() => setReviewWorkoutId(reviewing ? null : workout.id)} />
            {reviewing ? <View style={styles.rowFields}>
              <Text style={styles.rowTitle}>Conteúdo para revisão profissional</Text>
              <Text style={styles.muted}>Nível: {workout.level ?? 'Não informado'} · Frequência: {workout.weeklyFrequency ?? '—'} vez(es) por semana</Text>
              {workout.notes ? <Text style={styles.muted}>Observações: {workout.notes}</Text> : null}
              {(Array.isArray(workout.sessions) ? workout.sessions : []).map((session: any) => <View key={session.id ?? session.order} style={styles.rowField}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{session.name ?? 'Sessão'}</Text>
                  {(Array.isArray(session.exercises) ? session.exercises : []).map((entry: any, index: number) =>
                    <Text key={entry.id ?? index} style={styles.muted}>{
                      entry.exercise?.name ?? 'Exercício'
                    } · {entry.sets ?? '—'} séries · {entry.reps ?? '—'} repetições · descanso {entry.restSeconds ?? '—'}s</Text>)}
                </View>
              </View>)}
              {eligible ? <View style={styles.actions}>
                <Text style={styles.muted}>Aprovar registra o profissional revisor na auditoria. A ativação é uma etapa distinta.</Text>
                <Button testID={`workout-review-confirm-${workout.id}`} label="Confirmar revisão e aprovação"
                  disabled={saving} onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, {
                    method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }),
                  }), () => setReviewWorkoutId(null))} />
              </View> : null}
            </View> : null}
            {eligible ? <Button testID={`workout-approve-${workout.id}`} label="Revisar antes de aprovar"
              disabled={saving} onPress={() => setReviewWorkoutId(workout.id)} /> : null}
            {workout.status === 'APPROVED' ? <Button testID={`workout-activate-${workout.id}`}
              secondary label="Ativar treino aprovado" disabled={saving}
              onPress={() => void mutate(() => api(`/workouts/${workout.id}/status`, undefined, {
                method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }),
              }))} /> : null}
          </View>;
        }) : <Text style={styles.muted}>Nenhum treino cadastrado.</Text>}
      </Section>
    </>;
  }
  function intelligenceView() {
    return <IronIntelligencePanel key={activeTenantId ?? 'sem-academia'}
      students={list(data.students)} workouts={list(data.workouts)}
      onUpdated={() => loadModule('intelligence')} />;
  }
  function scheduleView() {
    const students = list(data.students); const slots = list(data.slots);
    return <><ScheduleCalendarPanel key={activeTenantId ?? 'sem-academia'} slots={slots}
      canCheckIn={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')}
      onDateSelected={setBookingDate} refreshToken={scheduleRefresh} />{can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? <Section title="Criar horário"><View style={styles.form}><Field label="Dia 0-6" value={schedule.weekday} numeric onChangeText={(weekday) => setSchedule((v) => ({ ...v, weekday }))} /><Field label="Início" value={schedule.startTime} onChangeText={(startTime) => setSchedule((v) => ({ ...v, startTime }))} /><Field label="Fim" value={schedule.endTime} onChangeText={(endTime) => setSchedule((v) => ({ ...v, endTime }))} /><Field label="Capacidade" value={schedule.capacity} numeric onChangeText={(capacity) => setSchedule((v) => ({ ...v, capacity }))} /></View><Button label="Criar horário" disabled={saving} onPress={() => void mutate(() => api('/schedule-slots', undefined, { method: 'POST', body: JSON.stringify({ weekday: Number(schedule.weekday), startTime: schedule.startTime.trim(), endTime: schedule.endTime.trim(), capacity: Number(schedule.capacity), active: true }) }))} /></Section> : null}{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Agendar aluno e check-in" subtitle="O agendamento e o check-in são validados no tenant autenticado pelo backend."><Text style={styles.label}>Aluno</Text><Chips rows={students} selected={selectedScheduleStudent} onSelect={setSelectedScheduleStudent} /><Text style={styles.label}>Horário</Text><Chips rows={slots} selected={selectedScheduleSlot} onSelect={setSelectedScheduleSlot} /><Field label="Data ISO" value={bookingDate} onChangeText={setBookingDate} /><Button testID="schedule-book" label="Agendar aluno" disabled={saving || !selectedScheduleStudent || !selectedScheduleSlot || !bookingDate.trim()} onPress={() => void mutate(async () => { const created = await api('/schedules', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedScheduleStudent, slotId: selectedScheduleSlot, date: bookingDate.trim() }) }); setLastBooking(created); return created; })} />{lastBooking?.id ? <View style={styles.invite}><Text style={styles.rowTitle}>Agendamento criado</Text><Text style={styles.muted}>ID: {lastBooking.id}</Text><Button secondary testID="schedule-check-in" label="Registrar check-in" disabled={saving} onPress={() => void mutate(() => api(`/schedules/${lastBooking.id}/check-in`, undefined, { method: 'PATCH' }), () => setLastBooking(null))} /></View> : null}</Section> : null}</>;
  }
  function accessView() {
    return <AccessCenterPanel key={activeTenantId ?? 'sem-academia'}
      students={list(data.students)}
      credentials={list(data.credentials)}
      events={list(data.events)}
      devices={list(data.devices)}
      canManageDevices={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}
      onUpdated={() => loadModule('access')}
    />;
  }
  function financialView() {
    const students = list(data.students); const accounts = list(data.accounts); const charges = list(data.charges);
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER') ? <Section title="Nova conta financeira"><View style={styles.form}><Field label="Nome" value={account.name} onChangeText={(name) => setAccount((v) => ({ ...v, name }))} /><Field label="Tipo" value={account.type} onChangeText={(type) => setAccount((v) => ({ ...v, type }))} /><Field label="Saldo inicial" value={account.initialBalance} numeric onChangeText={(initialBalance) => setAccount((v) => ({ ...v, initialBalance }))} /></View><Button label="Criar conta" disabled={saving || !account.name.trim()} onPress={() => void mutate(() => api('/financial/accounts', undefined, { method: 'POST', body: JSON.stringify({ name: account.name.trim(), type: account.type.trim(), initialBalance: Number(account.initialBalance) || 0 }) }), () => setAccount({ name: '', type: 'CASH', initialBalance: '0' }))} /></Section> : null}<Section title="Plano e cobrança do aluno" subtitle="Este fluxo é academia → aluno; billing SaaS FM → academia pertence ao bloco seguinte."><Chips rows={students} selected={selectedFinancialStudent} onSelect={setSelectedFinancialStudent} /><View style={styles.form}><Field label="Plano do aluno" value={studentPlan.planName} onChangeText={(planName) => setStudentPlan((v) => ({ ...v, planName }))} /><Field label="Valor" value={studentPlan.amount} numeric onChangeText={(amount) => setStudentPlan((v) => ({ ...v, amount }))} /><Field label="Próxima cobrança ISO" value={studentPlan.nextBillingAt} onChangeText={(nextBillingAt) => setStudentPlan((v) => ({ ...v, nextBillingAt }))} /></View><Button label="Criar assinatura do aluno" disabled={saving || !selectedFinancialStudent || !studentPlan.planName.trim() || !studentPlan.amount.trim() || !Number.isInteger(Number(studentPlan.amount))} onPress={() => void mutate(() => api('/financial/subscriptions', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, planName: studentPlan.planName.trim(), amount: Number(studentPlan.amount), ...(studentPlan.nextBillingAt.trim() ? { nextBillingAt: studentPlan.nextBillingAt.trim() } : {}) }) }))} /><View style={styles.form}><Field label="Valor da cobrança" value={charge.amount} numeric onChangeText={(amount) => setCharge((v) => ({ ...v, amount }))} /><Field label="Vencimento ISO" value={charge.dueDate} onChangeText={(dueDate) => setCharge((v) => ({ ...v, dueDate }))} /><Field label="Meio de pagamento" value={charge.paymentMethod} onChangeText={(paymentMethod) => setCharge((v) => ({ ...v, paymentMethod }))} /></View><Button secondary label="Criar cobrança" disabled={saving || !selectedFinancialStudent || !charge.amount.trim() || !Number.isInteger(Number(charge.amount)) || !charge.dueDate.trim()} onPress={() => void mutate(() => api('/financial/charges', undefined, { method: 'POST', body: JSON.stringify({ studentId: selectedFinancialStudent, amount: Number(charge.amount), dueDate: charge.dueDate.trim(), ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /></Section><Section title="Contas"><Chips rows={accounts} selected={selectedAccount} onSelect={setSelectedAccount} /><Data value={accounts} /></Section><Section title="Cobranças">{charges.length ? charges.map((item: any) => <View key={item.id} style={styles.row}><Text style={styles.rowTitle}>{item.student?.user?.name ?? item.studentId ?? item.id}</Text><Text style={styles.muted}>Status: {item.status} · Valor: {item.amount} · Vencimento: {String(item.dueDate ?? '—')}</Text>{item.status !== 'PAID' ? <Button label="Marcar como paga" disabled={saving || !selectedAccount} onPress={() => void mutate(() => api(`/financial/charges/${item.id}/pay`, undefined, { method: 'PATCH', body: JSON.stringify({ accountId: selectedAccount, ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}) }) }))} /> : null}</View>) : <Text style={styles.muted}>Nenhuma cobrança.</Text>}</Section></>;
  }
  function entitlementsView() {
    const features = list(data.features);
    const configure = (feature: any) => {
      const raw = (configDraft[feature.featureKey] ?? '').trim();
      if (feature.kind === 'FEATURE') return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ featureEnabled: false }) }));
      if (feature.kind === 'LIMIT') { const limitValue = Number(raw); if (!raw || !Number.isInteger(limitValue) || limitValue < 0) { setError('Informe limite inteiro não negativo.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ limitValue }) })); }
      const policyValues = raw.split(',').map((value) => value.trim()).filter(Boolean); if (!policyValues.length) { setError('Informe valores de policy separados por vírgula.'); return Promise.resolve(); } return mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'PUT', body: JSON.stringify({ policyValues }) }));
    };
    return <><Section title="Assinatura SaaS atual"><Data value={data.subscription ? [data.subscription] : []} /></Section><Section title="Capabilities e configurações" subtitle="Configurações só podem estreitar o plano efetivo; o backend permanece autoridade.">{features.map((feature: any) => <View key={feature.featureKey} style={styles.row}><Text style={styles.rowTitle}>{feature.featureKey}</Text><Text style={styles.muted}>Tipo: {feature.kind} · Efetivo: {JSON.stringify(feature.value)} · Fonte: {feature.source ?? '—'} {feature.reason ? `· ${feature.reason}` : ''}</Text>{feature.kind !== 'FEATURE' ? <Field label={feature.kind === 'LIMIT' ? 'Novo limite' : 'Policies separadas por vírgula'} value={configDraft[feature.featureKey] ?? ''} onChangeText={(value) => setConfigDraft((current) => ({ ...current, [feature.featureKey]: value }))} /> : null}<View style={styles.actions}><Button label={feature.kind === 'FEATURE' ? 'Desativar no tenant' : 'Aplicar configuração'} disabled={saving || feature.source === 'FAIL_CLOSED_DEFAULT'} onPress={() => { void configure(feature); }} /><Button secondary label="Herdar do plano" disabled={saving} onPress={() => void mutate(() => api(`/product-entitlements/tenant/configurations/${feature.featureKey}`, undefined, { method: 'DELETE' }))} /></View></View>)}</Section><Section title="Configurações persistidas"><Data value={data.configurations} /></Section></>;
  }
  function content() {
    if (isRestrictedAdminModule(active) && !adminStepUpActive) return adminGateView();
    if (active === 'overview') return overview(); if (active === 'onboarding') return onboardingView(); if (active === 'students') return studentsView(); if (active === 'team') return teamView(); if (active === 'equipment') return equipmentView(); if (active === 'exercises') return exercisesView(); if (active === 'assessments') return assessmentsView(); if (active === 'workouts') return workoutsView(); if (active === 'intelligence') return intelligenceView(); if (active === 'aggregator') return <AggregatorHubPanel key={activeTenantId ?? 'sem-academia'} canManage={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} />; if (active === 'schedule') return scheduleView(); if (active === 'access') return accessView(); if (active === 'communication') return <CommunicationCenterPanel canManageAutomations={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} />; if (active === 'financial') return financialView(); if (active === 'saasBilling') return <SaasBillingPanel onCommercialStateChanged={loadShell} />; if (active === 'security') return <AccountSecurityPanel />; if (active === 'privacy') return <PrivacyCenterPanel key={activeTenantId ?? 'sem-academia'} />; if (active === 'entitlements') return entitlementsView(); if (active === 'integrations') return <IntegrationCredentialsPanel />; return <CreatorNetworkWorkspace key={activeTenantId ?? 'sem-academia'}
      items={list(data.items)} overview={data.overview ?? null} analytics={data.analytics ?? null}
      refreshing={loading} onRefresh={() => { void loadModule('creator'); }} />;
  }

  const topBar = <View style={styles.top}><View><Text style={styles.brand}>IRON</Text><Text style={styles.muted}>Gestão da academia</Text></View><View style={styles.actions}><Text style={styles.muted}>{profile?.name ?? profile?.email ?? 'Usuário'}</Text><Button testID="commercial-logout" secondary label="Sair" onPress={() => { void logout(); }} /></View></View>;
  if (!shellReady) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={styles.contentInner}>{error ? <Text style={styles.error}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Validando assinatura, trial e capabilities…</Text></View>}</View></View>;
  if (blocked) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#2BF47A' : '#94a3b8'} /><Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.warning} testID="subscription-blocked"><Text style={styles.warningTitle}>Acesso comercial limitado</Text><Text style={styles.muted}>Trial expirado, assinatura inativa/ausente ou suspensa. A superfície operacional permanece fail-closed. Assinatura IRON e Segurança continuam disponíveis para recuperação.</Text></View><Section title="Estado comercial"><Text style={styles.muted}>Avaliação: {trial?.status === 'EXPIRED' ? 'Expirada' : trial?.status === 'INACTIVE' ? 'Inativa' : trial?.status === 'TRIALING' ? 'Em andamento' : 'Situação não confirmada'}</Text><Text style={styles.muted}>Assinatura: {subscription?.status === 'SUSPENDED' ? 'Suspensa' : subscription?.status === 'CANCELED' ? 'Cancelada' : subscription?.status === 'ACTIVE' ? 'Ativa' : 'Situação não confirmada'}</Text></Section>{active === 'security' ? <AccountSecurityPanel /> : active === 'privacy' ? <PrivacyCenterPanel key={activeTenantId ?? 'sem-academia'} /> : active === 'saasBilling' && can('SUPER_ADMIN', 'OWNER') ? (adminStepUpActive ? <SaasBillingPanel onCommercialStateChanged={loadShell} /> : adminGateView()) : <Section title="Recuperação de acesso" subtitle="Selecione Segurança, Privacidade ou Assinatura IRON nas áreas permitidas ao seu perfil."><Text style={styles.muted}>A operação da academia permanece bloqueada até o backend confirmar a situação comercial.</Text></Section>}</ScrollView></View></View>;
  return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#2BF47A' : '#94a3b8'} /><Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.pageHead}><View><Text style={styles.title}>{modules.find((item) => item.key === active)?.label}</Text><Text style={styles.muted}>Tenant derivado da sessão autenticada · {activeTenantId ?? 'sem tenant ativo'}</Text></View><Button secondary label="Atualizar" onPress={() => { void loadModule(active); }} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Carregando dados canônicos…</Text></View> : content()}</ScrollView></View></View>;
}

const styles = StyleSheet.create({
  adminGateIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  app: { flex: 1, backgroundColor: '#080c17' },
  top: { minHeight: 72, padding: 18, backgroundColor: '#101625', borderBottomWidth: 1, borderBottomColor: '#273248', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  body: { flex: 1, flexDirection: 'row' },
  bodyCompact: { flexDirection: 'column' },
  nav: { width: 240, backgroundColor: '#0d1321', paddingVertical: 10 },
  navCompact: { width: '100%', maxHeight: 72 },
  navHorizontal: { alignItems: 'center' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, margin: 4, borderRadius: 9 },
  navActive: { backgroundColor: '#0f2a1c' },
  navText: { color: '#cbd5e1', fontWeight: '600' },
  navTextActive: { color: '#2BF47A' },
  content: { flex: 1 },
  contentInner: { padding: 22, width: '100%', maxWidth: 1400, alignSelf: 'center' },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800' },

  // Blocos/seções: a borda e o brilho no hover vêm do GlowCard; aqui só
  // o espaçamento interno e o título em verde (identidade do produto).
  section: { padding: 16, marginBottom: 12 },
  sectionTitle: { color: '#2BF47A', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sectionBody: { marginTop: 8 },

  // Linha de registro (era JSON cru; agora campo a campo, legível)
  rowList: { gap: 8 },
  row: { padding: 12, marginBottom: 0 },
  rowTitle: { color: '#f1f5f9', fontWeight: '700', marginBottom: 4 },
  rowFields: { marginTop: 6, gap: 4 },
  rowField: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 2 },
  rowFieldLabel: { color: '#94a3b8', fontSize: 12 },
  rowFieldValue: { color: '#e2e8f0', fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  json: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },

  muted: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginVertical: 10 },
  fieldWrap: { minWidth: 180, flexGrow: 1, flexBasis: 210 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  input: { color: '#f8fafc', backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#2a3650', borderRadius: 9, padding: 10 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2BF47A', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, marginTop: 4 },
  secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonTextOnAccent: { color: '#04140b' },
  disabled: { opacity: 0.45 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: '#123524', borderColor: '#2BF47A' },
  chipText: { color: '#cbd5e1', fontSize: 12 },
  chipTextActive: { color: '#2BF47A', fontWeight: '700' },
  invite: { backgroundColor: '#0b2a1e', borderWidth: 1, borderColor: '#14532d', borderRadius: 10, padding: 12, marginTop: 12 },
  warning: { margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#261c08', borderWidth: 1, borderColor: '#7c5b16' },
  warningTitle: { color: '#fbbf24', fontWeight: '800' },
  error: { color: '#fca5a5', backgroundColor: '#301215', padding: 10, borderRadius: 8, marginBottom: 10 },
  success: { color: '#4ade80', fontWeight: '700' },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
