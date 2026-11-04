import { accessRequestKey as requestKey } from '../utils/access-request-key';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { api } from '../services/api';

type Student = { id: string; cpf?: string | null; photoUrl?: string | null; name?: string; user?: { name?: string } };
type Decision = { eventId: string; status: 'ALLOWED' | 'DENIED' | 'REVIEW'; allowed: boolean; denialReason: string | null; warning: string | null; occurredAt: string; student: { id: string; name: string; photoUrl?: string | null } | null };
export function ReceptionAccessTerminal({ students }: { students: Student[] }) {
  const [query, setQuery] = useState('');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Decision[]>([]);
  const pending = useRef<{ requestId: string; studentId?: string; qrToken?: string } | null>(null);
  const locked = useRef(false);
  const scanner = useRef<TextInput>(null);
  const decision = !busy && !error ? history[0] : null;
  const matches = query.trim() ? students.filter(student => [student.user?.name ?? student.name ?? '', student.cpf ?? '', student.id].some(value => value.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 8) : [];
  async function check(input?: { studentId?: string; qrToken?: string }) {
    if (locked.current) return;
    // After a lost response only the same canonical request can be retried.
    if (!pending.current && input) pending.current = { requestId: requestKey(), ...input };
    if (!pending.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result: Decision = await api('/access/terminal/check-in', undefined, { method: 'POST', body: JSON.stringify(pending.current) });
      setHistory(items => [result, ...items.filter(item => item.eventId !== result.eventId)].slice(0, 10));
      pending.current = null; setQr(''); setQuery('');
    } catch {
      setError('Decisão não confirmada. Repita a mesma consulta antes de registrar outra entrada.');
    } finally { locked.current = false; setBusy(false); scanner.current?.focus(); }
  }
  return <View style={styles.card} testID="reception-access-terminal">
    <Text style={styles.title}>Terminal da recepção</Text>
    <Text style={styles.help}>Consulte o aluno ou leia seu QR com o leitor USB em modo teclado. Uma decisão registrada não confirma giro de catraca.</Text>
    <TextInput ref={scanner} testID="terminal-qr" accessibilityLabel="Leitor QR da recepção" secureTextEntry autoCapitalize="none" autoCorrect={false}
      placeholder="Leia o QR e pressione Enter" placeholderTextColor="#94a3b8" value={qr} editable={!busy && !pending.current} onChangeText={setQr}
      onSubmitEditing={event => { const value = event.nativeEvent.text.trim(); if (value) void check({ qrToken: value }); }} style={styles.input} />
    <TouchableOpacity accessibilityRole="button" disabled={busy || !!pending.current || !qr.trim()} onPress={() => void check({ qrToken: qr.trim() })} style={styles.button}><Text style={styles.buttonText}>Consultar QR</Text></TouchableOpacity>
    <TextInput testID="terminal-search" accessibilityLabel="Nome, CPF ou matrícula para entrada" placeholder="Nome, CPF ou matrícula" placeholderTextColor="#94a3b8"
      value={query} editable={!busy && !pending.current} onChangeText={setQuery} style={styles.input} />
    {matches.map(student => <View style={styles.row} key={student.id}>
      {student.photoUrl ? <Image source={{ uri: student.photoUrl }} style={styles.photo} accessibilityLabel="Foto do aluno" /> : null}
      <Text style={styles.name}>{student.user?.name ?? student.name ?? 'Aluno'}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Consultar entrada de ' + (student.user?.name ?? student.name ?? 'aluno')}
        testID={'terminal-check-' + student.id} disabled={busy || !!pending.current} onPress={() => void check({ studentId: student.id })} style={styles.button}><Text style={styles.buttonText}>Consultar entrada</Text></TouchableOpacity>
    </View>)}
    {query.trim() && !matches.length ? <Text style={styles.help}>Nenhum aluno encontrado na listagem recebida desta academia.</Text> : null}
    {busy ? <ActivityIndicator color="#60a5fa" /> : null}
    {error ? <View><Text style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" testID="terminal-retry" disabled={busy} onPress={() => void check()} style={styles.button}><Text style={styles.buttonText}>Repetir consulta pendente</Text></TouchableOpacity></View> : null}
    {decision ? <View testID="terminal-decision" accessibilityLiveRegion="polite" style={[styles.result, decision.status === 'DENIED' ? styles.denied : decision.status === 'REVIEW' ? styles.warning : styles.allowed]}>
      {decision.student?.photoUrl ? <Image source={{ uri: decision.student.photoUrl }} style={styles.photo} accessibilityLabel="Foto do aluno consultado" /> : null}
      <Text style={styles.title}>{decision.status === 'DENIED' ? 'Entrada negada' : decision.status === 'REVIEW' ? 'Entrada permitida com aviso' : 'Entrada permitida'}</Text>
      <Text style={styles.name}>{decision.student?.name ?? 'Aluno não identificado'}</Text>
      <Text style={styles.help}>{decision.denialReason ?? decision.warning ?? 'Matrícula elegível segundo o backend.'}</Text>
      <Text style={styles.help}>Decisão registrada em {new Date(decision.occurredAt).toLocaleTimeString('pt-BR')}</Text>
    </View> : null}
    {history.length > 1 ? <Text style={styles.help}>Consultas confirmadas nesta sessão: {history.length}. O histórico completo permanece na Central de acessos.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#0b1729', padding: 20, borderRadius: 18, gap: 12, marginBottom: 20, borderWidth: 1, borderColor: '#234569' },
  title: { color: '#eef7ff', fontSize: 22, fontWeight: '800' }, help: { color: '#b9cbe0', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#365371', borderRadius: 10, padding: 12, color: '#eef7ff', backgroundColor: '#07111f' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, name: { color: '#eef7ff', fontSize: 17 },
  photo: { width: 72, height: 72, borderRadius: 12 }, button: { backgroundColor: '#155eac', borderRadius: 10, padding: 12 },
  buttonText: { color: '#fff', fontWeight: '700' }, result: { padding: 20, borderRadius: 14, borderWidth: 2, gap: 10 },
  allowed: { borderColor: '#34d399', backgroundColor: '#07352b' }, denied: { borderColor: '#fb7185', backgroundColor: '#401720' },
  warning: { borderColor: '#fbbf24', backgroundColor: '#3b2d0d' }, error: { color: '#fda4af' },
});
