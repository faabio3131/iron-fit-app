import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

type OperationalStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
const labels: Record<OperationalStatus, string> = { OPERATIONAL: 'Disponível para uso', MAINTENANCE: 'Em manutenção', OUT_OF_SERVICE: 'Fora de serviço' };

export function EquipmentOperationControl({ id, status, canManage, onUpdated }: {
  id: string; status?: string; canManage: boolean; onUpdated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const known = status === 'OPERATIONAL' || status === 'MAINTENANCE' || status === 'OUT_OF_SERVICE';

  async function update(next: OperationalStatus) {
    if (!canManage || !known || busy || next === status) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/equipments/${encodeURIComponent(id)}/operational-status`, undefined, { method: 'POST', body: JSON.stringify({ status: next }) });
      await onUpdated();
      setNotice('Situação operacional atualizada.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o equipamento.');
    } finally { setBusy(false); }
  }

  return <View style={styles.root}>
    <Text style={styles.label}>Situação operacional</Text>
    <Text style={styles.status}>{known ? labels[status] : 'Não informada'}</Text>
    {canManage && known ? <View style={styles.actions}>
      {(['MAINTENANCE', 'OUT_OF_SERVICE', 'OPERATIONAL'] as OperationalStatus[]).filter((next) => next !== status).map((next) =>
        <TouchableOpacity key={next} accessibilityRole="button" accessibilityLabel={`${labels[next]}: atualizar equipamento`}
          testID={`equipment-operation-${id}-${next}`} disabled={busy} accessibilityState={{ disabled: busy }}
          onPress={() => { void update(next); }} style={[styles.action, busy && styles.disabled]}>
          <Text style={styles.actionText}>{next === 'MAINTENANCE' ? 'Registrar manutenção' : next === 'OUT_OF_SERVICE' ? 'Marcar fora de serviço' : 'Liberar para uso'}</Text>
        </TouchableOpacity>)}
    </View> : null}
    {busy ? <ActivityIndicator accessibilityLabel="Atualizando equipamento" color={colors.accent} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.label}>{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 8 }, label: { color: colors.textMuted, fontSize: 12 },
  status: { color: colors.text, fontWeight: '600' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44 },
  actionText: { color: colors.accent, fontWeight: '600' }, disabled: { opacity: 0.5 }, error: { color: colors.danger },
});
