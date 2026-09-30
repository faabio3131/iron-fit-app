import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IronInput as TextInput } from '../components/IronInput';

type FinancialWorkspaceProps = {
  students: any[];
  accounts: any[];
  subscriptions: any[];
  charges: any[];
  overdueCharges: any[];
  transactions: any[];
  saving: boolean;
  onCreateAccount: (payload: {
    name: string;
    type: string;
    initialBalance: number;
  }) => Promise<void>;
  onCreateSubscription: (payload: {
    studentId: string;
    planName: string;
    amount: number;
    nextBillingAt?: string;
  }) => Promise<void>;
  onCreateCharge: (payload: {
    studentId: string;
    amount: number;
    dueDate: string;
    paymentMethod?: string;
  }) => Promise<void>;
  onPayCharge: (chargeId: string, payload: {
    accountId: string;
    paymentMethod?: string;
  }) => Promise<void>;
};

type FinancialTab = 'overview' | 'charges' | 'subscriptions' | 'history' | 'accounts';

const chargeStatusOptions = [
  { id: 'ALL', label: 'Todas' },
  { id: 'PENDING', label: 'Em aberto' },
  { id: 'PAID', label: 'Pagas' },
  { id: 'FAILED', label: 'Falhas' },
  { id: 'CANCELED', label: 'Canceladas' },
  { id: 'REFUNDED', label: 'Estornadas' },
];

const subscriptionStatusOptions = [
  { id: 'ALL', label: 'Todos' },
  { id: 'ACTIVE', label: 'Ativos' },
  { id: 'PAST_DUE', label: 'Em atraso' },
  { id: 'PAUSED', label: 'Pausados' },
  { id: 'CANCELED', label: 'Cancelados' },
];

const chargeStatusLabels: Record<string, string> = {
  PENDING: 'Em aberto',
  PROCESSING: 'Processando',
  PAID: 'Pago',
  FAILED: 'Falhou',
  CANCELED: 'Cancelado',
  EXPIRED: 'Expirado',
  REFUNDED: 'Estornado',
};

const subscriptionStatusLabels: Record<string, string> = {
  TRIALING: 'Teste',
  ACTIVE: 'Ativo',
  PAST_DUE: 'Em atraso',
  PAUSED: 'Pausado',
  CANCELED: 'Cancelado',
};

const transactionStatusLabels: Record<string, string> = {
  PLANNED: 'Planejado',
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELED: 'Cancelado',
};

function money(value: unknown) {
  const minor = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(minor) ? minor / 100 : 0);
}

