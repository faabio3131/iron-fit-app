import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IronInput as TextInput } from '../components/IronInput';

type ScheduleWorkspaceProps = {
  students: any[];
  slots: any[];
  bookings: any[];
  saving: boolean;
  canCreateSlot: boolean;
  canManageBookings: boolean;
  onCreateSlot: (payload: {
    weekday: number;
    startTime: string;
    endTime: string;
    capacity: number;
    active: true;
  }) => Promise<void>;
  onBook: (payload: {
    studentId: string;
    slotId: string;
    date: string;
  }) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
};

type CalendarMode = 'day' | 'week';
type StatusFilter = 'ALL' | 'SCHEDULED' | 'CHECKED_IN' | 'NO_SHOW' | 'CANCELED';

const weekdayLabels: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Check-in',
  NO_SHOW: 'Falta',
  CANCELED: 'Cancelado',
};

const statusOptions: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'SCHEDULED', label: 'Agendados' },
  { id: 'CHECKED_IN', label: 'Check-in' },
  { id: 'NO_SHOW', label: 'Faltas' },
  { id: 'CANCELED', label: 'Cancelados' },
];

function dateOnly(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateOnly(date);
}

function startOfWeek(value: string) {
  const date = parseDate(value);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return dateOnly(date);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parseDate(value));
}

function studentName(student: any) {
  return student?.user?.name ?? student?.name ?? student?.user?.email ?? student?.email ?? 'Aluno';
}

function bookingStudentName(booking: any) {
  return booking?.student?.user?.name ?? booking?.student?.name ?? booking?.studentId ?? 'Aluno';
}

function sameBookingDate(booking: any, day: string) {
  return String(booking?.date ?? '').slice(0, 10) === day;
}

