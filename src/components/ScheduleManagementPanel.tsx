import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type Student = { id: string; name?: string | null; user?: { name?: string | null } };
type Slot = { id: string; weekday: number; startTime: string; endTime: string; capacity: number; active?: boolean };
type Booking = { id: string; status?: string; date?: string; studentId?: string; slotId?: string };
type Day = { day: number; label: string };
const days: Day[] = [
  { day: 0, label: 'Domingo' }, { day: 1, label: 'Segunda' }, { day: 2, label: 'Terça' },
  { day: 3, label: 'Quarta' }, { day: 4, label: 'Quinta' }, { day: 5, label: 'Sexta' },
  { day: 6, label: 'Sábado' },
];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function weekday(value: string) {
  return new Date(value + 'T00:00:00.000Z').getUTCDay();
}
function Action({ testID, label, disabled, selected, onPress }: {
  testID?: string; label: string; disabled?: boolean; selected?: boolean; onPress: () => void;
}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled, selected: !!selected }}
    disabled={disabled} onPress={onPress} style={[styles.button, selected && styles.active, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, selected && styles.selectedText]}>{label}</Text>
  </TouchableOpacity>;
}
function Field({ testID, label, value, onChangeText }: {
  testID: string; label: string; value: string; onChangeText: (text: string) => void;
}) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput testID={testID} accessibilityLabel={label} value={value} onChangeText={onChangeText}
      style={styles.input} placeholderTextColor="#8290a0" autoCapitalize="none" />
  </View>;
}

