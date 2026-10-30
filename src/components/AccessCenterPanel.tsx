import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type Student = { id: string; name?: string; user?: { name?: string } };
type Credential = {
  id: string; type?: string; status?: string; active?: boolean; expiresAt?: string | null;
  studentId?: string; student?: { user?: { name?: string } };
};
type Device = {
  id: string; name?: string; type?: string; protocol?: string; manufacturer?: string | null; model?: string | null;
  active?: boolean; lastSyncAt?: string | null; tokenRotatedAt?: string | null;
};
type Event = {
  id: string; allowed: boolean; occurredAt?: string; denialReason?: string | null;
  student?: { user?: { name?: string } }; device?: { name?: string };
};
type CredentialResponse = { credentialId?: string; qrToken?: string; type?: string };

function Action({ label, onPress, testID, disabled = false, secondary = false }: {
  label: string; onPress: () => void; testID?: string; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}
function formattedDate(value?: string | null) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleString('pt-BR');
}
function failure(reason: unknown) {
  if (reason instanceof Error && (reason as Error & { status?: number }).status === 403)
    return 'Você não possui permissão para esta operação.';
  return reason instanceof Error ? reason.message : 'Operação não concluída.';
}
function extractDate(value: string, boundary: 'from' | 'to') {
  if (!value.trim()) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const day = value.trim();
  const [year, month, date] = day.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1970 || month < 1 || month > 12 || date < 1 || date > monthDays[month - 1]) return null;
  return day + (boundary === 'from' ? 'T00:00:00.000Z' : 'T23:59:59.999Z');
}

