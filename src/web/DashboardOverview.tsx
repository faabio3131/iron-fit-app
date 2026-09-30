import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { iron } from '../design/iron-theme';

// FinancialTransaction and Charge store integer centavos (canonical seed/financial service).
export function money(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-BR') : '—';
function day(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : '—';
}
type Icon = React.ComponentProps<typeof Ionicons>['name'];
type DashboardData = {
  summary?: { students?: { total?: number; active?: number }; revenue?: { thisMonth?: number }; charges?: { pending?: number; overdue?: number }; workouts?: { approved?: number }; equipments?: { total?: number } };
  revenue?: { date: string; amount: number }[];
  attendance?: { date: string; count: number }[];
  overdue?: { id: string; amount?: number; dueDate?: string; student?: { user?: { name?: string } } }[];
  birthdays?: { studentId: string; name?: string; nextBirthday?: string }[];
};
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text accessibilityRole="header" style={styles.heading}>{title}</Text><Text style={styles.muted}>{subtitle}</Text><View style={styles.panelBody}>{children}</View></View>;
}
function DailyBars({ rows, financial }: { rows: { date: string; value: number }[]; financial?: boolean }) {
  const valid = rows.filter(row => typeof row.value === 'number' && Number.isFinite(row.value));
  if (!valid.length) return <Text style={styles.empty}>Nenhum dado disponível para este período.</Text>;
  if (valid.every(row => row.value === 0)) return <Text style={styles.empty}>{financial ? 'Nenhum recebimento no período.' : 'Nenhum check-in no período.'}</Text>;
  const max = Math.max(...valid.map(row => Math.abs(row.value)), 1);
  return <View><View style={styles.chart}>{valid.map((row, index) => <View key={`${row.date}-${index}`} style={styles.barColumn} accessible accessibilityLabel={`${day(row.date)}: ${financial ? money(row.value) : `${count(row.value)} presenças`}`}>
    <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.abs(row.value) / max * 100}%`, backgroundColor: row.value < 0 ? '#fca5a5' : iron.primary }]} /></View>
    {!financial && <Text style={styles.axis}>{day(row.date)}</Text>}
  </View>)}</View>{financial && <View style={styles.range}><Text style={styles.muted}>{day(valid[0].date)}</Text><Text style={styles.muted}>{day(valid[valid.length - 1].date)}</Text></View>}</View>;
}
export function DashboardOverview({ data, navigate, canNavigate = () => true, showFinancial = true }: { data: DashboardData; canNavigate?: (module: 'students' | 'financial' | 'workouts' | 'equipment') => boolean; navigate: (module: 'students' | 'financial' | 'workouts' | 'equipment') => void; showFinancial?: boolean }) {
  const summary = data.summary;
  const metrics: { label: string; value: string; detail: string; icon: Icon; target: 'students' | 'financial' | 'workouts' | 'equipment'; financial?: boolean }[] = [
    { label: 'Alunos ativos', value: count(summary?.students?.active), detail: `${count(summary?.students?.total)} alunos cadastrados`, icon: 'people-outline', target: 'students' },
    { label: 'Receita do mês', value: money(summary?.revenue?.thisMonth), detail: 'Recebimentos confirmados', icon: 'wallet-outline', target: 'financial', financial: true },
    { label: 'Cobranças vencidas', value: count(summary?.charges?.overdue), detail: `${count(summary?.charges?.pending)} cobranças pendentes`, icon: 'time-outline', target: 'financial', financial: true },
    { label: 'Treinos aprovados', value: count(summary?.workouts?.approved), detail: 'Aprovados e ativos', icon: 'barbell-outline', target: 'workouts' },
  ].filter((metric) => showFinancial || !metric.financial);
  const revenue = Array.isArray(data.revenue) ? data.revenue : [];
  const attendance = Array.isArray(data.attendance) ? data.attendance : [];
  const overdue = Array.isArray(data.overdue) ? data.overdue : [];
  const birthdays = Array.isArray(data.birthdays) ? data.birthdays : [];
  return <View testID="dashboard-overview">
    <View style={styles.metrics}>{metrics.map(metric => <TouchableOpacity key={metric.label} disabled={!canNavigate(metric.target)} accessibilityRole={canNavigate(metric.target) ? "button" : undefined} accessibilityLabel={`${metric.label}: ${metric.value}${canNavigate(metric.target) ? ". Abrir detalhes" : ""}`} style={styles.metric} onPress={() => navigate(metric.target)}>
      <View style={styles.metricTop}><Text style={styles.metricLabel}>{metric.label}</Text><Ionicons name={metric.icon} size={21} color={iron.cyan} /></View>
      <Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.muted}>{metric.detail}</Text>
    </TouchableOpacity>)}</View>
    <View style={styles.grid}>
      {showFinancial ? <Panel title="Receita diária" subtitle="Últimos 30 dias · recebimentos confirmados"><DailyBars financial rows={revenue.map(row => ({ date: row.date, value: row.amount }))} /></Panel> : null}
      <Panel title="Frequência" subtitle="Últimos 7 dias · check-ins realizados"><DailyBars rows={attendance.map(row => ({ date: row.date, value: row.count }))} /></Panel>
    </View>
    <View style={styles.grid}>
      {showFinancial ? <Panel title="Atenção às cobranças" subtitle="Vencimentos em aberto · até 20 registros">{overdue.length ? overdue.map(row => <View style={styles.listRow} key={row.id}><View style={styles.rowText}><Text style={styles.item}>{row.student?.user?.name ?? 'Aluno'}</Text><Text style={styles.muted}>Venceu em {day(row.dueDate)}</Text></View><Text style={styles.amount}>{money(row.amount)}</Text></View>) : <Text style={styles.empty}>{data.overdue ? 'Nenhuma cobrança vencida.' : 'Informações indisponíveis.'}</Text>}</Panel> : null}
      <Panel title="Aniversariantes" subtitle="Próximos 30 dias">{birthdays.length ? birthdays.map(row => <View key={row.studentId} style={styles.listRow}><Ionicons name="gift-outline" size={20} color={iron.cyan} /><Text style={[styles.item, styles.rowText]}>{row.name ?? 'Aluno'}</Text><Text style={styles.muted}>{day(row.nextBirthday)}</Text></View>) : <Text style={styles.empty}>{data.birthdays ? 'Nenhum aniversário neste período.' : 'Informações indisponíveis.'}</Text>}</Panel>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metric: { flexGrow: 1, flexShrink: 1, flexBasis: 210, padding: 16, borderWidth: 1, borderColor: iron.line, backgroundColor: iron.elevated, borderRadius: 16 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  metricLabel: { color: iron.muted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  metricValue: { color: iron.text, fontSize: 28, fontWeight: '800', letterSpacing: -.8, marginTop: 10, marginBottom: 4 },
  muted: { color: iron.muted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 350, minWidth: 0, backgroundColor: iron.surface, borderWidth: 1, borderColor: iron.line, borderRadius: 16, padding: 18 },
  heading: { color: iron.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  panelBody: { marginTop: 14 },
  empty: { color: iron.muted, fontSize: 14, lineHeight: 22, paddingVertical: 12 },
  range: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chart: { flexDirection: 'row', height: 140, gap: 4 },
  barColumn: { flex: 1, minWidth: 0, height: 140 },
  barTrack: { flex: 1, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: iron.line },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { color: iron.muted, fontSize: 9, height: 24, paddingTop: 7, textAlign: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: iron.line },
  rowText: { flex: 1, minWidth: 0 },
  item: { color: iron.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  amount: { color: '#fca5a5', fontWeight: '700', fontSize: 14 },
});
