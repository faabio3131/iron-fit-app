import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AccountSecurityPanel } from '../components/AccountSecurityPanel';
import { IronBrand } from '../components/IronBrand';
import { PASSWORD_POLICY_TEXT } from '../security/password-policy';
import { SaasBillingPanel } from '../components/SaasBillingPanel';
import { IntegrationCredentialsPanel } from '../components/IntegrationCredentialsPanel';
import { CommunicationCenterPanel } from '../components/CommunicationCenterPanel';
import { CommunicationCenter } from './CommunicationCenter';
import { Student360Panel } from '../components/Student360Panel';
import { AssessmentEvolutionPanel } from '../components/AssessmentEvolutionPanel';
import { EquipmentIntelligencePanel } from '../components/EquipmentIntelligencePanel';
import { ExercisesLibraryPanel } from '../components/ExercisesLibraryPanel';
import { TeamManagementPanel } from '../components/TeamManagementPanel';
import { WorkoutComposer } from '../components/WorkoutComposer';
import { ScheduleCalendarPanel } from '../components/ScheduleCalendarPanel';
import { ScheduleManagementPanel } from '../components/ScheduleManagementPanel';
import { AccessCenterPanel } from '../components/AccessCenterPanel';
import { OperationsCockpitPanel, type CockpitShortcut } from '../components/OperationsCockpitPanel';
import { OnboardingWorkspace } from '../components/OnboardingWorkspace';
import { AcademyChargesPanel } from '../components/AcademyChargesPanel';
import { PrivacyCenter } from './PrivacyCenter';
import { IronIntelligencePanel } from '../components/IronIntelligencePanel';
import { AggregatorHubPanel } from '../components/AggregatorHubPanel';
import { GlowCard } from '../components/GlowCard';
import { CreatorNetworkWorkspace } from './CreatorNetworkWorkspace';
import { ScheduleWorkspace } from './ScheduleWorkspace';
import { AccessCenterWorkspace } from './AccessCenterWorkspace';
import { FinancialWorkspace } from './FinancialWorkspace';
import { EntitlementsWorkspace } from './EntitlementsWorkspace';
import { FiscalCenter } from './FiscalCenter';
import { useAuth } from '../context/AuthContext';
import { brlFromMinor, brlToMinor, positiveBrlToMinor } from '../utils/academy-money';
import { api } from '../services/api';
import { ManagerAlertBell, ManagerAlertsPanel } from '../components/ManagerAlertsPanel';
import { PlatformAdminWorkspace } from './PlatformAdminWorkspace';

type ModuleKey = 'overview' | 'alerts' | 'onboarding' | 'students' | 'team' | 'equipment' | 'exercises' | 'assessments' | 'workouts' | 'intelligence' | 'aggregator' | 'schedule' | 'access' | 'communication' | 'financial' | 'fiscal' | 'saasBilling' | 'security' | 'privacy' | 'entitlements' | 'integrations' | 'creator';
type Entitlement = { featureKey: string; kind: 'FEATURE' | 'LIMIT' | 'POLICY'; value: boolean | number | string[] | null; source?: string; reason?: string | null };
type ModuleDefinition = { key: ModuleKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; roles?: string[]; entitlement?: string[] };
const restrictedAdminModules: ModuleKey[] = ['financial', 'fiscal', 'saasBilling', 'entitlements', 'integrations'];
// Missing or unspecified grants must never unlock a feature.
const FAIL_CLOSED_DEFAULT = false;

