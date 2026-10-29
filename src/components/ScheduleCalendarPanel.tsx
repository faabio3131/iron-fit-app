import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { GlowCard } from './GlowCard';

type Slot = { id: string; weekday: number; startTime: string; endTime: string; capacity: number; active?: boolean };
type Booking = {
  id: string;
  date: string;
  status: string;
  student?: { user?: { name?: string | null } };
  slot?: Slot;
};

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Presença registrada',
  NO_SHOW: 'Não compareceu',
  CANCELED: 'Cancelado',
};

function localToday() {
  const now = new Date();
  const parts = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')];
  return parts.join('-');
}

function addDays(day: string, count: number) {
  const date = new Date(day + 'T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function firstDayOfWeek(day: string) {
  const date = new Date(day + 'T12:00:00.000Z');
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  return addDays(day, -daysFromMonday);
}

function weekday(day: string) {
  return new Date(day + 'T12:00:00.000Z').getUTCDay();
}

function dateLabel(day: string) {
  const date = new Date(day + 'T12:00:00.000Z');
  return String(date.getUTCDate()).padStart(2, '0') + '/' + String(date.getUTCMonth() + 1).padStart(2, '0');
}

function Action({ label, testID, onPress, selected, disabled }: {
  label: string; testID?: string; onPress: () => void; selected?: boolean; disabled?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }}
    testID={testID} onPress={onPress} disabled={disabled}
    style={[styles.action, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.actionText, selected && styles.selectedText]}>{label}</Text>
  </TouchableOpacity>;
}

