import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export function SchedulesScreen() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api('/me/schedules');
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Não foi possível carregar sua agenda. Sem conexão ou serviço indisponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSchedules(); }, 0);
    return () => clearTimeout(timer);
  }, [loadSchedules]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.heading}>Agenda</Text><Text style={styles.sub}>Suas aulas e entradas 📅</Text></View>
        <Ionicons name="calendar" size={24} color="#2f91ff" />
      </View>
      <CheckInScreen />
      <Text style={styles.sectionTitle}>Horários reservados</Text>
      {loading ? <ActivityIndicator size="large" color="#2f91ff" style={styles.loading} /> : loadError ? (
        <RequestErrorState message={loadError} onRetry={() => { void loadSchedules(); }} />
      ) : schedules.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nenhum horário reservado" subtitle="Quando sua academia abrir a agenda, suas reservas aparecem aqui." />
      ) : schedules.map((schedule, index) => (
        <View key={schedule.id || index} style={styles.card}>
          <View style={styles.dateBox}><Text style={styles.dateText}>{fmtDate(schedule.slot?.date || schedule.date || schedule.createdAt).slice(0, 5)}</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{schedule.slot?.name || schedule.name || 'Aula / Horário'}</Text>
            <Text style={styles.meta}>
              {schedule.slot?.startTime || schedule.startTime ? `🕐 ${schedule.slot?.startTime || schedule.startTime}` : ''}
              {schedule.status ? ` · ${schedule.status}` : ''}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#67d6ff" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#030811' },
  content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { color: '#eef7ff', fontSize: 24, fontWeight: '800' },
  sub: { color: '#9fb0c5', fontSize: 14, marginTop: 2 },
  sectionTitle: { color: '#eef7ff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  loading: { marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#071528', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#203b55', gap: 12 },
  dateBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#2f91ff20', alignItems: 'center', justifyContent: 'center' },
  dateText: { color: '#2f91ff', fontWeight: '800', fontSize: 13 },
  cardContent: { flex: 1 },
  cardTitle: { color: '#eef7ff', fontSize: 15, fontWeight: '700' },
  meta: { color: '#9fb0c5', fontSize: 12, marginTop: 2 },
});