const operational = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION'];
const staff = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION', 'TRAINER'];
const modules: ModuleDefinition[] = [
  { key: 'overview', label: 'Visão geral', icon: 'grid-outline', roles: operational },
  { key: 'alerts', label: 'Alertas', icon: 'notifications-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'onboarding', label: 'Configuração inicial', icon: 'rocket-outline', roles: ['OWNER', 'MANAGER'] },
  { key: 'students', label: 'Alunos', icon: 'people-outline', roles: staff },
  { key: 'team', label: 'Equipe', icon: 'shield-checkmark-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER'] },
  { key: 'equipment', label: 'Equipamentos', icon: 'barbell-outline', roles: staff, entitlement: ['equipment.catalog', 'equipment.inventory'] },
  { key: 'exercises', label: 'Exercícios', icon: 'fitness-outline', roles: staff },
  { key: 'assessments', label: 'Avaliações', icon: 'pulse-outline', roles: staff },
  { key: 'workouts', label: 'Treinos', icon: 'clipboard-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'] },
  { key: 'intelligence', label: 'IRON Intelligence', icon: 'sparkles-outline', roles: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER'], entitlement: ['ai.workout_generation'] },
  { key: 'schedule', label: 'Agenda', icon: 'calendar-outline', roles: staff },
  { key: 'access', label: 'Acessos', icon: 'key-outline', roles: operational },
  { key: 'communication', label: 'Comunicação', icon: 'chatbubbles-outline', roles: operational },
  { key: 'financial', label: 'Financeiro', icon: 'lock-closed-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'fiscal', label: 'Fiscal / NFS-e', icon: 'document-text-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'saasBilling', label: 'Assinatura IRON', icon: 'card-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'security', label: 'Segurança', icon: 'shield-checkmark-outline' },
  { key: 'privacy', label: 'Privacidade', icon: 'document-text-outline' },
  { key: 'entitlements', label: 'Plano e configurações', icon: 'layers-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'integrations', label: 'Integrações', icon: 'git-network-outline', roles: ['SUPER_ADMIN', 'OWNER'] },
  { key: 'creator', label: 'Rede de Criadores', icon: 'images-outline', roles: ['OWNER', 'MANAGER'], entitlement: ['content.external_youtube', 'content.iron_managed', 'content.tenant_private'] },
];

function list(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ['items', 'data', 'results', 'students', 'users', 'charges', 'events']) if (Array.isArray(value?.[key])) return value[key];
  return [];
}
function financialDateIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const candidate = value.trim() + 'T00:00:00.000Z';
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString() !== candidate ? null : candidate;
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
function Field({ label, value, onChangeText, secureTextEntry, numeric, testID }: { label: string; value: string; onChangeText: (value: string) => void; secureTextEntry?: boolean; numeric?: boolean; testID?: string }) {
  return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} testID={testID} style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={numeric ? 'numeric' : 'default'} placeholderTextColor="#64748b" /></View>;
}
function Button({ label, onPress, disabled, secondary, testID }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; testID?: string }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} testID={testID} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={[styles.buttonText, !secondary && styles.buttonTextOnAccent]}>{label}</Text></TouchableOpacity>;
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
  return <View style={styles.chips}>{rows.map((row) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: selected === row.id }} key={row.id} style={[styles.chip, selected === row.id && styles.chipActive]} onPress={() => onSelect(row.id)}><Text style={[styles.chipText, selected === row.id && styles.chipTextActive]}>{row.name ?? row.user?.name ?? row.id}</Text></TouchableOpacity>)}</View>;
}

export function CommercialWebApp() {
  const { activeTenantId, profile } = useAuth();
  // Remount all shell state when its authority changes. Pending requests from
  // the previous academy/user can only update the unmounted instance.
  const authorityKey = JSON.stringify([
    activeTenantId, profile?.id, profile?.roles, profile?.permissions,
  ]);
  // SUPER_ADMIN global (sem academia ativa) não tem plano nem entitlements de tenant:
  // vê somente a área de plataforma da FM, sem consultar dados de academia.
  const platformOperator = !activeTenantId && Array.isArray(profile?.roles) && profile.roles.includes('SUPER_ADMIN');
  if (platformOperator) return <PlatformAdminWorkspace key={authorityKey} />;
  return <TenantCommercialWebApp key={authorityKey} />;
}