export function ScheduleCalendarPanel({ slots, canCheckIn, onDateSelected, refreshToken = 0, initialDate }: {
  slots: Slot[];
  canCheckIn: boolean;
  onDateSelected: (date: string) => void;
  refreshToken?: number;
  initialDate?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate ?? localToday);
  const [mode, setMode] = useState<'day' | 'week'>('week');
  const [status, setStatus] = useState('ALL');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const weekStart = firstDayOfWeek(selectedDate);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekEnd = days[6];

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setLoading(true);
      setError('');
      try {
        const from = encodeURIComponent(weekStart + 'T00:00:00.000Z');
        const to = encodeURIComponent(weekEnd + 'T23:59:59.999Z');
        const response = await api('/schedules?from=' + from + '&to=' + to);
        if (!live) return;
        if (!Array.isArray(response)) throw new Error('A resposta da agenda não está no formato esperado.');
        setBookings(response);
      } catch (reason: unknown) {
        if (live) {
          setBookings([]);
          setError(reason instanceof Error ? reason.message : 'Não foi possível consultar os agendamentos.');
        }
      } finally {
        if (live) setLoading(false);
      }
    });
    return () => { live = false; };
  }, [weekStart, weekEnd, refreshToken, reloadKey]);

  const visibleBookings = bookings.filter((booking) =>
    typeof booking.date === 'string' &&
    booking.date.slice(0, 10) >= weekStart && booking.date.slice(0, 10) <= weekEnd &&
    (status === 'ALL' || booking.status === status));
  const dayBookings = (day: string) => visibleBookings
    .filter((booking) => booking.date.slice(0, 10) === day)
    .sort((left, right) => (left.slot?.startTime ?? '').localeCompare(right.slot?.startTime ?? ''));
  const daySlots = (day: string) => slots.filter((slot) => slot.active !== false && slot.weekday === weekday(day))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));

  function select(day: string) {
    setSelectedDate(day);
    onDateSelected(day);
  }

  async function checkIn(id: string) {
    if (!canCheckIn || busyId || confirmId !== id) return;
    setBusyId(id);
    setActionError('');
    try {
      await api('/schedules/' + encodeURIComponent(id) + '/check-in', undefined, { method: 'PATCH' });
      setConfirmId('');
      setReloadKey((current) => current + 1);
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível registrar a presença.');
    } finally {
      setBusyId('');
    }
  }

  function renderBookings(day: string) {
    const rows = dayBookings(day);
    return <View style={styles.dayContent}>
      {rows.map((booking) => <View key={booking.id} testID={'agenda-booking-' + booking.id} style={styles.booking}>
        <View style={styles.bookingTitle}>
          <Text style={styles.time}>{booking.slot?.startTime ?? 'Horário não informado'}</Text>
          <Text style={styles.student}>{booking.student?.user?.name ?? 'Aluno'}</Text>
        </View>
        <Text style={styles.muted}>{booking.slot?.startTime && booking.slot?.endTime ? booking.slot.startTime + '–' + booking.slot.endTime + ' · ' : ''}{statusLabels[booking.status] ?? 'Status não informado'}</Text>
        {canCheckIn && booking.status === 'SCHEDULED' ?
          confirmId === booking.id ? <View style={styles.actions}>
            <Text style={styles.muted}>Confirmar presença deste aluno?</Text>
            <Action testID={'agenda-confirm-checkin-' + booking.id} label={busyId ? 'Registrando…' : 'Confirmar check-in'}
              disabled={!!busyId} onPress={() => { void checkIn(booking.id); }} />
            <Action label="Voltar" disabled={!!busyId} onPress={() => setConfirmId('')} />
          </View> :
          <Action testID={'agenda-checkin-' + booking.id} label="Registrar presença" disabled={!!busyId}
            onPress={() => setConfirmId(booking.id)} /> : null}
      </View>)}
      {rows.length === 0 ? <Text style={styles.muted}>Nenhum agendamento com este filtro.</Text> : null}
      <Text style={styles.smallTitle}>Horários disponíveis no cadastro</Text>
      {daySlots(day).length ? daySlots(day).map((slot) =>
        <Text key={slot.id} style={styles.slot}>{slot.startTime}–{slot.endTime} · capacidade {slot.capacity}</Text>) :
        <Text style={styles.muted}>Nenhum horário recorrente cadastrado para este dia.</Text>}
    </View>;
  }

  return <GlowCard style={styles.card}>
    <Text style={styles.heading}>Calendário operacional</Text>
    <Text style={styles.muted}>Agendamentos reais da academia, sem dados fictícios. Selecione um dia para preencher a data de uma nova reserva.</Text>
    <View style={styles.actions}>
      <Action testID="agenda-prev-week" label="Semana anterior" onPress={() => select(addDays(weekStart, -7))} />
      <Action testID="agenda-today" label="Hoje" onPress={() => select(localToday())} />
      <Action testID="agenda-next-week" label="Próxima semana" onPress={() => select(addDays(weekStart, 7))} />
      <Text style={styles.weekRange}>{dateLabel(weekStart)} a {dateLabel(weekEnd)}</Text>
    </View>
    <View style={styles.actions}>
      <Action testID="agenda-view-week" label="Semana" selected={mode === 'week'} onPress={() => setMode('week')} />
      <Action testID="agenda-view-day" label="Dia" selected={mode === 'day'} onPress={() => setMode('day')} />
      <Action label="Todos" selected={status === 'ALL'} onPress={() => setStatus('ALL')} />
      <Action label="Agendados" selected={status === 'SCHEDULED'} onPress={() => setStatus('SCHEDULED')} />
      <Action label="Check-ins" selected={status === 'CHECKED_IN'} onPress={() => setStatus('CHECKED_IN')} />
    </View>
    {actionError ? <Text testID="agenda-action-error" style={styles.error}>{actionError}</Text> : null}
    <View style={styles.weekGrid}>{days.map((day) => <TouchableOpacity key={day} accessibilityRole="button"
      accessibilityState={{ selected: selectedDate === day }} testID={'agenda-day-' + day}
      onPress={() => select(day)} style={[styles.dayButton, selectedDate === day && styles.daySelected]}>
      <Text style={[styles.dayLabel, selectedDate === day && styles.selectedText]}>{weekdays[weekday(day)]}</Text>
      <Text style={[styles.dayNumber, selectedDate === day && styles.selectedText]}>{dateLabel(day)}</Text>
      {!loading && !error ? <Text style={styles.dayCount}>{dayBookings(day).length} reserva(s)</Text> : null}
    </TouchableOpacity>)}</View>
    {loading ? <View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>Consultando agenda…</Text></View> : error ?
      <View testID="agenda-error" style={styles.errorBox}><Text style={styles.error}>{error}</Text>
        <Action testID="agenda-retry" label="Tentar novamente" onPress={() => setReloadKey((current) => current + 1)} />
      </View> : mode === 'day' ?
        <View testID="agenda-day-content"><Text style={styles.dayTitle}>{weekdays[weekday(selectedDate)]} · {dateLabel(selectedDate)}</Text>{renderBookings(selectedDate)}</View> :
        <View testID="agenda-week-content">{days.map((day) =>
          <View key={day} style={styles.weekDay}><Text style={styles.dayTitle}>{weekdays[weekday(day)]} · {dateLabel(day)}</Text>{renderBookings(day)}</View>)}</View>}
  </GlowCard>;
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '800', color: '#2BF47A' },
  muted: { color: '#a8b8ce', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  action: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start' },
  actionText: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  selected: { borderColor: '#2BF47A', backgroundColor: '#123524' },
  selectedText: { color: '#2BF47A' },
  disabled: { opacity: 0.5 },
  weekRange: { color: '#e2e8f0', fontWeight: '700', fontSize: 13 },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayButton: { flexGrow: 1, flexBasis: 92, minWidth: 82, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#293347', backgroundColor: '#111927', alignItems: 'center', gap: 4 },
  daySelected: { borderColor: '#2BF47A', backgroundColor: '#123524' },
  dayLabel: { color: '#94a3b8', fontSize: 12 },
  dayNumber: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  dayCount: { color: '#94a3b8', fontSize: 10 },
  loading: { padding: 22, alignItems: 'center', gap: 8 },
  errorBox: { gap: 8, padding: 12, borderRadius: 9, backgroundColor: '#301215' },
  error: { color: '#fca5a5', fontSize: 12 },
  dayContent: { gap: 8, paddingTop: 8 },
  dayTitle: { fontSize: 14, fontWeight: '800', color: '#d9e7f7' },
  weekDay: { borderTopWidth: 1, borderTopColor: '#273248', paddingTop: 12, gap: 5 },
  booking: { borderLeftWidth: 3, borderLeftColor: '#2BF47A', backgroundColor: '#111927', borderRadius: 8, padding: 11, gap: 6 },
  bookingTitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  time: { color: '#2BF47A', fontWeight: '800', fontSize: 13 },
  student: { color: '#f8fafc', fontWeight: '700', fontSize: 13 },
  smallTitle: { color: '#b9cbe0', fontWeight: '700', fontSize: 12, marginTop: 5 },
  slot: { color: '#94a3b8', fontSize: 12 },
});
