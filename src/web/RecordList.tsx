import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { iron } from '../design/iron-theme';
import { money } from './DashboardOverview';

// Deliberately opt in to presentation fields. Unknown API properties and nested secrets never render.
const labels: Record<string, string> = {
  email: 'E-mail', phone: 'Telefone', status: 'Situação', active: 'Ativo', description: 'Descrição',
  timezone: 'Fuso horário', roleName: 'Função', muscleGroup: 'Grupo muscular', level: 'Nível',
  weight: 'Peso (kg)', height: 'Altura (m)', bmi: 'IMC', bodyFatPercent: 'Gordura corporal (%)', notes: 'Observações',
  weekday: 'Dia', startTime: 'Início', endTime: 'Fim', capacity: 'Vagas', quantity: 'Quantidade',
  type: 'Tipo', result: 'Resultado', reason: 'Motivo', amount: 'Valor', balance: 'Saldo', initialBalance: 'Saldo inicial',
  paymentMethod: 'Pagamento', dueDate: 'Vencimento', paidAt: 'Pagamento em', createdAt: 'Criado em',
  expiresAt: 'Expiração', nextBillingAt: 'Próxima cobrança', currentPeriodEnd: 'Fim do ciclo', trialEndsAt: 'Fim do teste',
  nextStep: 'Próxima etapa', completedSteps: 'Etapas concluídas', trialStatus: 'Teste grátis', subscriptionStatus: 'Assinatura',
  featureKey: 'Recurso', featureEnabled: 'Habilitado', limitValue: 'Limite', policyValues: 'Opções',
  provider: 'Provedor', title: 'Título', durationSeconds: 'Duração (s)', views: 'Visualizações', total: 'Total',
};
const words: Record<string, string> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Vencido', CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado', SUSPENDED: 'Suspenso', DRAFT: 'Rascunho', APPROVED: 'Aprovado', PENDING_REVIEW: 'Aguardando revisão',
  TRIALING: 'Em teste', EXPIRED: 'Expirado', NOT_STARTED: 'Não iniciado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído',
  ACADEMY_PROFILE: 'Perfil da academia', EQUIPMENT_INVENTORY: 'Inventário', TEAM_REVIEW: 'Equipe', FINISH: 'Finalização',
  OWNER: 'Proprietário', MANAGER: 'Gerente', TRAINER: 'Professor', RECEPTION: 'Recepção', STUDENT: 'Aluno',
  CASH: 'Caixa', BANK: 'Banco', ALLOWED: 'Permitido', DENIED: 'Negado', CHECKED_IN: 'Presença confirmada',
};
function valueText(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (['amount', 'balance', 'initialBalance'].includes(key)) return money(value);
  if (key === 'weekday' && typeof value === 'number') return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][value] ?? '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/(At|Date|PeriodEnd)$/.test(key) && /^\d{4}-\d{2}-\d{2}/.test(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
    return words[value] ?? value;
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.map(item => words[item] ?? item).join(', ') || 'Nenhuma';
  return null;
}
export function RecordList({ rows, empty = 'Nenhum registro encontrado.' }: { rows: Record<string, any>[]; empty?: string }) {
  if (!rows.length) return <Text style={styles.muted}>{empty}</Text>;
  return <View>{rows.map((row, index) => {
    const title = [row.name, row.user?.name, row.student?.user?.name, row.title, row.planName, row.description, row.email].find(value => typeof value === 'string' && value.length) ?? `Registro ${index + 1}`;
    const details = Object.entries(labels).flatMap(([key, label]) => {
      const text = valueText(key, row[key] ?? (key === 'email' || key === 'phone' ? row.user?.[key] : undefined));
      return text !== null ? [{ key, label, text }] : [];
    });
    return <View key={String(row.id ?? index)} style={styles.row}><Text style={styles.title}>{title}</Text><View style={styles.details}>{details.map(detail => <View key={detail.key} style={styles.detail}><Text style={styles.label}>{detail.label}</Text><Text selectable style={styles.value}>{detail.text}</Text></View>)}</View>{!details.length && title === `Registro ${index + 1}` && <Text style={styles.muted}>Sem detalhes disponíveis.</Text>}</View>;
  })}</View>;
}
const styles = StyleSheet.create({
  row: { backgroundColor: iron.base, borderWidth: 1, borderColor: iron.line, borderRadius: 14, padding: 18, marginBottom: 10 },
  title: { color: iron.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  detail: { minWidth: 120, flexBasis: 180, flexGrow: 1 },
  label: { color: iron.muted, fontSize: 11, marginBottom: 5 },
  value: { color: iron.text, fontSize: 13, lineHeight: 19 },
  muted: { color: iron.muted, fontSize: 13, lineHeight: 20 },
});