export function ScheduleManagementPanel({ students, slots, bookingDate, onDateChange, canManageSlots, onUpdated }: {
  students: Student[]; slots: Slot[]; bookingDate: string; onDateChange: (day: string) => void;
  canManageSlots: boolean; onUpdated: () => Promise<void> | void;
}) {
  const [weekdayValue, setWeekdayValue] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [capacity, setCapacity] = useState('10');
  const [studentId, setStudentId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const activeSlots = useMemo(() => slots.filter((slot) => slot.active !== false), [slots]);
  const selectedSlot = activeSlots.find((slot) => slot.id === slotId);
  const selectedStudent = students.find((student) => student.id === studentId);
  const dateValid = validDate(bookingDate);
  const weekdayMatches = dateValid && !!selectedSlot && weekday(bookingDate) === selectedSlot.weekday;
  const capacityNumber = Number(capacity);
  const slotValid = Number.isInteger(weekdayValue) && weekdayValue >= 0 && weekdayValue <= 6 &&
    timePattern.test(startTime) && timePattern.test(endTime) && startTime < endTime &&
    Number.isSafeInteger(capacityNumber) && capacityNumber >= 1;
  const bookingValid = Boolean(studentId && selectedStudent && selectedSlot && weekdayMatches && !busy);
  async function perform(task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setRefreshWarning('');
    try {
      await task();
      setNotice(success);
      try { await onUpdated(); }
      catch { setRefreshWarning('Operação registrada pelo IRON. A agenda não atualizou; consulte o calendário antes de repetir.'); }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registrar a operação.');
    } finally {
      setBusy(false);
    }
  }

  return <View testID="schedule-management-panel">
    {canManageSlots ? <GlowCard style={styles.card}>
      <Text style={styles.title}>Cadastrar horário recorrente</Text>
      <Text style={styles.muted}>Cadastre um horário real. A API verifica dia, intervalo, capacidade e academia vinculada à sessão.</Text>
      <Text style={styles.fieldLabel}>Dia da semana</Text>
      <View style={styles.chips}>
        {days.map((day) => <Action key={day.day} testID={'schedule-weekday-' + day.day}
          label={day.label} selected={weekdayValue === day.day} disabled={busy}
          onPress={() => setWeekdayValue(day.day)} />)}
      </View>
      <View style={styles.fields}>
        <Field testID="schedule-start" label="Início (HH:mm)" value={startTime} onChangeText={setStartTime} />
        <Field testID="schedule-end" label="Fim (HH:mm)" value={endTime} onChangeText={setEndTime} />
        <Field testID="schedule-capacity" label="Vagas" value={capacity} onChangeText={setCapacity} />
      </View>
      {!slotValid ? <Text testID="schedule-slot-validation" style={styles.warning}>Informe horários válidos, início antes do fim e capacidade inteira maior que zero.</Text> : null}
      <Action testID="schedule-create-slot" label="Criar horário" disabled={!slotValid || busy}
        onPress={() => { void perform(() => api('/schedule-slots', undefined, {
          method: 'POST', body: JSON.stringify({
            weekday: weekdayValue, startTime, endTime, capacity: capacityNumber, active: true,
          }),
        }), 'Horário registrado pelo IRON.'); }} />
    </GlowCard> : null}
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Agendar aluno</Text>
      <Text style={styles.muted}>Escolha aluno, horário ativo e data compatível. A disponibilidade e os conflitos são validados pelo servidor.</Text>
      <Text style={styles.fieldLabel}>Aluno</Text>
      <View style={styles.chips}>{students.map((student) =>
        <Action key={student.id} testID={'schedule-pick-student-' + student.id}
          label={(student.name || student.user?.name || 'Aluno') + (studentId === student.id ? ' ✓' : '')}
          selected={studentId === student.id} disabled={busy} onPress={() => setStudentId(student.id)} />)}</View>
      {!students.length ? <Text style={styles.warning}>Nenhum aluno cadastrado ou disponível para agendamento.</Text> : null}
      <Text style={styles.fieldLabel}>Horário ativo</Text>
      <View style={styles.chips}>{activeSlots.map((slot) => <Action key={slot.id}
        testID={'schedule-pick-slot-' + slot.id}
        label={(days[slot.weekday]?.label ?? 'Dia indisponível') + ' · ' + slot.startTime + '–' + slot.endTime}
        selected={slot.id === slotId} disabled={busy} onPress={() => setSlotId(slot.id)} />)}</View>
      {!activeSlots.length ? <Text style={styles.warning}>Nenhum horário ativo cadastrado para esta academia.</Text> : null}
      <Field testID="schedule-booking-date" label="Data (AAAA-MM-DD)" value={bookingDate}
        onChangeText={onDateChange} />
      {!dateValid && bookingDate ? <Text testID="schedule-invalid-date" style={styles.warning}>Informe uma data real no formato AAAA-MM-DD.</Text> : null}
      {dateValid && selectedSlot && !weekdayMatches ?
        <Text testID="schedule-weekday-mismatch" style={styles.warning}>A data escolhida não corresponde ao dia da semana do horário.</Text> : null}
      <Text style={styles.muted}>Você também pode escolher uma data no calendário acima.</Text>
      <Action testID="schedule-book" label={busy ? 'Registrando…' : 'Confirmar agendamento'}
        disabled={!bookingValid} onPress={() => { void perform(async () => {
          const result: Booking = await api('/schedules', undefined, {
            method: 'POST',
            body: JSON.stringify({ studentId, slotId, date: bookingDate + 'T00:00:00.000Z' }),
          });
          if (!result?.id || (result.status && result.status !== 'SCHEDULED')) {
            throw new Error('Agendamento retornou estado inesperado. Consulte a agenda antes de tentar novamente.');
          }
        }, 'Agendamento confirmado pelo IRON. Registre a presença no calendário quando o aluno chegar.'); }} />
      <Text style={styles.muted}>O check-in possui confirmação própria dentro do calendário operacional. Não é realizado ao agendar.</Text>
    </GlowCard>
    {busy ? <ActivityIndicator testID="schedule-saving" color="#2BF47A" /> : null}
    {error ? <Text style={styles.error} testID="schedule-operation-error">{error}</Text> : null}
    {notice ? <Text style={styles.success} testID="schedule-operation-success">{notice}</Text> : null}
    {refreshWarning ? <Text style={styles.warning} testID="schedule-refresh-warning">{refreshWarning}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 12 },
  title: { color: '#2BF47A', fontWeight: '800', fontSize: 17 },
  muted: { color: '#a8b9ce', fontSize: 12, lineHeight: 18 },
  fieldLabel: { color: '#edf4ff', fontWeight: '700', fontSize: 12 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, flexBasis: 155, gap: 5 },
  input: { backgroundColor: '#111827', color: '#f1f5f9', borderRadius: 9, borderWidth: 1, borderColor: '#334155', padding: 11, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  button: { borderRadius: 9, borderWidth: 1, borderColor: '#35543f', backgroundColor: '#163526',
    paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  active: { backgroundColor: '#2BF47A' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#f0fef3', fontSize: 12, fontWeight: '800' },
  selectedText: { color: '#04150b' },
  warning: { color: '#f5c48b', fontSize: 12, lineHeight: 18 },
  error: { color: '#fca5a5', backgroundColor: '#351b22', padding: 12, borderRadius: 10, fontSize: 12 },
  success: { color: '#2BF47A', fontSize: 12, fontWeight: '800' },
});
