import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { brlFromMinor, positiveBrlToMinor } from '../utils/academy-money';

type Plan = { id: string; name: string; amount: number; intervalMonths: number; active: boolean };
const methods: Record<string, string> = { CASH: 'Dinheiro', PIX: 'Pix recebido na maquininha', CREDIT_CARD: 'Crédito na maquininha', DEBIT_CARD: 'Débito na maquininha' };
function Action({ id, label, onPress, disabled = false }: { id?: string; label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity testID={id} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function Input({ id, label, value, onChange }: { id?: string; label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.muted}>{label}</Text><TextInput testID={id} accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChange} /></View>;
}
function localDay() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dayRange(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Informe uma data válida: AAAA-MM-DD.');
  const from = new Date(`${day}T00:00:00`), to = new Date(from); to.setDate(to.getDate() + 1);
  if (!Number.isFinite(from.getTime())) throw new Error('Data inválida.');
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}
function requestKey() {
  return globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16); return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function ReceptionDesk({ students }: { students: any[] }) {
  const [catalog, setCatalog] = useState<{ enabled: boolean; plans: Plan[] } | null>(null);
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [charges, setCharges] = useState<any[] | null>(null);
  const [planId, setPlanId] = useState('');
  const [dueDate, setDueDate] = useState(localDay);
  const [method, setMethod] = useState('CASH');
  const [confirmed, setConfirmed] = useState(false);
  const [day, setDay] = useState(localDay);
  const [closing, setClosing] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const studentLookup = useRef(0);
  const attempt = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    let live = true;
    Promise.all([api('/reception/catalog'), api(`/reception/closing?${dayRange(localDay())}`)]).then(([current, report]) => {
      if (live) { setCatalog(current); setClosing(report); }
    }).catch(reason => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, []);
  async function selectStudent(id: string) {
    const lookup = ++studentLookup.current;
    setStudentId(id); setConfirmed(false); setCharges(null); setError('');
    try { const current = await api(`/reception/students/${id}/charges`); if (lookup === studentLookup.current) setCharges(current); }
    catch (reason) { if (lookup === studentLookup.current) setError((reason as Error).message); }
  }
  async function receive(chargeId: string) {
    if (busy || !confirmed || !catalog?.enabled) return;
    setBusy(true); setError(''); setNotice('');
    const fingerprint = JSON.stringify({ chargeId, method });
    if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: requestKey() };
    try {
      const result = await api(`/reception/charges/${chargeId}/receive`, undefined, { method: 'POST', body: JSON.stringify({ requestId: attempt.current.key, paymentMethod: method, receivedConfirmed: true }) });
      if (!result?.id || result.charge?.status !== 'PAID') throw new Error('Recebimento não confirmado. Consulte o caixa.');
      setNotice(`Mensalidade de ${brlFromMinor(result.charge.amount)} recebida.`); setConfirmed(false);
      attempt.current = { fingerprint: '', key: '' };
      setCharges(await api(`/reception/students/${studentId}/charges`));
      setClosing(await api(`/reception/closing?${dayRange(day)}`));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (busy || !catalog?.enabled || !studentId || !planId || !confirmed) return;
    setBusy(true); setError(''); setNotice('');
    const fingerprint = JSON.stringify({ studentId, planId, dueDate, method });
    if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: requestKey() };
    try {
      const result = await api('/reception/enroll', undefined, { method: 'POST', body: JSON.stringify({ requestId: attempt.current.key, studentId, planId, dueDate, paymentMethod: method, receivedConfirmed: true }) });
      if (!result?.id || result.charge?.status !== 'PAID') throw new Error('Resposta sem confirmação do recebimento. Confira o caixa antes de tentar novamente.');
      setNotice(`Matrícula confirmada e recebimento de ${brlFromMinor(result.charge.amount)} registrado.`);
      setConfirmed(false);
      attempt.current = { fingerprint: '', key: '' };
      setClosing(await api(`/reception/closing?${dayRange(day)}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha no recebimento.'); }
    finally { setBusy(false); }
  }
  const matches = students.filter(student => `${student.name ?? student.user?.name ?? ''} ${student.email ?? ''} ${student.cpf ?? ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30);
  return <View style={styles.panel} testID="reception-desk">
    <Text style={styles.title}>Matrícula e caixa de balcão</Text>
    <Text style={styles.muted}>Recebimento presencial confirmado. Não informe dados do cartão. A gestão financeira e os estornos permanecem com o proprietário.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text testID="desk-success" style={styles.notice}>{notice}</Text> : null}
    {!catalog ? <Text style={styles.muted}>Consultando autorização do caixa…</Text> : !catalog.enabled ? <Text style={styles.notice}>Caixa desabilitado. O proprietário precisa autorizar a operação e selecionar a conta em Financeiro.</Text> : <>
      <Input id="desk-search" label="Buscar aluno por nome, e-mail ou CPF" value={search} onChange={setSearch} />
      <View style={styles.options}>{matches.map(student => <Action key={student.id} id={`desk-student-${student.id}`} label={`${studentId === student.id ? '✓ ' : ''}${student.name ?? student.user?.name ?? 'Aluno'}`} onPress={() => void selectStudent(student.id)} disabled={busy} />)}</View>
      <Text style={styles.subtitle}>Plano da academia</Text>
      <View style={styles.options}>{catalog.plans.map(plan => <Action key={plan.id} id={`desk-plan-${plan.id}`} label={`${planId === plan.id ? '✓ ' : ''}${plan.name} · ${brlFromMinor(plan.amount)} · ${plan.intervalMonths} mês(es)`} onPress={() => { setPlanId(plan.id); setConfirmed(false); }} disabled={busy} />)}</View>
      {!catalog.plans.length ? <Text style={styles.muted}>O proprietário ainda não cadastrou planos de balcão.</Text> : null}
      <Input id="desk-due" label="Vencimento inicial (AAAA-MM-DD)" value={dueDate} onChange={setDueDate} />
      <View style={styles.options}>{Object.entries(methods).map(([key, label]) => <Action key={key} label={`${method === key ? '✓ ' : ''}${label}`} onPress={() => { setMethod(key); setConfirmed(false); }} disabled={busy} />)}</View>
      <Action id="desk-confirm" label={confirmed ? '✓ Recebimento presencial conferido' : 'Confirmo que o pagamento presencial foi recebido'} onPress={() => setConfirmed(value => !value)} disabled={busy} />
      {studentId && charges ? <View><Text style={styles.subtitle}>Mensalidades pendentes do aluno</Text>{charges.length ? charges.map(charge => <View key={charge.id}><Text style={styles.text}>{brlFromMinor(charge.amount)} · vencimento {charge.dueDate ? String(charge.dueDate).slice(0, 10) : 'não informado'}</Text>{charge.gatewayRequestId ? <Text style={styles.muted}>Pagamento vinculado ao gateway: aguarde a confirmação do provedor.</Text> : <Action id={`desk-receive-${charge.id}`} label="Registrar recebimento desta mensalidade" onPress={() => void receive(charge.id)} disabled={busy || !confirmed} />}</View>) : <Text style={styles.muted}>Nenhuma mensalidade pendente.</Text>}</View> : null}
      <Action id="desk-enroll" label={busy ? 'Registrando…' : 'Matricular e registrar recebimento'} onPress={() => void submit()} disabled={busy || !studentId || !planId || !confirmed} />
    </>}
    <Text style={styles.subtitle}>Meu fechamento diário</Text>
    <Text style={styles.muted}>Somente seus recebimentos, no dia e fuso horário deste dispositivo. Um estorno deixa de compor o total recebido.</Text>
    <Input label="Dia (AAAA-MM-DD)" value={day} onChange={setDay} />
    <Action label="Consultar meu caixa" onPress={() => { setError(''); setClosing(null); try { void api(`/reception/closing?${dayRange(day)}`).then(setClosing).catch(reason => setError(reason.message)); } catch (reason) { setError((reason as Error).message); } }} disabled={busy} />
    {closing ? <View testID="desk-closing"><Text style={styles.title}>{brlFromMinor(closing.totalMinor)}</Text><Text style={styles.muted}>{closing.count} registro(s) do operador atual</Text>{Object.entries(closing.byMethod as Record<string, number>).map(([key, value]) => <Text key={key} style={styles.text}>{methods[key] ?? key}: {brlFromMinor(value)}</Text>)}{closing.receipts.map((row: any) => <Text key={row.id} style={styles.muted}>{row.studentName} · {brlFromMinor(row.charge.amount)} · {row.charge.status === 'PAID' ? 'Recebido' : 'Revisar situação'}</Text>)}</View> : null}
  </View>;
}

export function ReceptionDeskAdmin({ accounts }: { accounts: any[] }) {
  const [settings, setSettings] = useState<any>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(1);
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; api('/reception/admin/settings').then(value => { if (live) { setSettings(value); setAccountId(value.policy?.accountId ?? ''); } }).catch(reason => { if (live) setError(reason.message); }); return () => { live = false; }; }, []);
  async function change(path: string, body: any, method = 'POST') {
    if (busy) return; setBusy(true); setError('');
    try { await api(path, undefined, { method, body: JSON.stringify(body) }); setSettings(await api('/reception/admin/settings')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha na configuração.'); }
    finally { setBusy(false); }
  }
  const minor = positiveBrlToMinor(amount);
  return <View style={styles.panel} testID="desk-admin"><Text style={styles.title}>Operação autorizada de balcão</Text><Text style={styles.muted}>Somente o proprietário autoriza a conta e os planos. Ativar o balcão não libera o financeiro administrativo para a recepção.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.options}>{accounts.map(account => <Action key={account.id} id={`desk-account-${account.id}`} label={`${accountId === account.id ? '✓ ' : ''}${account.name}`} onPress={() => setAccountId(account.id)} disabled={busy} />)}</View>
    <Action id="desk-enable" label={settings?.policy?.enabled ? 'Desabilitar caixa de balcão' : 'Autorizar caixa de balcão'} disabled={busy || !accountId || !settings} onPress={() => void change('/reception/admin/policy', { accountId, enabled: !settings.policy?.enabled })} />
    <Input id="desk-plan-name" label="Nome do plano da academia" value={name} onChange={setName} />
    <Input id="desk-plan-price" label="Valor do plano (R$)" value={amount} onChange={setAmount} />
    <View style={styles.options}>{[1, 3, 6, 12].map(value => <Action key={value} label={`${months === value ? '✓ ' : ''}${value} mês(es)`} onPress={() => setMonths(value)} disabled={busy} />)}</View>
    <Action id="desk-create-plan" label="Cadastrar plano de balcão" disabled={busy || name.trim().length < 2 || minor === null} onPress={() => { if (minor !== null) void change('/reception/admin/plans', { name: name.trim(), amount: minor, intervalMonths: months }); }} />
    {settings?.plans?.map((plan: Plan) => <View key={plan.id}><Text style={styles.text}>{plan.name} · {brlFromMinor(plan.amount)} · {plan.intervalMonths} mês(es)</Text><Action label={plan.active ? 'Desativar plano' : 'Ativar plano'} onPress={() => void change(`/reception/admin/plans/${plan.id}`, { active: !plan.active }, 'PATCH')} disabled={busy} /></View>)}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 18, gap: 12, backgroundColor: '#0b1629', borderRadius: 16, borderColor: '#213752', borderWidth: 1, marginBottom: 16 }, title: { color: '#f8fafc', fontSize: 21, fontWeight: '700' }, subtitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '600' }, text: { color: '#e2e8f0' }, muted: { color: '#94a3b8', fontSize: 13 }, field: { gap: 5 }, input: { color: '#f8fafc', backgroundColor: '#101f35', borderColor: '#314a68', borderWidth: 1, borderRadius: 9, padding: 11 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { borderRadius: 8, backgroundColor: '#174b85', padding: 11, alignSelf: 'flex-start' }, buttonText: { color: '#eff6ff', fontWeight: '600' }, disabled: { opacity: 0.45 }, error: { color: '#fca5a5' }, notice: { color: '#93c5fd' } });