export function ScheduleWorkspace({
  students,
  slots,
  bookings,
  saving,
  canCreateSlot,
  canManageBookings,
  onCreateSlot,
  onBook,
  onCheckIn,
}: ScheduleWorkspaceProps) {
  const today = useMemo(() => dateOnly(new Date()), []);
  const [mode, setMode] = useState<CalendarMode>('week');
  const [focusDate, setFocusDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [studentFilter, setStudentFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingDate, setBookingDate] = useState(today);
  const [slotDraft, setSlotDraft] = useState({
    weekday: '1',
    startTime: '08:00',
    endTime: '09:00',
    capacity: '10',
  });

  const weekStart = useMemo(() => startOfWeek(focusDate), [focusDate]);
  const visibleDays = useMemo(
    () => mode === 'day'
      ? [focusDate]
      : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [focusDate, mode, weekStart],
  );

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => {
      if (statusFilter !== 'ALL' && booking?.status !== statusFilter) return false;
      if (studentFilter && booking?.studentId !== studentFilter) return false;
      return true;
    }),
    [bookings, statusFilter, studentFilter],
  );

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return students;
    return students.filter((student) => {
      const haystack = [
        studentName(student),
        student?.user?.email,
        student?.email,
        student?.phone,
      ].join(' ').toLocaleLowerCase('pt-BR');
      return haystack.includes(query);
    });
  }, [studentSearch, students]);

  const activeSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlot) ?? null,
    [selectedSlot, slots],
  );

  const slotDraftValid =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(slotDraft.startTime) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(slotDraft.endTime) &&
    slotDraft.startTime < slotDraft.endTime &&
    Number.isInteger(Number(slotDraft.capacity)) &&
    Number(slotDraft.capacity) > 0 &&
    Number.isInteger(Number(slotDraft.weekday)) &&
    Number(slotDraft.weekday) >= 0 &&
    Number(slotDraft.weekday) <= 6;

  const changePeriod = (direction: -1 | 1) => {
    setFocusDate((current) => addDays(current, direction * (mode === 'week' ? 7 : 1)));
  };

  const selectSlot = (slotId: string, date: string) => {
    setSelectedSlot(slotId);
    setBookingDate(date);
  };

  return <View testID="schedule-workspace">
    <View style={styles.toolbar}>
      <View style={styles.segmented}>
        <TouchableOpacity
          testID="schedule-view-day"
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'day' }}
          style={[styles.segment, mode === 'day' && styles.segmentActive]}
          onPress={() => setMode('day')}
        >
          <Text style={[styles.segmentText, mode === 'day' && styles.segmentTextActive]}>Dia</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="schedule-view-week"
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'week' }}
          style={[styles.segment, mode === 'week' && styles.segmentActive]}
          onPress={() => setMode('week')}
        >
          <Text style={[styles.segmentText, mode === 'week' && styles.segmentTextActive]}>Semana</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbarActions}>
        <TouchableOpacity accessibilityRole="button" style={styles.controlButton} onPress={() => changePeriod(-1)}>
          <Text style={styles.controlButtonText}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.controlButton} onPress={() => setFocusDate(today)}>
          <Text style={styles.controlButtonText}>Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.controlButton} onPress={() => changePeriod(1)}>
          <Text style={styles.controlButtonText}>Próximo</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.filters}>
      <View style={styles.statusFilters}>
        {statusOptions.map((option) => <TouchableOpacity
          key={option.id}
          accessibilityRole="button"
          accessibilityState={{ selected: statusFilter === option.id }}
          style={[styles.filterChip, statusFilter === option.id && styles.filterChipActive]}
          onPress={() => setStatusFilter(option.id)}
        >
          <Text style={styles.filterChipText}>{option.label}</Text>
        </TouchableOpacity>)}
      </View>
      <ScrollView horizontal contentContainerStyle={styles.studentFilterRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: !studentFilter }}
          style={[styles.filterChip, !studentFilter && styles.filterChipActive]}
          onPress={() => setStudentFilter('')}
        >
          <Text style={styles.filterChipText}>Todos os alunos</Text>
        </TouchableOpacity>
        {students.map((student) => <TouchableOpacity
          key={student.id}
          accessibilityRole="button"
          accessibilityState={{ selected: studentFilter === student.id }}
          style={[styles.filterChip, studentFilter === student.id && styles.filterChipActive]}
          onPress={() => setStudentFilter(student.id)}
        >
          <Text style={styles.filterChipText}>{studentName(student)}</Text>
        </TouchableOpacity>)}
      </ScrollView>
    </View>

    <ScrollView horizontal={mode === 'week'} contentContainerStyle={styles.calendar}>
      {visibleDays.map((day) => {
        const weekday = parseDate(day).getUTCDay();
        const daySlots = slots.filter((slot) => Number(slot.weekday) === weekday);
        const dayBookings = filteredBookings.filter((booking) => sameBookingDate(booking, day));
        return <View key={day} style={[styles.dayColumn, mode === 'day' && styles.dayColumnSingle]}>
          <View style={[styles.dayHeader, day === today && styles.dayHeaderToday]}>
            <Text style={styles.dayName}>{weekdayLabels[weekday]}</Text>
            <Text style={styles.dayDate}>{displayDate(day)}</Text>
            <Text style={styles.dayMeta}>{dayBookings.length} agend.</Text>
          </View>

          <View style={styles.dayBody}>
            {daySlots.length ? daySlots.map((slot) => {
              const allSlotBookings = bookings.filter(
                (booking) => booking?.slotId === slot.id && sameBookingDate(booking, day) && booking?.status !== 'CANCELED',
              );
              const visibleSlotBookings = dayBookings.filter((booking) => booking?.slotId === slot.id);
              const remaining = Math.max(0, Number(slot.capacity ?? 0) - allSlotBookings.length);
              const selected = selectedSlot === slot.id && bookingDate === day;
              return <TouchableOpacity
                key={slot.id}
                testID={`schedule-slot-${slot.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.slotCard, selected && styles.slotCardSelected]}
                onPress={() => selectSlot(slot.id, day)}
              >
                <View style={styles.slotHead}>
                  <View>
                    <Text style={styles.slotTime}>{slot.startTime}–{slot.endTime}</Text>
                    <Text style={styles.slotCapacity}>{allSlotBookings.length}/{slot.capacity} ocupadas · {remaining} livres</Text>
                  </View>
                  <Text style={styles.slotBadge}>{remaining > 0 ? 'Disponível' : 'Lotado'}</Text>
                </View>

                {visibleSlotBookings.length ? <View style={styles.bookingList}>
                  {visibleSlotBookings.map((booking) => <View key={booking.id} style={styles.bookingRow}>
                    <View style={styles.bookingText}>
                      <Text style={styles.bookingName}>{bookingStudentName(booking)}</Text>
                      <Text style={styles.bookingStatus}>{statusLabels[booking.status] ?? booking.status ?? 'Agendado'}</Text>
                    </View>
                    {canManageBookings && booking.status === 'SCHEDULED' ? <TouchableOpacity
                      testID={`schedule-check-in-${booking.id}`}
                      accessibilityRole="button"
                      disabled={saving}
                      style={[styles.checkInButton, saving && styles.disabled]}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        void onCheckIn(booking.id);
                      }}
                    >
                      <Text style={styles.checkInButtonText}>Check-in</Text>
                    </TouchableOpacity> : null}
                  </View>)}
                </View> : <Text style={styles.emptySlot}>Sem agendamentos neste horário.</Text>}
              </TouchableOpacity>;
            }) : <View style={styles.emptyDay}><Text style={styles.emptyDayText}>Nenhum horário configurado.</Text></View>}
          </View>
        </View>;
      })}
    </ScrollView>

    <View style={styles.operationGrid}>
      {canManageBookings ? <View style={styles.operationCard}>
        <Text style={styles.cardTitle}>Novo agendamento</Text>
        <Text style={styles.cardSubtitle}>
          Selecione um horário no calendário, escolha o aluno e confirme.
        </Text>
        <Text style={styles.fieldLabel}>Aluno</Text>
        <TextInput
          accessibilityLabel="Buscar aluno para agendamento"
          style={styles.input}
          value={studentSearch}
          onChangeText={setStudentSearch}
          placeholder="Buscar aluno"
          placeholderTextColor="#71879e"
        />
        <View style={styles.studentPicker}>
          {filteredStudents.slice(0, 12).map((student) => <TouchableOpacity
            key={student.id}
            testID={`schedule-student-${student.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedStudent === student.id }}
            style={[styles.studentChip, selectedStudent === student.id && styles.studentChipActive]}
            onPress={() => setSelectedStudent(student.id)}
          >
            <Text style={styles.studentChipText}>{studentName(student)}</Text>
          </TouchableOpacity>)}
        </View>
        <View style={styles.selectionSummary}>
          <Text style={styles.selectionLabel}>Data</Text>
          <Text style={styles.selectionValue}>{displayDate(bookingDate)}</Text>
          <Text style={styles.selectionLabel}>Horário</Text>
          <Text style={styles.selectionValue}>{activeSlot ? `${activeSlot.startTime}–${activeSlot.endTime}` : 'Selecione no calendário'}</Text>
        </View>
        <TouchableOpacity
          testID="schedule-book"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !selectedStudent || !selectedSlot }}
          disabled={saving || !selectedStudent || !selectedSlot}
          style={[styles.primaryButton, (saving || !selectedStudent || !selectedSlot) && styles.disabled]}
          onPress={() => {
            void onBook({
              studentId: selectedStudent,
              slotId: selectedSlot,
              date: bookingDate,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Agendar aluno'}</Text>
        </TouchableOpacity>
      </View> : null}

      {canCreateSlot ? <View style={styles.operationCard}>
        <Text style={styles.cardTitle}>Configurar horário</Text>
        <Text style={styles.cardSubtitle}>Crie slots recorrentes para a operação semanal da academia.</Text>
        <Text style={styles.fieldLabel}>Dia da semana</Text>
        <View style={styles.weekdayPicker}>
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => <TouchableOpacity
            key={weekday}
            accessibilityRole="button"
            accessibilityState={{ selected: slotDraft.weekday === String(weekday) }}
            style={[styles.weekdayChip, slotDraft.weekday === String(weekday) && styles.weekdayChipActive]}
            onPress={() => setSlotDraft((current) => ({ ...current, weekday: String(weekday) }))}
          >
            <Text style={styles.weekdayChipText}>{weekdayLabels[weekday].slice(0, 3)}</Text>
          </TouchableOpacity>)}
        </View>
        <View style={styles.inlineFields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Início</Text>
            <TextInput accessibilityLabel="Início do horário" style={styles.input} value={slotDraft.startTime} onChangeText={(startTime) => setSlotDraft((current) => ({ ...current, startTime }))} placeholderTextColor="#71879e" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fim</Text>
            <TextInput accessibilityLabel="Fim do horário" style={styles.input} value={slotDraft.endTime} onChangeText={(endTime) => setSlotDraft((current) => ({ ...current, endTime }))} placeholderTextColor="#71879e" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Capacidade</Text>
            <TextInput accessibilityLabel="Capacidade do horário" style={styles.input} value={slotDraft.capacity} onChangeText={(capacity) => setSlotDraft((current) => ({ ...current, capacity }))} keyboardType="numeric" placeholderTextColor="#71879e" />
          </View>
        </View>
        {!slotDraftValid ? <Text style={styles.validationText}>Use horários válidos, com início anterior ao fim e capacidade maior que zero.</Text> : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !slotDraftValid }}
          disabled={saving || !slotDraftValid}
          style={[styles.primaryButton, (saving || !slotDraftValid) && styles.disabled]}
          onPress={() => {
            void onCreateSlot({
              weekday: Number(slotDraft.weekday),
              startTime: slotDraft.startTime,
              endTime: slotDraft.endTime,
              capacity: Number(slotDraft.capacity),
              active: true,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Criar horário'}</Text>
        </TouchableOpacity>
      </View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  segmented: { flexDirection: 'row', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 3 },
  segment: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  segmentActive: { backgroundColor: '#176bc1' },
  segmentText: { color: '#9aadc1', fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#ffffff' },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  controlButton: { minHeight: 40, justifyContent: 'center', backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  controlButtonText: { color: '#dce9f6', fontSize: 11, fontWeight: '800' },
  filters: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 8, marginBottom: 8, gap: 6 },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  studentFilterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipActive: { borderColor: '#2f91ff', backgroundColor: '#102b4d' },
  filterChipText: { color: '#dce9f6', fontSize: 11, fontWeight: '700' },
  calendar: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, minWidth: '100%', paddingBottom: 6 },
  dayColumn: { width: 184, minWidth: 184, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, overflow: 'hidden' },
  dayColumnSingle: { flex: 1, width: '100%', minWidth: 0 },
  dayHeader: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#08172a', borderBottomWidth: 1, borderBottomColor: '#203b55' },
  dayHeaderToday: { backgroundColor: '#0b2340', borderBottomColor: '#2f91ff' },
  dayName: { color: '#eef6ff', fontSize: 12, fontWeight: '900' },
  dayDate: { color: '#b3c3d5', fontSize: 11, marginTop: 2 },
  dayMeta: { color: '#71879e', fontSize: 10, marginTop: 3 },
  dayBody: { padding: 6, gap: 6 },
  slotCard: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 8 },
  slotCardSelected: { borderColor: '#2f91ff', backgroundColor: '#071a31' },
  slotHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  slotTime: { color: '#eef6ff', fontSize: 12, fontWeight: '900' },
  slotCapacity: { color: '#9aadc1', fontSize: 10, marginTop: 2 },
  slotBadge: { color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  bookingList: { marginTop: 7, gap: 5 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderTopWidth: 1, borderTopColor: '#17263a', paddingTop: 5 },
  bookingText: { flex: 1, minWidth: 0 },
  bookingName: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  bookingStatus: { color: '#9aadc1', fontSize: 9, marginTop: 1 },
  checkInButton: { minHeight: 40, justifyContent: 'center', backgroundColor: '#176bc1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  checkInButtonText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  emptySlot: { color: '#71879e', fontSize: 9, marginTop: 7 },
  emptyDay: { minHeight: 70, alignItems: 'center', justifyContent: 'center', padding: 8 },
  emptyDayText: { color: '#71879e', fontSize: 10, textAlign: 'center' },
  operationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  operationCard: { flexGrow: 1, flexBasis: 380, minWidth: 0, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  cardTitle: { color: '#eef6ff', fontSize: 15, fontWeight: '900' },
  cardSubtitle: { color: '#9aadc1', fontSize: 11, lineHeight: 16, marginTop: 2, marginBottom: 8 },
  fieldLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', marginBottom: 4, marginTop: 5 },
  input: { color: '#eef6ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  studentPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  studentChip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  studentChipActive: { borderColor: '#2f91ff', backgroundColor: '#102b4d' },
  studentChipText: { color: '#dce9f6', fontSize: 10, fontWeight: '700' },
  selectionSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginVertical: 8, backgroundColor: '#050b14', borderRadius: 9, padding: 8 },
  selectionLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  selectionValue: { color: '#eef6ff', fontSize: 11, fontWeight: '800', marginRight: 8 },
  weekdayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 6 },
  weekdayChip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  weekdayChipActive: { borderColor: '#2f91ff', backgroundColor: '#102b4d' },
  weekdayChipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  inlineFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  field: { flexGrow: 1, flexBasis: 110, minWidth: 90 },
  validationText: { color: '#fca5a5', fontSize: 10, lineHeight: 14, marginTop: 6 },
  primaryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9, marginTop: 7 },
  primaryButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.42 },
});