function toMinorUnits(value: string) {
  const raw = value.trim().replace(/^R\$\s*/i, '');
  if (!raw) return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function dateLabel(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function studentName(student: any) {
  return student?.user?.name ?? student?.name ?? student?.user?.email ?? student?.email ?? 'Aluno';
}

function chargeStudentName(charge: any, students: any[]) {
  return charge?.student?.user?.name
    ?? charge?.student?.name
    ?? students.find((student) => student.id === charge?.studentId)?.user?.name
    ?? students.find((student) => student.id === charge?.studentId)?.name
    ?? 'Aluno';
}

function transactionStudentName(transaction: any, students: any[]) {
  return students.find((student) => student.id === transaction?.studentId)?.user?.name
    ?? students.find((student) => student.id === transaction?.studentId)?.name
    ?? 'Aluno';
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={numeric ? 'numeric' : 'default'}
      placeholder={placeholder}
      placeholderTextColor="#71879e"
    />
  </View>;
}

function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return <TouchableOpacity
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    style={[styles.chip, selected && styles.chipActive]}
    onPress={onPress}
  >
    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>;
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return <TouchableOpacity
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    style={[styles.primaryButton, disabled && styles.disabled]}
    onPress={onPress}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </TouchableOpacity>;
}

export function FinancialWorkspace({
  students,
  accounts,
  subscriptions,
  charges,
  overdueCharges,
  transactions,
  saving,
  onCreateAccount,
  onCreateSubscription,
  onCreateCharge,
  onPayCharge,
}: FinancialWorkspaceProps) {
  const [tab, setTab] = useState<FinancialTab>('overview');
  const [studentFilter, setStudentFilter] = useState('');
  const [chargeStatus, setChargeStatus] = useState('ALL');
  const [subscriptionStatus, setSubscriptionStatus] = useState('ALL');
  const [historyAccount, setHistoryAccount] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [accountDraft, setAccountDraft] = useState({
    name: '',
    type: 'BANK',
    initialBalance: '',
  });
  const [subscriptionDraft, setSubscriptionDraft] = useState({
    studentId: '',
    planName: '',
    amount: '',
    nextBillingAt: '',
  });
  const [chargeDraft, setChargeDraft] = useState({
    studentId: '',
    amount: '',
    dueDate: '',
    paymentMethod: 'PIX',
  });

  const overdueIds = useMemo(
    () => new Set(overdueCharges.map((charge) => charge.id)),
    [overdueCharges],
  );

  const paidIncome = useMemo(
    () => transactions
      .filter((transaction) => transaction.status === 'PAID' && transaction.type === 'INCOME')
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0),
    [transactions],
  );

  const pendingAmount = useMemo(
    () => charges
      .filter((charge) => charge.status === 'PENDING')
      .reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0),
    [charges],
  );

  const overdueAmount = useMemo(
    () => overdueCharges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0),
    [overdueCharges],
  );

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status === 'ACTIVE').length,
    [subscriptions],
  );

  const filteredCharges = useMemo(
    () => charges.filter((charge) => {
      if (studentFilter && charge.studentId !== studentFilter) return false;
      if (chargeStatus !== 'ALL' && charge.status !== chargeStatus) return false;
      return true;
    }),
    [chargeStatus, charges, studentFilter],
  );

  const filteredSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => {
      if (studentFilter && subscription.studentId !== studentFilter) return false;
      if (subscriptionStatus !== 'ALL' && subscription.status !== subscriptionStatus) return false;
      return true;
    }),
    [studentFilter, subscriptionStatus, subscriptions],
  );

  const filteredTransactions = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('pt-BR');
    return transactions.filter((transaction) => {
      if (studentFilter && transaction.studentId !== studentFilter) return false;
      if (historyAccount && transaction.accountId !== historyAccount) return false;
      if (!query) return true;
      const haystack = [
        transaction.description,
        transaction.paymentMethod,
        transaction.status,
        transaction.account?.name,
        transactionStudentName(transaction, students),
      ].join(' ').toLocaleLowerCase('pt-BR');
      return haystack.includes(query);
    });
  }, [historyAccount, historySearch, studentFilter, students, transactions]);

  const accountInitialBalance = toMinorUnits(accountDraft.initialBalance);
  const subscriptionAmount = toMinorUnits(subscriptionDraft.amount);
  const chargeAmount = toMinorUnits(chargeDraft.amount);

  const studentFilterRow = <ScrollView horizontal contentContainerStyle={styles.chipRow}>
    <Chip label="Todos os alunos" selected={!studentFilter} onPress={() => setStudentFilter('')} />
    {students.map((student) => <Chip
      key={student.id}
      label={studentName(student)}
      selected={studentFilter === student.id}
      onPress={() => setStudentFilter(student.id)}
    />)}
  </ScrollView>;

  return <View testID="financial-workspace">
    <View style={styles.restrictedBanner}>
      <Text style={styles.restrictedTitle}>Financeiro da academia</Text>
      <Text style={styles.restrictedText}>
        Área administrativa protegida por reautenticação. Este módulo trata academia → aluno e permanece separado da Assinatura IRON.
      </Text>
    </View>

    <View style={styles.kpiGrid}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Recebido no histórico</Text>
        <Text style={styles.kpiValue}>{money(paidIncome)}</Text>
        <Text style={styles.kpiMeta}>{transactions.filter((item) => item.status === 'PAID').length} pagamentos</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Em aberto</Text>
        <Text style={styles.kpiValue}>{money(pendingAmount)}</Text>
        <Text style={styles.kpiMeta}>{charges.filter((item) => item.status === 'PENDING').length} cobranças</Text>
      </View>
      <View style={[styles.kpiCard, overdueCharges.length > 0 && styles.kpiAlert]}>
        <Text style={styles.kpiLabel}>Inadimplência</Text>
        <Text style={styles.kpiValue}>{money(overdueAmount)}</Text>
        <Text style={styles.kpiMeta}>{overdueCharges.length} cobranças vencidas</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Planos ativos</Text>
        <Text style={styles.kpiValue}>{activeSubscriptions}</Text>
        <Text style={styles.kpiMeta}>{subscriptions.length} planos no histórico</Text>
      </View>
    </View>

    <ScrollView horizontal contentContainerStyle={styles.tabs}>
      {[
        ['overview', 'Visão financeira'],
        ['charges', 'Cobranças'],
        ['subscriptions', 'Planos'],
        ['history', 'Histórico'],
        ['accounts', 'Contas'],
      ].map(([id, label]) => <Chip
        key={id}
        testID={`financial-tab-${id}`}
        label={label}
        selected={tab === id}
        onPress={() => setTab(id as FinancialTab)}
      />)}
    </ScrollView>

    {tab === 'overview' ? <View style={styles.twoColumns}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Inadimplência</Text>
        <Text style={styles.panelSubtitle}>Cobranças vencidas ainda pendentes.</Text>
        {overdueCharges.length ? overdueCharges.slice(0, 8).map((charge) => <View key={charge.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>{chargeStudentName(charge, students)}</Text>
            <Text style={styles.rowMeta}>Venceu em {dateLabel(charge.dueDate)} · {money(charge.amount)}</Text>
          </View>
          <Text style={styles.badgeAlert}>Em atraso</Text>
        </View>) : <Text style={styles.empty}>Nenhuma cobrança vencida.</Text>}
        {overdueCharges.length > 8 ? <Text style={styles.helper}>+ {overdueCharges.length - 8} cobranças em atraso</Text> : null}
        <TouchableOpacity accessibilityRole="button" onPress={() => { setChargeStatus('PENDING'); setTab('charges'); }}>
          <Text style={styles.link}>Abrir cobranças</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pagamentos recentes</Text>
        <Text style={styles.panelSubtitle}>Histórico financeiro materializado pelo backend.</Text>
        {transactions.length ? transactions.slice(0, 8).map((transaction) => <View key={transaction.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>{transactionStudentName(transaction, students)}</Text>
            <Text style={styles.rowMeta}>{transaction.description || 'Recebimento'} · {dateLabel(transaction.paidAt ?? transaction.createdAt)}</Text>
          </View>
          <Text style={styles.moneyPositive}>{money(transaction.amount)}</Text>
        </View>) : <Text style={styles.empty}>Nenhum pagamento registrado.</Text>}
        <TouchableOpacity accessibilityRole="button" onPress={() => setTab('history')}>
          <Text style={styles.link}>Ver histórico completo</Text>
        </TouchableOpacity>
      </View>
    </View> : null}

    {tab === 'charges' ? <View style={styles.workspace}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cobranças</Text>
        <Text style={styles.panelSubtitle}>Filtre, acompanhe vencimentos e registre pagamentos.</Text>
        {studentFilterRow}
        <View style={styles.chipRow}>
          {chargeStatusOptions.map((option) => <Chip
            key={option.id}
            label={option.label}
            selected={chargeStatus === option.id}
            onPress={() => setChargeStatus(option.id)}
          />)}
        </View>
        <Text style={styles.fieldLabel}>Conta para receber pagamento</Text>
        <ScrollView horizontal contentContainerStyle={styles.chipRow}>
          {accounts.map((account) => <Chip
            key={account.id}
            label={account.name ?? account.type ?? 'Conta'}
            selected={selectedPaymentAccount === account.id}
            onPress={() => setSelectedPaymentAccount(account.id)}
          />)}
        </ScrollView>
        <Field label="Meio de pagamento" value={paymentMethod} onChangeText={setPaymentMethod} />

        {filteredCharges.length ? filteredCharges.map((charge) => {
          const overdue = overdueIds.has(charge.id);
          return <View key={charge.id} style={styles.chargeCard}>
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{chargeStudentName(charge, students)}</Text>
                <Text style={styles.rowMeta}>
                  Vencimento {dateLabel(charge.dueDate)} · {charge.paymentMethod || 'Meio não informado'}
                </Text>
              </View>
              <View style={styles.amountBlock}>
                <Text style={styles.amount}>{money(charge.amount)}</Text>
                <Text style={overdue ? styles.badgeAlert : styles.badge}>
                  {overdue ? 'Em atraso' : (chargeStatusLabels[charge.status] ?? charge.status)}
                </Text>
              </View>
            </View>
            {charge.status !== 'PAID' && charge.status !== 'CANCELED' && charge.status !== 'REFUNDED' ? <PrimaryButton
              testID={`financial-pay-${charge.id}`}
              label={saving ? 'Registrando…' : 'Registrar pagamento'}
              disabled={saving || !selectedPaymentAccount}
              onPress={() => {
                void onPayCharge(charge.id, {
                  accountId: selectedPaymentAccount,
                  ...(paymentMethod.trim() ? { paymentMethod: paymentMethod.trim() } : {}),
                });
              }}
            /> : null}
          </View>;
        }) : <Text style={styles.empty}>Nenhuma cobrança encontrada.</Text>}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Nova cobrança</Text>
        <Text style={styles.panelSubtitle}>Crie uma cobrança para um aluno da academia.</Text>
        <Text style={styles.fieldLabel}>Aluno</Text>
        <View style={styles.chipRow}>
          {students.map((student) => <Chip
            key={student.id}
            label={studentName(student)}
            selected={chargeDraft.studentId === student.id}
            onPress={() => setChargeDraft((current) => ({ ...current, studentId: student.id }))}
          />)}
        </View>
        <Field label="Valor (R$)" value={chargeDraft.amount} numeric onChangeText={(amount) => setChargeDraft((current) => ({ ...current, amount }))} placeholder="149,90" />
        <Field label="Vencimento" value={chargeDraft.dueDate} onChangeText={(dueDate) => setChargeDraft((current) => ({ ...current, dueDate }))} placeholder="AAAA-MM-DD" />
        <Field label="Meio de pagamento" value={chargeDraft.paymentMethod} onChangeText={(paymentMethodValue) => setChargeDraft((current) => ({ ...current, paymentMethod: paymentMethodValue }))} />
        <PrimaryButton
          testID="financial-create-charge"
          label={saving ? 'Salvando…' : 'Criar cobrança'}
          disabled={saving || !chargeDraft.studentId || chargeAmount === null || chargeAmount <= 0 || !chargeDraft.dueDate.trim()}
          onPress={() => {
            if (chargeAmount === null) return;
            void onCreateCharge({
              studentId: chargeDraft.studentId,
              amount: chargeAmount,
              dueDate: chargeDraft.dueDate.trim(),
              ...(chargeDraft.paymentMethod.trim() ? { paymentMethod: chargeDraft.paymentMethod.trim() } : {}),
            });
          }}
        />
      </View>
    </View> : null}

    {tab === 'subscriptions' ? <View style={styles.workspace}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Planos dos alunos</Text>
        <Text style={styles.panelSubtitle}>Acompanhe situação, valor e próxima cobrança.</Text>
        {studentFilterRow}
        <View style={styles.chipRow}>
          {subscriptionStatusOptions.map((option) => <Chip
            key={option.id}
            label={option.label}
            selected={subscriptionStatus === option.id}
            onPress={() => setSubscriptionStatus(option.id)}
          />)}
        </View>
        {filteredSubscriptions.length ? filteredSubscriptions.map((subscription) => <View key={subscription.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>{subscription.student?.user?.name ?? chargeStudentName(subscription, students)}</Text>
            <Text style={styles.rowMeta}>
              {subscription.planName} · próxima cobrança {dateLabel(subscription.nextBillingAt)}
            </Text>
          </View>
          <View style={styles.amountBlock}>
            <Text style={styles.amount}>{money(subscription.amount)}</Text>
            <Text style={subscription.status === 'PAST_DUE' ? styles.badgeAlert : styles.badge}>
              {subscriptionStatusLabels[subscription.status] ?? subscription.status}
            </Text>
          </View>
        </View>) : <Text style={styles.empty}>Nenhum plano encontrado.</Text>}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Novo plano do aluno</Text>
        <Text style={styles.panelSubtitle}>Vincule um plano financeiro ao aluno.</Text>
        <Text style={styles.fieldLabel}>Aluno</Text>
        <View style={styles.chipRow}>
          {students.map((student) => <Chip
            key={student.id}
            label={studentName(student)}
            selected={subscriptionDraft.studentId === student.id}
            onPress={() => setSubscriptionDraft((current) => ({ ...current, studentId: student.id }))}
          />)}
        </View>
        <Field label="Nome do plano" value={subscriptionDraft.planName} onChangeText={(planName) => setSubscriptionDraft((current) => ({ ...current, planName }))} placeholder="Plano mensal" />
        <Field label="Valor (R$)" value={subscriptionDraft.amount} numeric onChangeText={(amount) => setSubscriptionDraft((current) => ({ ...current, amount }))} placeholder="149,90" />
        <Field label="Próxima cobrança" value={subscriptionDraft.nextBillingAt} onChangeText={(nextBillingAt) => setSubscriptionDraft((current) => ({ ...current, nextBillingAt }))} placeholder="AAAA-MM-DD" />
        <PrimaryButton
          testID="financial-create-subscription"
          label={saving ? 'Salvando…' : 'Criar plano do aluno'}
          disabled={saving || !subscriptionDraft.studentId || !subscriptionDraft.planName.trim() || subscriptionAmount === null || subscriptionAmount <= 0}
          onPress={() => {
            if (subscriptionAmount === null) return;
            void onCreateSubscription({
              studentId: subscriptionDraft.studentId,
              planName: subscriptionDraft.planName.trim(),
              amount: subscriptionAmount,
              ...(subscriptionDraft.nextBillingAt.trim() ? { nextBillingAt: subscriptionDraft.nextBillingAt.trim() } : {}),
            });
          }}
        />
      </View>
    </View> : null}

    {tab === 'history' ? <View style={styles.panel}>
      <Text style={styles.panelTitle}>Histórico financeiro</Text>
      <Text style={styles.panelSubtitle}>Pagamentos e transações do financeiro da academia.</Text>
      {studentFilterRow}
      <ScrollView horizontal contentContainerStyle={styles.chipRow}>
        <Chip label="Todas as contas" selected={!historyAccount} onPress={() => setHistoryAccount('')} />
        {accounts.map((account) => <Chip
          key={account.id}
          label={account.name ?? account.type ?? 'Conta'}
          selected={historyAccount === account.id}
          onPress={() => setHistoryAccount(account.id)}
        />)}
      </ScrollView>
      <Field label="Buscar no histórico" value={historySearch} onChangeText={setHistorySearch} placeholder="Aluno, descrição, conta ou meio de pagamento" />
      {filteredTransactions.length ? filteredTransactions.map((transaction) => <View key={transaction.id} style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{transaction.description || 'Transação financeira'}</Text>
          <Text style={styles.rowMeta}>
            {transactionStudentName(transaction, students)} · {transaction.account?.name ?? 'Sem conta'} · {dateLabel(transaction.paidAt ?? transaction.createdAt)}
          </Text>
          <Text style={styles.rowMeta}>{transaction.paymentMethod || 'Meio não informado'} · {transactionStatusLabels[transaction.status] ?? transaction.status}</Text>
        </View>
        <Text style={transaction.type === 'EXPENSE' ? styles.moneyNegative : styles.moneyPositive}>
          {transaction.type === 'EXPENSE' ? '− ' : '+ '}{money(transaction.amount)}
        </Text>
      </View>) : <Text style={styles.empty}>Nenhuma transação encontrada.</Text>}
    </View> : null}

    {tab === 'accounts' ? <View style={styles.workspace}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Contas financeiras</Text>
        <Text style={styles.panelSubtitle}>Contas disponíveis para registrar recebimentos da academia.</Text>
        {accounts.length ? accounts.map((account) => {
          const accountTotal = transactions
            .filter((transaction) => transaction.accountId === account.id && transaction.status === 'PAID')
            .reduce((sum, transaction) => sum + (transaction.type === 'EXPENSE' ? -Number(transaction.amount ?? 0) : Number(transaction.amount ?? 0)), 0);
          const current = Number(account.initialBalance ?? 0) + accountTotal;
          return <View key={account.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>{account.name}</Text>
              <Text style={styles.rowMeta}>{account.type} · saldo inicial {money(account.initialBalance)}</Text>
            </View>
            <Text style={styles.amount}>{money(current)}</Text>
          </View>;
        }) : <Text style={styles.empty}>Nenhuma conta financeira.</Text>}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Nova conta</Text>
        <Text style={styles.panelSubtitle}>Cadastre uma conta operacional da academia.</Text>
        <Field label="Nome da conta" value={accountDraft.name} onChangeText={(name) => setAccountDraft((current) => ({ ...current, name }))} placeholder="Conta principal" />
        <Field label="Tipo" value={accountDraft.type} onChangeText={(type) => setAccountDraft((current) => ({ ...current, type }))} placeholder="BANK" />
        <Field label="Saldo inicial (R$)" value={accountDraft.initialBalance} numeric onChangeText={(initialBalance) => setAccountDraft((current) => ({ ...current, initialBalance }))} placeholder="0,00" />
        <PrimaryButton
          testID="financial-create-account"
          label={saving ? 'Salvando…' : 'Criar conta'}
          disabled={saving || !accountDraft.name.trim() || accountInitialBalance === null}
          onPress={() => {
            if (accountInitialBalance === null) return;
            void onCreateAccount({
              name: accountDraft.name.trim(),
              type: accountDraft.type.trim() || 'BANK',
              initialBalance: accountInitialBalance,
            });
          }}
        />
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  restrictedBanner: { backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 12, padding: 11, marginBottom: 8 },
  restrictedTitle: { color: '#eef6ff', fontSize: 14, fontWeight: '900' },
  restrictedText: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 3 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  kpiCard: { flexGrow: 1, flexBasis: 220, minWidth: 180, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  kpiAlert: { borderColor: '#7f2d3a', backgroundColor: '#1a1018' },
  kpiLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { color: '#eef6ff', fontSize: 21, fontWeight: '900', marginTop: 5 },
  kpiMeta: { color: '#71879e', fontSize: 10, marginTop: 3 },
  tabs: { flexDirection: 'row', gap: 6, paddingBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 5 },
  chip: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#a9b9ca', fontSize: 10, fontWeight: '800' },
  chipTextActive: { color: '#eef6ff' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workspace: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  panel: { flexGrow: 1, flexBasis: 410, minWidth: 300, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  panelTitle: { color: '#eef6ff', fontSize: 15, fontWeight: '900' },
  panelSubtitle: { color: '#9aadc1', fontSize: 10, lineHeight: 15, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#17263a', paddingVertical: 8 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#dce9f6', fontSize: 11, fontWeight: '900' },
  rowMeta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 2 },
  amountBlock: { alignItems: 'flex-end', gap: 3 },
  amount: { color: '#eef6ff', fontSize: 12, fontWeight: '900' },
  moneyPositive: { color: '#bfdbfe', fontSize: 12, fontWeight: '900' },
  moneyNegative: { color: '#fecaca', fontSize: 12, fontWeight: '900' },
  badge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  badgeAlert: { color: '#fecaca', backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#7f2d3a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  field: { marginTop: 7 },
  fieldLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', marginBottom: 4, marginTop: 5 },
  input: { color: '#eef6ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  primaryButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9, marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 10 },
  helper: { color: '#8296ab', fontSize: 9, marginTop: 5 },
  link: { color: '#60a5fa', fontSize: 10, fontWeight: '900', marginTop: 8 },
  chargeCard: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, paddingHorizontal: 9, paddingBottom: 8, marginTop: 6 },
});