export function AccessCenterPanel({
  students, credentials, devices, events, canManageDevices, canEnrollDevices = false, onUpdated,
}: {
  students: Student[];
  credentials: Credential[];
  devices: Device[];
  events: Event[];
  canManageDevices: boolean;
  canEnrollDevices?: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [oneTime, setOneTime] = useState<CredentialResponse | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [decision, setDecision] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<Event[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState('');
  const [eventFilterApplied, setEventFilterApplied] = useState(false);
  const [hardwareName, setHardwareName] = useState('');
  const [hardwareModel, setHardwareModel] = useState('');
  const [hardwareManufacturer, setHardwareManufacturer] = useState<'CONTROL_ID' | 'TOPDATA' | 'HENRY' | 'DIMEP'>('CONTROL_ID');
  const [hardwareBusy, setHardwareBusy] = useState(false);
  const [hardwareNotice, setHardwareNotice] = useState('');
  const [hardwareError, setHardwareError] = useState('');


  const studentMatches = students.filter((entry) => (entry.name ?? entry.user?.name ?? '').toLocaleLowerCase('pt-BR')
    .includes(studentSearch.toLocaleLowerCase('pt-BR'))).slice(0, 30);
  const displayedCredentials = credentials.filter((entry) => status === 'ALL' ||
    (status === 'ACTIVE' ? entry.status === 'ACTIVE' : entry.status !== 'ACTIVE'));
  const shownEvents = filteredEvents ?? events;
  const allowedCount = events.filter((event) => event.allowed === true).length;
  const deniedCount = events.filter((event) => event.allowed === false).length;

  async function issue() {
    if (!studentId || busy) return;
    const expiry = expiresAt.trim();
    if (expiry && Number.isNaN(new Date(expiry).getTime())) {
      setError('Informe uma data de expiração ISO válida ou deixe o campo vazio.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    setOneTime(null);
    try {
      const result: CredentialResponse = await api('/access/credentials', undefined, {
        method: 'POST',
        body: JSON.stringify({ studentId, type: 'QR_CODE', ...(expiry ? { expiresAt: expiry } : {}) }),
      });
      if (!result?.credentialId || !result.qrToken) {
        setError('A resposta não confirmou os dados da credencial. Consulte a lista antes de emitir novamente.');
        return;
      }
      setOneTime(result);
      setNotice('Credencial emitida. O código de acesso abaixo será exibido apenas nesta sessão da tela.');
      try {
        await onUpdated();
      } catch {
        setError('Credencial emitida, mas a lista não foi atualizada. Consulte as credenciais antes de repetir.');
      }
    } catch (reason) {
      setError(failure(reason));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (busy || pendingRevoke !== id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/access/credentials/' + encodeURIComponent(id) + '/revoke', undefined, { method: 'PATCH' });
      setPendingRevoke('');
      setNotice('Revogação registrada no backend.');
      try { await onUpdated(); } catch {
        setError('Revogação confirmada, mas a lista não pôde ser atualizada. Atualize antes de tentar outra ação.');
      }
    } catch (reason) { setError(failure(reason)); } finally { setBusy(false); }
  }
  async function consultEvents() {
    const parsedFrom = extractDate(from, 'from');
    const parsedTo = extractDate(to, 'to');
    if (parsedFrom === null || parsedTo === null || (from && to && from > to)) {
      setEventError('Informe um período válido no formato AAAA-MM-DD, com início anterior ao fim.');
      return;
    }
    setLoadingEvents(true); setEventError('');
    try {
      const params: string[] = [];
      if (decision !== 'ALL') params.push('allowed=' + encodeURIComponent(decision));
      if (parsedFrom) params.push('from=' + encodeURIComponent(parsedFrom));
      if (parsedTo) params.push('to=' + encodeURIComponent(parsedTo));
      const path = '/access/events' + (params.length ? '?' + params.join('&') : '');
      const result = await api(path);
      if (!Array.isArray(result)) throw new Error('O backend não retornou um histórico válido.');
      setFilteredEvents(result);
      setEventFilterApplied(true);
    } catch (reason) {
      setEventError(failure(reason));
      setFilteredEvents([]);
      setEventFilterApplied(true);
    } finally { setLoadingEvents(false); }
  }
  function resetFilters() {
    setDecision('ALL'); setFrom(''); setTo(''); setFilteredEvents(null); setEventError(''); setEventFilterApplied(false);
  }


  async function enrollHardware() {
    if (!canEnrollDevices || hardwareBusy || !hardwareName.trim() || !hardwareModel.trim()) return;
    setHardwareBusy(true);
    setHardwareError('');
    setHardwareNotice('');
    try {
      const result = await api('/access/devices', undefined, {
        method: 'POST',
        body: JSON.stringify({
          name: hardwareName.trim(),
          model: hardwareModel.trim(),
          manufacturer: hardwareManufacturer,
          type: 'QR_CODE',
        }),
      });
      if (!result?.id || result.active !== false) {
        setHardwareError('O dispositivo não foi confirmado como inativo. Atualize a lista antes de repetir.');
        return;
      }
      setHardwareName('');
      setHardwareModel('');
      setHardwareNotice('Dispositivo cadastrado em estado inativo. A liberação física requer instalação e homologação do conector.');
      try { await onUpdated(); } catch {
        setHardwareError('Cadastro confirmado, mas a listagem não atualizou. Atualize antes de repetir.');
      }
    } catch (reason) {
      const status = reason instanceof Error ? (reason as Error & { status?: number }).status : undefined;
      setHardwareError(status === 403 ? 'Ação restrita ao proprietário com reautenticação administrativa ativa.' : failure(reason));
    } finally {
      setHardwareBusy(false);
    }
  }
  return <View>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Central de acessos</Text>
      <Text style={styles.muted}>Credenciais, decisões e dispositivos da academia autenticada. A autorização de entrada física é sempre decidida pelo backend/dispositivo autorizado.</Text>
      <View style={styles.kpis}>
        <View style={styles.kpi}><Text style={styles.kpiValue}>{credentials.filter((c) => c.status === 'ACTIVE').length}</Text><Text style={styles.muted}>Credenciais ativas</Text></View>
        <View style={styles.kpi}><Text style={styles.kpiValue}>{allowedCount}</Text><Text style={styles.muted}>Autorizações permitidas (não comprovam passagem)</Text></View>
        <View style={styles.kpi}><Text style={styles.kpiValue}>{deniedCount}</Text><Text style={styles.muted}>Entradas negadas (histórico recebido)</Text></View>
      </View>
    </GlowCard>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Emitir credencial de aluno</Text>
      <Text style={styles.muted}>Credencial QR: o token só pode ser visualizado uma vez. Ele não será gravado no navegador e a academia não decide permissões de acesso pela interface.</Text>
      <TextInput accessibilityLabel="Buscar aluno" testID="access-student-search" value={studentSearch}
        onChangeText={setStudentSearch} style={styles.input} placeholder="Buscar aluno" placeholderTextColor="#8395ab" />
      <View style={styles.actions}>
        {studentMatches.map((student) => <Action key={student.id} testID={'access-student-' + student.id}
          secondary={studentId !== student.id} label={(student.name ?? student.user?.name ?? 'Aluno') + (studentId === student.id ? ' ✓' : '')}
          onPress={() => setStudentId(student.id)} disabled={busy} />)}
      </View>
      {!students.length ? <Text style={styles.muted}>Nenhum aluno disponível nesta academia.</Text> : null}
      <Text style={styles.label}>Expiração ISO (opcional)</Text>
      <TextInput accessibilityLabel="Expiração da credencial" testID="access-expiry" value={expiresAt}
        onChangeText={setExpiresAt} style={styles.input} placeholder="2026-12-31T23:59:59.000Z" placeholderTextColor="#8395ab" />
      <Action testID="access-credential-create" label={busy ? 'Emitindo…' : 'Emitir credencial QR'} disabled={!studentId || busy}
        onPress={() => { void issue(); }} />
      {oneTime?.qrToken ? <View style={styles.secret} testID="access-one-time-credential">
        <Text style={styles.warning}>Código de acesso confidencial — exibição única</Text>
        <Text selectable style={styles.secretText}>{oneTime.qrToken}</Text>
        <Action secondary testID="access-hide-token" label="Ocultar definitivamente" onPress={() => setOneTime(null)} />
      </View> : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}
      {error ? <Text testID="access-error" style={styles.error}>{error}</Text> : null}
    </GlowCard>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Credenciais dos alunos</Text>
      <View style={styles.actions}>
        <Action testID="access-credentials-all" label="Todas" secondary={status !== 'ALL'} onPress={() => setStatus('ALL')} />
        <Action testID="access-credentials-active" label="Ativas" secondary={status !== 'ACTIVE'} onPress={() => setStatus('ACTIVE')} />
        <Action testID="access-credentials-inactive" label="Inativas/expiradas" secondary={status !== 'INACTIVE'} onPress={() => setStatus('INACTIVE')} />
      </View>
      {displayedCredentials.slice(0, 100).map((credential) => <View key={credential.id} style={styles.entry}>
        <Text style={styles.entryTitle}>{credential.student?.user?.name ?? 'Aluno'}</Text>
        <Text style={styles.muted}>{credential.type === 'QR_CODE' ? 'Código QR' : credential.type ?? 'Credencial'} · {credential.status === 'ACTIVE' ? 'Ativa' : credential.status === 'EXPIRED' ? 'Expirada' : 'Inativa'} · Validade: {formattedDate(credential.expiresAt)}</Text>
        {credential.active && credential.status === 'ACTIVE' ? pendingRevoke === credential.id ? <View style={styles.actions}>
          <Text style={styles.warning}>Confirma a revogação desta credencial?</Text>
          <Action testID={'access-revoke-confirm-' + credential.id} label="Confirmar revogação"
            disabled={busy} onPress={() => { void revoke(credential.id); }} />
          <Action secondary label="Cancelar" disabled={busy} onPress={() => setPendingRevoke('')} />
        </View> : <Action secondary testID={'access-revoke-' + credential.id} label="Revogar credencial"
          disabled={busy} onPress={() => setPendingRevoke(credential.id)} /> : null}
      </View>)}
      {!displayedCredentials.length ? <Text style={styles.muted}>Nenhuma credencial com este filtro.</Text> : null}
      {displayedCredentials.length > 100 ? <Text style={styles.muted}>Exibindo as primeiras 100 credenciais. Refine o filtro ou consulte o histórico.</Text> : null}
    </GlowCard>
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Histórico de acessos</Text>
      <Text style={styles.muted}>Entradas e recusas registradas pelo sistema. Filtre por decisão ou período; a API mantém o isolamento por academia.</Text>
      <View style={styles.actions}>
        <Action label="Todos" secondary={decision !== 'ALL'} onPress={() => setDecision('ALL')} />
        <Action label="Permitidos" secondary={decision !== 'true'} onPress={() => setDecision('true')} />
        <Action label="Negados" secondary={decision !== 'false'} onPress={() => setDecision('false')} />
      </View>
      <View style={styles.actions}>
        <View style={styles.field}><Text style={styles.label}>De (AAAA-MM-DD)</Text>
          <TextInput testID="access-events-from" style={styles.input} value={from} onChangeText={setFrom} placeholderTextColor="#8395ab" placeholder="2026-10-01" /></View>
        <View style={styles.field}><Text style={styles.label}>Até (AAAA-MM-DD)</Text>
          <TextInput testID="access-events-to" style={styles.input} value={to} onChangeText={setTo} placeholderTextColor="#8395ab" placeholder="2026-10-31" /></View>
      </View>
      <View style={styles.actions}>
        <Action testID="access-events-filter" label="Aplicar filtros" disabled={loadingEvents} onPress={() => { void consultEvents(); }} />
        <Action secondary testID="access-events-clear" label="Limpar" disabled={loadingEvents} onPress={resetFilters} />
      </View>
      {loadingEvents ? <ActivityIndicator color="#2BF47A" /> : null}
      {eventError ? <Text testID="access-events-error" style={styles.error}>{eventError}</Text> : null}
      {eventFilterApplied ? <Text style={styles.muted}>Consulta filtrada · até 200 eventos recentes por consulta</Text> : null}
      {shownEvents.slice(0, 80).map((event) => <View key={event.id} testID={'access-event-' + event.id} style={styles.entry}>
        <Text style={[styles.entryTitle, event.allowed ? styles.allowed : styles.denied]}>{event.allowed ? 'Entrada permitida' : 'Entrada negada'}</Text>
        <Text style={styles.muted}>{event.student?.user?.name ?? 'Aluno não identificado'} · {event.device?.name ?? 'Dispositivo não identificado'} · {formattedDate(event.occurredAt)}</Text>
        {!event.allowed && event.denialReason ? <Text style={styles.warning}>Motivo: {event.denialReason}</Text> : null}
      </View>)}
      {!loadingEvents && !eventError && !shownEvents.length ? <Text style={styles.muted}>Nenhum evento registrado com os filtros atuais.</Text> : null}
      {shownEvents.length > 80 ? <Text style={styles.muted}>Exibindo os primeiros 80 eventos mais recentes.</Text> : null}
    </GlowCard>
    {canManageDevices ? <GlowCard style={styles.card}>
      <Text style={styles.title}>Dispositivos de acesso</Text>
      <Text style={styles.muted}>Inventário de dispositivos configurados. Sincronização não comprova integração física homologada. Tokens e chaves não são exibidos.</Text>
      {canEnrollDevices ? <View testID="access-hardware-enrollment" style={styles.entry}>
        <Text style={styles.entryTitle}>Cadastrar catraca</Text>
        <Text style={styles.muted}>O cadastro não ativa uma catraca. A ativação exige conector homologado e reautenticação administrativa.</Text>
        <View style={styles.actions}>
          {([
            ['CONTROL_ID', 'Control iD'],
            ['TOPDATA', 'Topdata'],
            ['HENRY', 'Henry'],
            ['DIMEP', 'DIMEP'],
          ] as const).map(([code, label]) => <Action
            key={code} testID={'access-hardware-brand-' + code}
            label={label}
            secondary={hardwareManufacturer !== code}
            disabled={hardwareBusy}
            onPress={() => setHardwareManufacturer(code)}
          />)}
        </View>
        <TextInput
          testID="access-hardware-name" accessibilityLabel="Nome da catraca"
          style={styles.input} value={hardwareName} onChangeText={setHardwareName}
          placeholder="Ex.: Entrada principal" placeholderTextColor="#8395ab"
        />
        <TextInput
          testID="access-hardware-model" accessibilityLabel="Modelo da catraca"
          style={styles.input} value={hardwareModel} onChangeText={setHardwareModel}
          placeholder="Ex.: iDBlock Next / Fit 4" placeholderTextColor="#8395ab"
        />
        <Action testID="access-hardware-create" label={hardwareBusy ? 'Cadastrando…' : 'Cadastrar dispositivo inativo'}
          disabled={hardwareBusy || !hardwareName.trim() || !hardwareModel.trim()}
          onPress={() => { void enrollHardware(); }} />
        {hardwareNotice ? <Text style={styles.success}>{hardwareNotice}</Text> : null}
        {hardwareError ? <Text testID="access-hardware-error" style={styles.error}>{hardwareError}</Text> : null}
      </View> : null}
      {devices.map((device) => <View key={device.id} testID={'access-device-' + device.id} style={styles.entry}>
        <Text style={styles.entryTitle}>{device.name ?? 'Dispositivo'}</Text>
        <Text style={styles.muted}>Fabricante: {device.manufacturer ?? 'Não informado'} · Modelo: {device.model ?? 'Não informado'} · Tipo: {device.type ?? 'Não informado'} · Protocolo: {device.protocol ?? 'Não informado'} · {device.active ? 'Ativo' : 'Inativo'}</Text>
        <Text style={styles.muted}>Última sincronização: {formattedDate(device.lastSyncAt)}</Text>
      </View>)}
      {!devices.length ? <Text style={styles.muted}>Nenhum dispositivo cadastrado.</Text> : null}
    </GlowCard> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  title: { color: '#2BF47A', fontSize: 18, fontWeight: '800' },
  muted: { color: '#aebdd1', fontSize: 12, lineHeight: 18 },
  label: { color: '#b9cbe0', fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexGrow: 1, flexBasis: 150, backgroundColor: '#121d29', borderRadius: 10, padding: 12, gap: 4 },
  kpiValue: { color: '#2BF47A', fontSize: 24, fontWeight: '900' },
  button: { backgroundColor: '#2BF47A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#04140b', fontWeight: '800', fontSize: 12 },
  secondary: { backgroundColor: '#192333', borderWidth: 1, borderColor: '#334155' },
  secondaryText: { color: '#dce9fa' },
  disabled: { opacity: 0.4 },
  input: { backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#334155', color: '#f8fafc', borderRadius: 9, padding: 10, minWidth: 175 },
  field: { flexGrow: 1, flexBasis: 175, gap: 5 },
  entry: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#273248', gap: 5 },
  entryTitle: { color: '#eff7ff', fontWeight: '800', fontSize: 14 },
  allowed: { color: '#2BF47A' },
  denied: { color: '#fda4af' },
  warning: { color: '#fbbf84', fontSize: 12 },
  error: { color: '#fca5a5', fontSize: 12 },
  success: { color: '#2BF47A', fontSize: 12 },
  secret: { backgroundColor: '#123024', borderWidth: 1, borderColor: '#2BF47A', borderRadius: 10, padding: 12, gap: 8 },
  secretText: { color: '#e5fff0', fontSize: 12 },
});