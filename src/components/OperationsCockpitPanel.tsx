import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';

type Summary = {
  students?: { total?: number; active?: number; inactive?: number };
  equipments?: { total?: number };
  workouts?: { total?: number; approved?: number; drafts?: number };
  charges?: { pending?: number; overdue?: number };
  generatedAt?: string;
};
type Attendance = { date: string; count: number };
type Revenue = { date: string; amount: number };
type Birthday = { studentId: string; name: string; nextBirthday?: string; daysUntil?: number };
type Overdue = { id: string; dueDate?: string; student?: { user?: { name?: string } } };
export type CockpitShortcut = 'students' | 'team' | 'equipment' | 'workouts' | 'schedule' | 'access' | 'financial';
type Props = {
  academyName?: string; operatorName?: string; summary: Summary | null; attendance: Attendance[] | null;
  revenue: Revenue[] | null; overdue: Overdue[] | null; birthdays: Birthday[] | null;
  financialAuthorized: boolean; availableModules: readonly CockpitShortcut[];
  onNavigate: (key: CockpitShortcut) => void; onRefresh: () => void; refreshing: boolean;
};
const shortcuts: { key: CockpitShortcut; label: string; description: string }[] = [
  { key: 'students', label: 'Alunos', description: 'Cadastros e acompanhamento' },
  { key: 'schedule', label: 'Agenda', description: 'Horários e presenças' },
  { key: 'workouts', label: 'Treinos', description: 'Criação e revisão' },
  { key: 'equipment', label: 'Equipamentos', description: 'Inventário da academia' },
  { key: 'team', label: 'Equipe', description: 'Membros e permissões' },
  { key: 'access', label: 'Acessos', description: 'Credenciais e ocorrências' },
  { key: 'financial', label: 'Financeiro', description: 'Cobranças da academia' },
];
function number(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
    : '—';
}
function date(value?: string) {
  if (!value) return 'Não informado';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Não informado' : parsed.toLocaleDateString('pt-BR');
}
function Kpi({ label, value, note, testID }: { label: string; value: number | undefined; note: string; testID?: string }) {
  return <GlowCard style={styles.kpi} testID={testID}><Text style={styles.kpiLabel}>{label}</Text>
    <Text style={styles.kpiValue}>{number(value)}</Text><Text style={styles.kpiNote}>{note}</Text></GlowCard>;
}
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <GlowCard style={styles.card}><Text style={styles.title}>{title}</Text>
    {description ? <Text style={styles.hint}>{description}</Text> : null}<View style={styles.inner}>{children}</View></GlowCard>;
}
function Bars({ points }: { points: Attendance[] }) {
  if (!points.length) return <Text style={styles.hint}>Ainda não há dados para este período.</Text>;
  const largest = Math.max(1, ...points.map((p) => Math.max(0, p.count)));
  return <View testID="cockpit-attendance-chart" style={styles.bars}>
    {points.map((point) => <View key={point.date} style={styles.barCell}>
      <Text style={styles.barValue}>{number(point.count)}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.bar, { height: Math.max(2, Math.round(70 * Math.max(0, point.count) / largest)) }]} />
      </View>
      <Text style={styles.barDate}>{date(point.date).slice(0, 5)}</Text>
    </View>)}
  </View>;
}
export function OperationsCockpitPanel({ academyName, operatorName, summary, attendance, revenue,
  overdue, birthdays, financialAuthorized, availableModules, onNavigate, onRefresh, refreshing }: Props) {
  const checkins = Array.isArray(attendance) ? attendance : [];
  const upcoming = Array.isArray(birthdays) ? birthdays : [];
  const overdueRows = financialAuthorized && Array.isArray(overdue) ? overdue : [];
  const revenueRows = financialAuthorized && Array.isArray(revenue) ? revenue : [];
  const shortcutsAvailable = shortcuts.filter((item) => availableModules.includes(item.key));
  return <View>
    <GlowCard style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>PAINEL DE OPERAÇÃO</Text>
          <Text style={styles.heroTitle}>{academyName?.trim() || 'Sua academia'}</Text>
          <Text style={styles.hint}>Visão operacional de {operatorName || 'sua equipe'} · Dados canônicos do IRON</Text>
          <Text style={styles.freshness}>Data de referência: {summary?.generatedAt ? date(summary.generatedAt) : 'Não informada'}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" testID="cockpit-refresh" style={[styles.button, refreshing && styles.disabled]}
          onPress={onRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#07180c" /> : <Text style={styles.buttonText}>Atualizar painel</Text>}
        </TouchableOpacity>
      </View>
    </GlowCard>
    <Section title="Operação da academia" description="Dados do tenant autenticado. Informações indisponíveis não são contabilizadas como zero.">
      <View style={styles.kpis}>
        <Kpi testID="cockpit-students-total" label="Alunos cadastrados" value={summary?.students?.total} note="Total de matrículas" />
        <Kpi label="Alunos ativos" value={summary?.students?.active} note="Matrículas ativas" />
        <Kpi label="Equipamentos" value={summary?.equipments?.total} note="Inventário ativo" />
        <Kpi label="Treinos aprovados" value={summary?.workouts?.approved} note="Aprovados ou em execução" />
        <Kpi label="Treinos em elaboração" value={summary?.workouts?.drafts} note="Ainda não aprovados" />
      </View>
    </Section>
    <Section title="Presenças nos últimos 7 dias" description="Check-ins confirmados, não apenas agendamentos.">
      <Bars points={checkins.filter((item) =>
        typeof item.date === 'string' && typeof item.count === 'number' && Number.isFinite(item.count))} />
    </Section>
    <Section title="Próximos aniversários" description="Alunos ativos com aniversário nos próximos 30 dias.">
      {upcoming.length ? upcoming.slice(0, 10).map((birthday) => <View key={birthday.studentId} style={styles.record}>
        <Text style={styles.recordName}>{birthday.name || 'Aluno'}</Text>
        <Text style={styles.hint}>{typeof birthday.daysUntil === 'number'
          ? birthday.daysUntil === 0 ? 'Hoje' : 'Em ' + birthday.daysUntil + ' dia(s)'
          : date(birthday.nextBirthday)}</Text>
      </View>) : <Text style={styles.hint}>Nenhum aniversário próximo.</Text>}
    </Section>
    {financialAuthorized ? <>
      <Section title="Cobranças da academia" description="Somente proprietário ou superadministrador com reautenticação ativa. Financeiro academia → aluno, separado do billing FM → academia.">
        <View style={styles.kpis}>
          <Kpi testID="cockpit-financial-pending" label="Cobranças pendentes" value={summary?.charges?.pending} note="Aguardando pagamento" />
          <Kpi label="Cobranças vencidas" value={summary?.charges?.overdue} note="Prazo ultrapassado" />
        </View>
        {overdueRows.length ? <View style={styles.recordList}>
          <Text style={styles.subtitle}>Vencimentos prioritários</Text>
          {overdueRows.slice(0, 8).map((row) => <View key={row.id} style={styles.record}>
            <Text style={styles.recordName}>{row.student?.user?.name ?? 'Aluno'}</Text>
            <Text style={styles.hint}>Vencimento: {date(row.dueDate)}</Text>
          </View>)}
        </View> : <Text style={styles.hint}>Nenhuma cobrança vencida retornada pela consulta.</Text>}
      </Section>
      <Section title="Recebimentos — últimos 30 dias" description="Valores conforme a unidade registrada pela API financeira; não representam faturamento do SaaS.">
        {revenueRows.length ? <View style={styles.recordList}>
          {revenueRows.slice(-7).map((row) => <View key={row.date} style={styles.record}>
            <Text style={styles.recordName}>{date(row.date)}</Text>
            <Text style={styles.hint}>Valor registrado: {number(row.amount)}</Text>
          </View>)}
        </View> : <Text style={styles.hint}>Não há movimentações no período consultado.</Text>}
      </Section>
    </> : null}
    {shortcutsAvailable.length ? <Section title="Acesso rápido" description="Atalhos apenas para módulos permitidos ao seu perfil e plano.">
      <View style={styles.shortcuts}>
        {shortcutsAvailable.map((item) => <GlowCard key={item.key}
          testID={'cockpit-shortcut-' + item.key} onPress={() => onNavigate(item.key)} style={styles.shortcut}>
          <Text style={styles.shortcutTitle}>{item.label}</Text>
          <Text style={styles.hint}>{item.description}</Text>
        </GlowCard>)}
      </View>
    </Section> : null}
  </View>;
}
const styles = StyleSheet.create({
  hero: { padding: 20, marginBottom: 12 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroText: { flexGrow: 1, flexBasis: 220, gap: 6 },
  eyebrow: { color: '#2BF47A', letterSpacing: 1.6, fontSize: 10, fontWeight: '800' },
  heroTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 23 },
  freshness: { color: '#8497aa', fontSize: 11 },
  hint: { color: '#aabbd0', fontSize: 12, lineHeight: 18 },
  card: { padding: 16, marginBottom: 12 }, inner: { marginTop: 12, gap: 8 },
  title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { padding: 14, flexGrow: 1, flexBasis: 164, backgroundColor: '#101d2a', borderColor: '#2a3f47', borderWidth: 1, borderRadius: 12, gap: 4 },
  kpiLabel: { color: '#b8c8d8', fontWeight: '700', fontSize: 12 },
  kpiValue: { color: '#eefcf3', fontWeight: '900', fontSize: 27 },
  kpiNote: { color: '#8497aa', fontSize: 11 },
  bars: { minHeight: 124, flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingVertical: 8 },
  barCell: { alignItems: 'center', flexGrow: 1, flexBasis: 25, gap: 6 },
  barValue: { color: '#e2e8f0', fontWeight: '700', fontSize: 11 },
  barTrack: { height: 72, justifyContent: 'flex-end', width: '100%', maxWidth: 44, backgroundColor: '#172331', borderRadius: 6, overflow: 'hidden' },
  bar: { backgroundColor: '#2BF47A', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barDate: { color: '#94a3b8', fontSize: 10 },
  recordList: { gap: 4 },
  record: { paddingVertical: 9, borderBottomColor: '#29394a', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  recordName: { color: '#f1f5f9', fontWeight: '700', fontSize: 13 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  shortcut: { minWidth: 158, flexBasis: 185, flexGrow: 1, backgroundColor: '#14222a', borderColor: '#29463b', borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  shortcutTitle: { color: '#2BF47A', fontWeight: '800', fontSize: 13 },
  button: { backgroundColor: '#2BF47A', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#051609', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.5 },
});
