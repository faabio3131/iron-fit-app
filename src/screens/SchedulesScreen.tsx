import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../components/EmptyState';
import { RequestErrorState } from '../components/RequestErrorState';
import { api } from '../services/api';
import { CheckInScreen } from './CheckInScreen';

function fmtDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

const bookingStatusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Entrada registrada',
  NO_SHOW: 'Não compareceu',
  CANCELED: 'Cancelado',
};

export function SchedulesScreen() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  function refreshSchedule() {
    setLoadError('');
    setLoading(true);
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    let active = true;
    api('/me/schedules')
      .then((data) => {
        if (active) {
          if (!Array.isArray(data)) throw new Error('O servidor retornou uma agenda inválida.');
          setSchedules(data);
        }
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível atualizar a agenda. Confira sua conexão.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.heading}>Agenda</Text><Text style={styles.sub}>Suas aulas e entradas 📅</Text></View>
        <Ionicons name="calendar" size={24} color="#f59e0b" />
      </View>
      <CheckInScreen onCheckedIn={refreshSchedule} />
      <Text style={styles.sectionTitle}>Horários reservados</Text>
      {loading ? <ActivityIndicator size="large" color="#2BF47A" style={styles.loading} /> : loadError ? (
        <RequestErrorState retryTestID="schedule-retry" message={`Sem conexão ou serviço indisponível. ${loadError}`} onRetry={refreshSchedule} />
      ) : schedules.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nenhum horário reservado" subtitle="Quando sua academia abrir a agenda, suas reservas aparecem aqui." />
      ) : schedules.map((schedule, index) => (
        <View key={schedule.id || index} style={styles.card}>
          <View style={styles.dateBox}><Text style={styles.dateText}>{fmtDate(schedule.slot?.date || schedule.date || schedule.createdAt).slice(0, 5)}</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{schedule.slot?.name || schedule.name || 'Aula / Horário'}</Text>
            <Text style={styles.meta}>
              {schedule.slot?.startTime || schedule.startTime ? `🕐 ${schedule.slot?.startTime || schedule.startTime}` : ''}
              {schedule.status ? ` · ${bookingStatusLabels[schedule.status] ?? schedule.status}` : ''}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 14, marginTop: 2 },
  sectionTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  loading: { marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2035', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#252d47', gap: 12 },
  dateBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#2BF47A20', alignItems: 'center', justifyContent: 'center' },
  dateText: { color: '#2BF47A', fontWeight: '800', fontSize: 13 },
  cardContent: { flex: 1 },
  cardTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  errorCard: { padding: 16, borderRadius: 12, borderColor: '#ef444450', borderWidth: 1, marginTop: 8 },
  errorText: { color: '#fca5a5', fontSize: 13 },
  retryButton: { paddingVertical: 10, marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: '#2BF47A', fontSize: 13, fontWeight: '700' },
});