function TenantCommercialWebApp() {
  const { profile, activeTenantId, logout } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const compact = viewportWidth < 980;
  const narrow = viewportWidth < 560;
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
  const [account, setAccount] = useState({ name: '', type: 'CASH', initialBalance: '0' });
  const [studentPlan, setStudentPlan] = useState({ planName: '', amount: '', nextBillingAt: '' });
  const [charge, setCharge] = useState({ amount: '', dueDate: '', paymentMethod: '' });
  const [academy, setAcademy] = useState({ name: '', timezone: 'America/Sao_Paulo' });
  const [reviewWorkoutId, setReviewWorkoutId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
  const [adminStepUpActive, setAdminStepUpActive] = useState(false);
  const [adminStepUpExpiresAt, setAdminStepUpExpiresAt] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordVisible, setAdminPasswordVisible] = useState(false);
  const [adminSecondFactor, setAdminSecondFactor] = useState('');
  const [adminGateLoading, setAdminGateLoading] = useState(false);
  const [adminGateError, setAdminGateError] = useState('');

  const entitlementMap = useMemo(() => new Map(entitlements.map((item) => [item.featureKey, item])), [entitlements]);
  const enabled = useCallback((key: string) => (entitlementMap.get(key)?.value ?? FAIL_CLOSED_DEFAULT) === true, [entitlementMap]);
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
        const canSeeSchedule = visible.some((item) => item.key === 'schedule');
        const canSeeWorkouts = visible.some((item) => item.key === 'workouts');
        const [summary, revenue, attendance, overdue, birthdays, gym, cockpitSlots, cockpitWorkouts] = await Promise.all([
          api('/dashboard/summary'),
          canSeeFinancialDashboard ? api('/dashboard/revenue?days=30') : Promise.resolve(null),
          api('/dashboard/attendance?days=7'),
          canSeeFinancialDashboard ? api('/dashboard/overdue') : Promise.resolve(null),
          api('/dashboard/birthdays?days=30'),
          activeTenantId && can('OWNER', 'MANAGER') ? api(`/gyms/${activeTenantId}`).catch(() => null) : Promise.resolve(null),
          canSeeSchedule ? api('/schedule-slots') : Promise.resolve(null),
          canSeeWorkouts ? api('/workouts') : Promise.resolve(null),
        ]); Object.assign(next, { summary, revenue, attendance, overdue, birthdays, gym, cockpitSlots, cockpitWorkouts });
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
  }, [activeTenantId, adminStepUpActive, can, enabled, selectedStudent, subscription, visible]);

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
      setAdminPasswordVisible(false);
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
    return <Section
      title="Acesso administrativo protegido"
      subtitle="Confirme sua identidade para entrar nesta área restrita. A autorização é temporária e vinculada à sua sessão atual."
    >
      <View style={styles.adminGateIdentity}>
        <Ionicons name="lock-closed-outline" size={24} color="#56EC95" />
        <View>
          <Text style={styles.rowTitle}>{profile?.name ?? 'Proprietário'}</Text>
          <Text style={styles.muted}>{profile?.email ?? 'Conta administrativa'}</Text>
        </View>
      </View>
      <View style={styles.adminGateForm}>
        <View style={styles.adminPasswordField}>
          <Text style={styles.label}>Senha atual</Text>
          <View style={styles.adminPasswordInputRow}>
            <TextInput
              accessibilityLabel="Senha atual"
              testID="admin-password-input"
              style={styles.adminPasswordInput}
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry={!adminPasswordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Digite sua senha atual"
              placeholderTextColor="#828A91"
            />
            <TouchableOpacity
              testID="admin-password-visibility-toggle"
              accessibilityRole="button"
              accessibilityLabel={adminPasswordVisible ? 'Ocultar senha atual' : 'Mostrar senha atual'}
              accessibilityHint="Alterna a visibilidade da senha nesta tela"
              style={styles.adminPasswordToggle}
              onPress={() => setAdminPasswordVisible((visible) => !visible)}
            >
              <Ionicons name={adminPasswordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color="#2BF47A" />
            </TouchableOpacity>
          </View>
          <Text style={styles.adminPasswordHelp}>
            Use sua senha atual. Para criar ou alterar uma senha: {PASSWORD_POLICY_TEXT}
          </Text>
        </View>
        {profile?.mfaEnabled ? <View style={styles.adminGateMfaField}>
          <Field label="Código MFA ou código de recuperação" value={adminSecondFactor} onChangeText={setAdminSecondFactor} />
        </View> : null}
      </View>
      {adminGateError ? <Text style={styles.error}>{adminGateError}</Text> : null}
      <Button
        testID="admin-step-up-submit"
        label={adminGateLoading ? 'Validando…' : 'Entrar na área administrativa'}
        disabled={adminGateLoading || !adminPassword.trim()}
        onPress={() => { void unlockAdministrativeArea(); }}
      />
      <Text style={styles.helper}>Por segurança, o acesso administrativo expira automaticamente após 15 minutos.</Text>
    </Section>;
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
      slots={Array.isArray(data.cockpitSlots) ? data.cockpitSlots : null}
      workouts={Array.isArray(data.cockpitWorkouts) ? data.cockpitWorkouts : null}
      financialAuthorized={financialAuthorized}
      availableModules={authorizedShortcuts}
      onNavigate={(key) => setActive(key)}
      onRefresh={() => { void loadModule('overview'); }}
      refreshing={loading}
    />;
  }
  function onboardingView() {
    const availableTargets: ('equipment' | 'team')[] = ['equipment', 'team'].filter(
      (key): key is 'equipment' | 'team' => visible.some((item) => item.key === key),
    );
    return <OnboardingWorkspace
      state={onboarding}
      name={academy.name} timezone={academy.timezone} saving={saving}
      onNameChange={(name) => setAcademy((v) => ({ ...v, name }))}
      onTimezoneChange={(timezone) => setAcademy((v) => ({ ...v, timezone }))}
      availableTargets={availableTargets}
      onNavigate={(target) => setActive(target)}
      onComplete={(step, dataForStep) => {
        void mutate(() => api('/commercial/onboarding', undefined, {
          method: 'PATCH', body: JSON.stringify({ step, ...(dataForStep ? { data: dataForStep } : {}) }),
        }));
      }}
    />;
  }
  function studentsView() {
    return <>{can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ? <Section title="Cadastrar aluno"><View style={styles.form}><Field label="Nome" value={student.name} onChangeText={(name) => setStudent((v) => ({ ...v, name }))} /><Field label="E-mail" value={student.email} onChangeText={(email) => setStudent((v) => ({ ...v, email }))} /><Field label="Telefone" value={student.phone} onChangeText={(phone) => setStudent((v) => ({ ...v, phone }))} /></View><Button testID="student-create" label="Cadastrar aluno" disabled={saving || !student.name.trim() || !student.email.trim()} onPress={() => void mutate(async () => { const created = await api('/students', undefined, { method: 'POST', body: JSON.stringify({ name: student.name.trim(), email: student.email.trim().toLowerCase(), ...(student.phone.trim() ? { phone: student.phone.trim() } : {}) }) }); setLastStudentInvite(created?.onboarding?.required ? created.onboarding : null); return created; }, () => setStudent({ name: '', email: '', phone: '' }))} />{lastStudentInvite ? <View style={styles.invite}><Text style={styles.rowTitle}>Convite de ativação — exibir uma vez</Text><Text selectable style={styles.json}>{lastStudentInvite.token}</Text><Text style={styles.muted}>Expira em: {String(lastStudentInvite.expiresAt ?? '—')}</Text></View> : null}</Section> : null}<Student360Panel key={activeTenantId ?? 'sem-academia'} students={list(data.students)} canReadWorkouts={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TRAINER')} canReadAccess={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')} canReadFinance={can('SUPER_ADMIN', 'OWNER') && adminStepUpActive} canEditConsents={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')} /></>;
  }
  function teamView() {
    return <TeamManagementPanel
      key={activeTenantId ?? 'sem-academia'}
      members={list(data.users)}
      actorRoles={roles}
      rosterLoaded={Array.isArray(data.users) || Array.isArray(data.users?.items)}
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
      canManageOperations={enabled('equipment.inventory') && can('OWNER', 'MANAGER')}
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
    const students = list(data.students);
    const slots = list(data.slots);
    return <>
      <ScheduleCalendarPanel key={activeTenantId ?? 'sem-academia'} slots={slots}
        canCheckIn={can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION')}
        onDateSelected={setBookingDate} refreshToken={scheduleRefresh} />
      {can('SUPER_ADMIN', 'OWNER', 'MANAGER', 'RECEPTION') ?
        <ScheduleManagementPanel key={activeTenantId ?? 'sem-academia'}
          students={students} slots={slots} bookingDate={bookingDate} onDateChange={setBookingDate}
          canManageSlots={can('SUPER_ADMIN', 'OWNER', 'MANAGER')}
          onUpdated={async () => {
            await loadModule('schedule');
            setScheduleRefresh((current) => current + 1);
          }} /> : null}
    </>;
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
    const students = list(data.students);
    const accounts = list(data.accounts);
    const charges = list(data.charges);
    // The IRON finance API stores integer minor units (centavos). The user
    // enters reais; only the exact parser result is submitted to the backend.
    const initialMinor = brlToMinor(account.initialBalance);
    const subscriptionMinor = positiveBrlToMinor(studentPlan.amount);
    const chargeMinor = positiveBrlToMinor(charge.amount);
    const subscriptionDate = studentPlan.nextBillingAt.trim()
      ? financialDateIso(studentPlan.nextBillingAt) : undefined;
    const dueDate = financialDateIso(charge.dueDate);
    const accountValid = !!account.name.trim() && initialMinor !== null;
    const subscriptionValid = !!selectedFinancialStudent && !!studentPlan.planName.trim() &&
      subscriptionMinor !== null && (!studentPlan.nextBillingAt.trim() || !!subscriptionDate);
    const chargeValid = !!selectedFinancialStudent && chargeMinor !== null && !!dueDate;
    return <>
      <Section title="Contas financeiras" subtitle="Caixa e contas pertencem somente à academia; cobrança da FM Tecnologia é gerida no FM Command.">
        <View style={styles.form}>
          <Field testID="finance-account-name" label="Nome da conta" value={account.name}
            onChangeText={(name) => setAccount((current) => ({ ...current, name }))} />
          <Field label="Tipo de conta" value={account.type}
            onChangeText={(type) => setAccount((current) => ({ ...current, type }))} />
          <Field testID="finance-account-balance" label="Saldo inicial (R$)" value={account.initialBalance}
            onChangeText={(initialBalance) => setAccount((current) => ({ ...current, initialBalance }))} />
        </View>
        {initialMinor === null ? <Text testID="finance-account-invalid" style={styles.error}>Informe o saldo inicial em reais (ex.: 0 ou 100,00), sem valor negativo.</Text> : null}
        <Button testID="finance-create-account" label="Criar conta" disabled={saving || !accountValid}
          onPress={() => {
            if (initialMinor === null) return;
            void mutate(() => api('/financial/accounts', undefined, {
              method: 'POST',
              body: JSON.stringify({ name: account.name.trim(), type: account.type.trim(), initialBalance: initialMinor }),
            }), () => setAccount({ name: '', type: 'CASH', initialBalance: '0' }));
          }} />
        {accounts.length ? accounts.map((item: any) => <View key={item.id} style={styles.row}>
          <Text style={styles.rowTitle}>{item.name ?? 'Conta financeira'}</Text>
          <Text style={styles.muted}>Saldo inicial: {brlFromMinor(item.initialBalance)} · {item.active === false ? 'Inativa' : 'Ativa'}</Text>
        </View>) : <Text style={styles.muted}>Nenhuma conta cadastrada.</Text>}
        <Text style={styles.label}>Conta para registrar recebimentos</Text>
        <Chips rows={accounts.filter((item: any) => item.active !== false)} selected={selectedAccount} onSelect={setSelectedAccount} />
      </Section>
      <Section title="Assinatura e cobranças do aluno"
        subtitle="Academia → aluno. Informe valores em reais; o IRON registra os centavos exatos. Não é a assinatura SaaS da FM.">
        <Text style={styles.label}>Aluno</Text>
        <Chips rows={students} selected={selectedFinancialStudent} onSelect={setSelectedFinancialStudent} />
        <View style={styles.form}>
          <Field testID="finance-plan-name" label="Nome do plano" value={studentPlan.planName}
            onChangeText={(planName) => setStudentPlan((v) => ({ ...v, planName }))} />
          <Field testID="finance-subscription-amount" label="Mensalidade ou valor do plano (R$)" value={studentPlan.amount}
            onChangeText={(amount) => setStudentPlan((v) => ({ ...v, amount }))} />
          <Field testID="finance-subscription-date" label="Próxima cobrança (AAAA-MM-DD, opcional)" value={studentPlan.nextBillingAt}
            onChangeText={(nextBillingAt) => setStudentPlan((v) => ({ ...v, nextBillingAt }))} />
        </View>
        {studentPlan.amount.trim() && subscriptionMinor === null ?
          <Text testID="finance-subscription-invalid" style={styles.error}>Informe um valor positivo em reais, por exemplo 149,90.</Text> : null}
        {studentPlan.nextBillingAt.trim() && !subscriptionDate ?
          <Text testID="finance-subscription-date-invalid" style={styles.error}>Informe uma data real no formato AAAA-MM-DD.</Text> : null}
        <Button testID="finance-create-subscription" label="Criar assinatura do aluno"
          disabled={saving || !subscriptionValid}
          onPress={() => {
            if (!subscriptionValid || subscriptionMinor === null) return;
            void mutate(() => api('/financial/subscriptions', undefined, {
              method: 'POST',
              body: JSON.stringify({
                studentId: selectedFinancialStudent, planName: studentPlan.planName.trim(),
                amount: subscriptionMinor, ...(subscriptionDate ? { nextBillingAt: subscriptionDate } : {}),
              }),
            }));
          }} />
        <View style={styles.form}>
          <Field testID="finance-charge-amount" label="Valor da cobrança (R$)" value={charge.amount}
            onChangeText={(amount) => setCharge((v) => ({ ...v, amount }))} />
          <Field testID="finance-charge-due" label="Vencimento (AAAA-MM-DD)" value={charge.dueDate}
            onChangeText={(dueDateInput) => setCharge((v) => ({ ...v, dueDate: dueDateInput }))} />
          <Field label="Meio previsto (opcional)" value={charge.paymentMethod}
            onChangeText={(paymentMethod) => setCharge((v) => ({ ...v, paymentMethod }))} />
        </View>
        {charge.amount.trim() && chargeMinor === null ?
          <Text testID="finance-charge-invalid" style={styles.error}>Informe o valor positivo em reais (ex.: 99,90).</Text> : null}
        {charge.dueDate.trim() && !dueDate ?
          <Text testID="finance-charge-date-invalid" style={styles.error}>Vencimento inválido. Utilize AAAA-MM-DD.</Text> : null}
        <Button testID="finance-create-charge" secondary label="Criar cobrança"
          disabled={saving || !chargeValid}
          onPress={() => {
            if (!chargeValid || chargeMinor === null || !dueDate) return;
            void mutate(() => api('/financial/charges', undefined, {
              method: 'POST',
              body: JSON.stringify({
                studentId: selectedFinancialStudent, amount: chargeMinor, dueDate,
                ...(charge.paymentMethod.trim() ? { paymentMethod: charge.paymentMethod.trim() } : {}),
              }),
            }));
          }} />
      </Section>
      <AcademyChargesPanel key={activeTenantId ?? 'sem-academia'} charges={charges} accounts={accounts} selectedAccountId={selectedAccount}
        onUpdated={() => { void loadModule('financial'); }}
        saving={saving}
        onPay={(chargeId, accountId, paymentMethod) => {
          void mutate(() => api('/financial/charges/' + encodeURIComponent(chargeId) + '/pay', undefined, {
            method: 'PATCH', body: JSON.stringify({ accountId, paymentMethod }),
          }));
        }} />
    </>;
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
    if (active === 'alerts') return <ManagerAlertsPanel key={activeTenantId ?? 'sem-academia'} />;
    if (active === 'overview') return overview(); if (active === 'onboarding') return onboardingView(); if (active === 'students') return studentsView(); if (active === 'team') return teamView(); if (active === 'equipment') return equipmentView(); if (active === 'exercises') return exercisesView(); if (active === 'assessments') return assessmentsView(); if (active === 'workouts') return workoutsView(); if (active === 'intelligence') return intelligenceView(); if (active === 'aggregator') return <AggregatorHubPanel key={activeTenantId ?? 'sem-academia'} canManage={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} />; if (active === 'schedule') return scheduleView(); if (active === 'access') return accessView(); if (active === 'communication') return <CommunicationCenterPanel key={activeTenantId ?? 'sem-academia'} canManageAutomations={can('SUPER_ADMIN', 'OWNER', 'MANAGER')} />; if (active === 'financial') return financialView(); if (active === 'fiscal') return <FiscalCenter />; if (active === 'saasBilling') return <SaasBillingPanel onCommercialStateChanged={loadShell} />; if (active === 'security') return <AccountSecurityPanel />; if (active === 'privacy') return <PrivacyCenter canOperatePrivacy={can('SUPER_ADMIN')} />; if (active === 'entitlements') return entitlementsView(); if (active === 'integrations') return <IntegrationCredentialsPanel canStartOAuth={can('OWNER')} />; return creatorView();
  }

  const topBar = <View style={[styles.top, narrow && styles.topNarrow]}><IronBrand compact mobile={narrow} /><View style={[styles.actions, narrow && styles.actionsNarrow]}>{can('OWNER', 'MANAGER') ? <ManagerAlertBell onOpen={() => setActive('alerts')} /> : null}<Text numberOfLines={1} style={[styles.muted, narrow && styles.userNameNarrow]}>{profile?.name ?? profile?.email ?? 'Usuário'}</Text><Button testID="commercial-logout" secondary label="Sair" onPress={() => { void logout(); }} /></View></View>;
  if (!shellReady) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={styles.contentInner}>{error ? <Text style={styles.error}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Validando assinatura, período gratuito e funcionalidades disponíveis…</Text></View>}</View></View>;
  if (blocked) return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} accessibilityLabel="Navegação dos módulos" accessibilityHint={compact ? 'Deslize horizontalmente para visualizar mais módulos' : undefined} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#2BF47A' : '#94a3b8'} /><Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.warning} testID="subscription-blocked"><Text style={styles.warningTitle}>Acesso comercial limitado</Text><Text style={styles.muted}>Seu acesso operacional está limitado. O período gratuito terminou ou a assinatura está inativa ou suspensa. As operações permanecem bloqueadas até a regularização. Assinatura IRON e Segurança continuam disponíveis para recuperação.</Text></View><Section title="Estado comercial"><Text style={styles.muted}>Avaliação: {trial?.status === 'EXPIRED' ? 'Expirada' : trial?.status === 'INACTIVE' ? 'Inativa' : trial?.status === 'TRIALING' ? 'Em andamento' : 'Situação não confirmada'}</Text><Text style={styles.muted}>Assinatura: {subscription?.status === 'SUSPENDED' ? 'Suspensa' : subscription?.status === 'CANCELED' ? 'Cancelada' : subscription?.status === 'ACTIVE' ? 'Ativa' : 'Situação não confirmada'}</Text></Section>{active === 'security' ? <AccountSecurityPanel /> : active === 'privacy' ? <PrivacyCenter canOperatePrivacy={can('SUPER_ADMIN')} /> : active === 'saasBilling' && can('SUPER_ADMIN', 'OWNER') ? (adminStepUpActive ? <SaasBillingPanel onCommercialStateChanged={loadShell} /> : adminGateView()) : <Section title="Recuperação de acesso" subtitle="Selecione Segurança, Privacidade ou Assinatura IRON nas áreas permitidas ao seu perfil."><Text style={styles.muted}>A operação da academia permanece bloqueada até o backend confirmar a situação comercial.</Text></Section>}</ScrollView></View></View>;
  return <View style={styles.app} testID="commercial-web-app">{topBar}<View style={[styles.body, compact && styles.bodyCompact]}><ScrollView horizontal={compact} accessibilityLabel="Navegação dos módulos" accessibilityHint={compact ? 'Deslize horizontalmente para visualizar mais módulos' : undefined} style={[styles.nav, compact && styles.navCompact]} contentContainerStyle={compact ? styles.navHorizontal : undefined}>{visible.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: active === item.key }} key={item.key} testID={`nav-${item.key}`} style={[styles.navItem, active === item.key && styles.navActive]} onPress={() => setActive(item.key)}><Ionicons name={item.icon} size={18} color={active === item.key ? '#2BF47A' : '#94a3b8'} /><Text style={[styles.navText, active === item.key && styles.navTextActive]}>{item.label}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.pageHead}><View><Text style={styles.title}>{modules.find((item) => item.key === active)?.label}</Text><Text style={styles.muted}>Tenant derivado da sessão autenticada · {activeTenantId ?? 'sem tenant ativo'}</Text></View><Button secondary label="Atualizar" onPress={() => { void loadModule(active); }} /></View>{error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Carregando dados canônicos…</Text></View> : content()}</ScrollView></View></View>;
}

