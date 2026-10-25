import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { brlFromMinor } from '../utils/academy-money';

type Charge = {
  id: string; studentId?: string; amount?: number; status?: string;
  dueDate?: string | null; student?: { user?: { name?: string } };
};
type Account = { id: string; name?: string; active?: boolean };
type Props = {
  charges: Charge[]; accounts: Account[]; selectedAccountId: string;
  saving: boolean; onPay: (chargeId: string, accountId: string) => void;
};
function date(value?: string | null) {
  if (!value) return 'Não informado';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Não informado' : d.toLocaleDateString('pt-BR');
}
function recordedAmount(value?: number) { return brlFromMinor(value); }
const statusLabels: Record<string,string> = {
  PENDING: 'Pendente', PAID: 'Paga', CANCELED: 'Cancelada', CANCELLED: 'Cancelada',
};
function Btn({ label, onPress, disabled = false, testID, danger = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; danger?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress}
    disabled={disabled} style={[styles.button, danger && styles.danger, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </TouchableOpacity>;
}

export function AcademyChargesPanel({ charges, accounts, selectedAccountId, saving, onPay }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAccountId, setConfirmAccountId] = useState('');
  const account = accounts.find((item) => item.id === selectedAccountId && item.active !== false);
  const pendingCharge = charges.find((item) => item.id === confirmId && item.status === 'PENDING');
  const approved = Boolean(account && pendingCharge && confirmAccountId === account?.id);
  const rows = useMemo(() => charges.filter((item) => filter === 'ALL' || item.status === filter), [charges, filter]);
  function reset() { setConfirmId(null); setConfirmAccountId(''); }

  return <GlowCard style={styles.card}>
    <Text style={styles.title}>Cobranças da academia</Text>
    <Text style={styles.muted}>Academia → aluno. Recebimento manual gera lançamento financeiro e pode gerar registro fiscal. Não é o billing FM → academia.</Text>
    <View style={styles.filters}>
      <Btn testID="academy-charges-all" label="Todas" onPress={() => { reset(); setFilter('ALL'); }} />
      <Btn testID="academy-charges-pending" label="Pendentes" onPress={() => { reset(); setFilter('PENDING'); }} />
      <Btn testID="academy-charges-paid" label="Pagas" onPress={() => { reset(); setFilter('PAID'); }} />
    </View>
    {!account ? <Text style={styles.notice}>Selecione uma conta financeira ativa na seção Contas antes de registrar um recebimento.</Text> : null}
    {rows.length ? rows.slice(0, 150).map((item) => <View key={item.id} style={styles.row} testID={'academy-charge-' + item.id}>
      <Text style={styles.heading}>{item.student?.user?.name ?? 'Aluno'}</Text>
      <Text style={styles.muted}>Situação: {statusLabels[item.status ?? ''] ?? 'Não informada'} · Valor registrado: {recordedAmount(item.amount)} · Vencimento: {date(item.dueDate)}</Text>
      {item.status === 'PENDING' ? <Btn
        label="Registrar pagamento recebido" testID={'academy-charge-prepare-' + item.id}
        disabled={saving || !account} onPress={() => {
          setConfirmId(item.id);
          setConfirmAccountId(account?.id ?? '');
        }} /> : null}
      {confirmId === item.id && item.status !== 'PENDING' ? <Text style={styles.notice}>A cobrança já não está pendente. Consulte o estado atualizado.</Text> : null}
      {confirmId === item.id && pendingCharge ? <View style={styles.confirm} testID="academy-charge-confirmation">
        <Text style={styles.dangerTitle}>Confirmação obrigatória de recebimento</Text>
        <Text style={styles.muted}>Confirme somente se o pagamento realmente foi recebido e conferido fora desta tela.</Text>
        <Text style={styles.detail}>Aluno: {item.student?.user?.name ?? 'Aluno'}</Text>
        <Text style={styles.detail}>Valor registrado: {recordedAmount(item.amount)}</Text>
        <Text style={styles.detail}>Conta selecionada: {account?.name ?? 'Não selecionada'}</Text>
        <Text style={styles.notice}>Esta ação altera o estado da cobrança e pode gerar um encaminhamento fiscal. Não é um comando de checkout.</Text>
        {!approved ? <Text testID="academy-charge-account-changed" style={styles.notice}>A conta selecionada foi alterada ou está indisponível. Cancele e revise a operação.</Text> : null}
        <View style={styles.filters}>
          <Btn testID="academy-charge-confirm-pay" label={saving ? 'Registrando…' : 'Confirmar recebimento'} danger
            disabled={saving || !approved} onPress={() => {
              if (approved && account && pendingCharge) onPay(pendingCharge.id, account.id);
            }} />
          <Btn testID="academy-charge-cancel-pay" label="Cancelar" disabled={saving} onPress={reset} />
        </View>
      </View> : null}
    </View>) : <Text style={styles.muted}>Nenhuma cobrança corresponde ao filtro selecionado.</Text>}
    {rows.length > 150 ? <Text style={styles.muted}>Exibindo os 150 registros mais recentes. Utilize os filtros para refinar a lista.</Text> : null}
  </GlowCard>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  muted: { color: '#b0bfd2', fontSize: 12, lineHeight: 18 },
  notice: { color: '#f5c48b', fontSize: 12, lineHeight: 18 },
  heading: { color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  detail: { color: '#f2f8fd', fontSize: 12, fontWeight: '700' },
  row: { borderTopWidth: 1, borderColor: '#263748', paddingVertical: 12, gap: 7 },
  confirm: { backgroundColor: '#2a1b1c', borderWidth: 1, borderColor: '#975044', padding: 12, borderRadius: 10, gap: 7 },
  dangerTitle: { color: '#ffcab0', fontSize: 14, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: '#1f3b31', borderWidth: 1, borderColor: '#35694d', alignSelf: 'flex-start' },
  danger: { backgroundColor: '#ae443a', borderColor: '#e67b71' },
  buttonText: { fontSize: 12, fontWeight: '800', color: '#f2faf5' },
  disabled: { opacity: 0.45 },
});