const styles = StyleSheet.create({
  adminGateIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  adminGateForm: { width: '100%', maxWidth: 400, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  adminPasswordField: { width: '100%', minWidth: 0 },
  adminPasswordInputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, backgroundColor: '#08080A', borderWidth: 1, borderColor: '#315140', borderRadius: 10, overflow: 'hidden' },
  adminPasswordInput: { flex: 1, minWidth: 0, minHeight: 44, color: '#EEF1F5', paddingHorizontal: 11, paddingVertical: 8 },
  adminPasswordToggle: { minWidth: 48, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#315140' },
  adminPasswordHelp: { color: '#A1A6AE', fontSize: 11, lineHeight: 16, marginTop: 6 },
  adminGateMfaField: { width: '100%', minWidth: 0 },
  helper: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 6 },
  app: { flex: 1, backgroundColor: '#080c17' },
  top: { minHeight: 72, padding: 18, backgroundColor: '#101625', borderBottomWidth: 1, borderBottomColor: '#273248', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topNarrow: { minHeight: 68, flexWrap: 'nowrap', paddingHorizontal: 10, gap: 6 },
  brand: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  body: { flex: 1, flexDirection: 'row' },
  bodyCompact: { flexDirection: 'column' },
  nav: { width: 240, flexGrow: 0, flexShrink: 0, backgroundColor: '#0d1321', paddingVertical: 10 },
  navCompact: { width: '100%', maxWidth: '100%', minWidth: 0, maxHeight: 72 },
  navHorizontal: { alignItems: 'center' },
  navItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, margin: 4, borderRadius: 9 },
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
  input: { minHeight: 44, color: '#f8fafc', backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#2a3650', borderRadius: 9, padding: 10 },
  button: { minHeight: 44, alignSelf: 'flex-start', backgroundColor: '#2BF47A', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10, marginTop: 4 },
  secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  buttonTextOnAccent: { color: '#04140b' },
  disabled: { opacity: 0.45 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  actionsNarrow: { flexShrink: 1, minWidth: 0, flexWrap: 'nowrap', gap: 6 },
  userNameNarrow: { flexShrink: 1, minWidth: 0, maxWidth: 135, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
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
