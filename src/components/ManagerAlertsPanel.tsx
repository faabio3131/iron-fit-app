import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { GlowCard } from './GlowCard';

type Alert = { id: string; category: string; severity: string; status: string; title: string; message: string; occurredAt: string; recipient?: { readAt?: string | null } };
type Preference = { category: string; emailEnabled: boolean; pushEnabled: boolean; whatsappEnabled: boolean; minimumSeverity: string };
const category: Record<string, string> = { STUDENT_BILLING: 'Cobranças', ATTENDANCE_RISK: 'Frequência', ASSESSMENT_WORKOUT: 'Avaliações e treinos', EQUIPMENT: 'Equipamentos', DELIVERY_FAILURE: 'Falhas de entrega', INTEGRATION_HEALTH: 'Integrações', PLAN_LIMIT: 'Limites do plano', SECURITY: 'Segurança', OPERATIONAL_INCIDENT: 'Incidentes', HUMAN_APPROVAL: 'Aprovações humanas' };
const severity: Record<string, string> = { INFO: 'Informativo', WARNING: 'Atenção', CRITICAL: 'Crítico' };

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return (reason as Error & { status?: number }).status === 403 ? 'Confirme sua identidade e a autorização do seu perfil.' : reason.message;
  return 'Não foi possível concluir a operação.';
}
function Action({ label, onPress, disabled, secondary, testID }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; testID?: string }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress} disabled={disabled} style={[styles.action, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></TouchableOpacity>;
}

export function ManagerAlertBell({ onOpen }: { onOpen: () => void }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let mounted = true;
    const load = async () => { try { const value = await api('/manager-alerts/counters'); if (mounted) setUnread(Number.isInteger(value?.unread) ? value.unread : 0); } catch { if (mounted) setUnread(0); } };
    void load(); const timer = setInterval(() => void load(), 60_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={unread ? `${unread} alertas não lidos` : 'Alertas'} testID="manager-alert-bell" onPress={onOpen} style={styles.bell}><Ionicons name="notifications-outline" size={21} color="#d8f9e5" />{unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}</TouchableOpacity>;
}

export function ManagerAlertsPanel() {
  const { profile, activeTenantId } = useAuth();
  const owner = Array.isArray(profile?.roles) && profile.roles.includes('OWNER');
  const [items, setItems] = useState<Alert[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [evolution, setEvolution] = useState<any>({ configured: false, status: 'DISCONNECTED' });
  const [qr, setQr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const suffix = filter ? `?status=${filter}&limit=50` : '?limit=50';
      const [inbox, prefs, connection] = await Promise.all([api(`/manager-alerts${suffix}`), api('/manager-alerts/preferences'), api('/integrations/evolution/status')]);
      setItems(Array.isArray(inbox?.items) ? inbox.items : []); setUnread(Number.isInteger(inbox?.page?.unread) ? inbox.page.unread : 0);
      setPreferences(Array.isArray(prefs) ? prefs : []); setEvolution(connection ?? { configured: false, status: 'DISCONNECTED' });
    } catch (reason) { setError(errorMessage(reason)); } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [activeTenantId, load]);

  async function alertAction(id: string, action: string) {
    setSaving(id); setError(''); setNotice('');
    try { await api(`/manager-alerts/${encodeURIComponent(id)}/${action}`, undefined, { method: 'PATCH' }); setNotice('Alerta atualizado.'); await load(); }
    catch (reason) { setError(errorMessage(reason)); } finally { setSaving(''); }
  }
  async function toggle(item: Preference, key: 'emailEnabled' | 'pushEnabled' | 'whatsappEnabled') {
    if (key === 'pushEnabled') return;
    setSaving(item.category); setError('');
    try { await api(`/manager-alerts/preferences/${item.category}`, undefined, { method: 'PUT', body: JSON.stringify({ [key]: !item[key] }) }); setNotice('Preferência salva; o painel interno permanece ativo.'); await load(); }
    catch (reason) { setError(errorMessage(reason)); } finally { setSaving(''); }
  }
  async function connect() {
    setSaving('evolution'); setQr(null); setError('');
    try { const result = await api('/integrations/evolution/connect', undefined, { method: 'POST' }); const image = result?.qr?.base64; setQr(typeof image === 'string' ? image.startsWith('data:') ? image : `data:image/png;base64,${image}` : null); setEvolution({ configured: true, status: result?.status }); setNotice('QR gerado; ele não será armazenado pelo IRON.'); }
    catch (reason) { setError(errorMessage(reason)); } finally { setSaving(''); }
  }
  async function disconnect() {
    setSaving('evolution'); setError('');
    try { await api('/integrations/evolution/connection', undefined, { method: 'DELETE' }); setQr(null); setEvolution({ configured: true, status: 'DISCONNECTED' }); setNotice('WhatsApp desconectado.'); }
    catch (reason) { setError(errorMessage(reason)); } finally { setSaving(''); }
  }

  return <View testID="manager-alerts-panel" style={styles.container}>
    <View style={styles.header}><View><Text style={styles.title}>Centro de Alertas</Text><Text style={styles.muted}>{unread ? `${unread} não lido(s)` : 'Nenhum alerta não lido'} · fonte canônica do IRON</Text></View><Action label="Atualizar" secondary disabled={loading} onPress={() => void load()} /></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}
    <View style={styles.chips}>{[['', 'Todos'], ['OPEN', 'Abertos'], ['ACKNOWLEDGED', 'Reconhecidos'], ['RESOLVED', 'Resolvidos']].map(([value, label]) => <TouchableOpacity accessibilityRole="button" key={value || 'all'} onPress={() => setFilter(value)} style={[styles.chip, filter === value && styles.chipActive]}><Text style={[styles.chipText, filter === value && styles.green]}>{label}</Text></TouchableOpacity>)}</View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Carregando alertas autorizados…</Text></View> : items.length === 0 ? <GlowCard style={styles.empty}><Ionicons name="checkmark-circle-outline" size={30} color="#2BF47A" /><Text style={styles.cardTitle}>Tudo em ordem por aqui</Text><Text style={styles.muted}>Nenhum alerta corresponde ao filtro.</Text></GlowCard> : <View style={styles.list}>{items.map((item) => <GlowCard key={item.id} style={[styles.card, ...(!item.recipient?.readAt ? [styles.unread] : [])]}><View style={styles.meta}><Text style={[styles.pill, item.severity === 'CRITICAL' && styles.critical]}>{severity[item.severity] ?? item.severity}</Text><Text style={styles.muted}>{category[item.category] ?? item.category}</Text><Text style={styles.date}>{new Date(item.occurredAt).toLocaleString('pt-BR')}</Text></View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{item.message}</Text><View style={styles.actions}>{!item.recipient?.readAt ? <Action label="Marcar como lido" secondary disabled={saving === item.id} onPress={() => void alertAction(item.id, 'read')} /> : null}{item.status === 'OPEN' ? <Action label="Reconhecer" disabled={saving === item.id} onPress={() => void alertAction(item.id, 'acknowledge')} /> : null}{['OPEN', 'ACKNOWLEDGED'].includes(item.status) ? <Action label="Resolver" secondary disabled={saving === item.id} onPress={() => void alertAction(item.id, 'resolve')} /> : null}</View></GlowCard>)}</View>}
    <GlowCard style={styles.section}><Text style={styles.sectionTitle}>Canais pessoais</Text><Text style={styles.muted}>E-mail e WhatsApp dependem da configuração da academia. Push indisponível nesta versão.</Text>{preferences.map((item) => <View key={item.category} style={styles.preference}><View><Text style={styles.cardTitle}>{category[item.category] ?? item.category}</Text><Text style={styles.muted}>Mínimo: {severity[item.minimumSeverity] ?? item.minimumSeverity}</Text></View><View style={styles.actions}>{(['emailEnabled', 'pushEnabled', 'whatsappEnabled'] as const).map((key) => <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: key !== 'pushEnabled' && item[key], disabled: key === 'pushEnabled' || saving === item.category }} key={key} disabled={key === 'pushEnabled' || saving === item.category} onPress={() => void toggle(item, key)} style={[styles.channel, key !== 'pushEnabled' && item[key] && styles.channelOn, key === 'pushEnabled' && styles.disabled]}><Text style={[styles.channelText, key !== 'pushEnabled' && item[key] && styles.green]}>{key === 'emailEnabled' ? 'E-mail' : key === 'pushEnabled' ? 'Push indisponível' : 'WhatsApp'}</Text></TouchableOpacity>)}</View></View>)}</GlowCard>
    {owner ? <GlowCard style={styles.section}><Text style={styles.sectionTitle}>WhatsApp da academia</Text><Text style={styles.muted}>Instância isolada na Evolution central da FM; a chave nunca é exibida.</Text><Text style={styles.connection}>Situação: {evolution?.status === 'CONNECTED' ? 'Conectado' : evolution?.status === 'QR_PENDING' ? 'Aguardando QR' : 'Desconectado'}</Text>{qr ? <Image accessibilityLabel="QR Code para conectar o WhatsApp" source={{ uri: qr }} style={styles.qr} /> : null}<View style={styles.actions}><Action testID="evolution-connect" label="Conectar por QR Code" disabled={saving === 'evolution'} onPress={() => void connect()} />{evolution?.configured ? <Action label="Desconectar" secondary disabled={saving === 'evolution'} onPress={() => void disconnect()} /> : null}</View><Text style={styles.hint}>A operação exige confirmação recente de identidade.</Text></GlowCard> : null}
  </View>;
}

const styles = StyleSheet.create({ container: { gap: 12 }, header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, title: { color: '#2BF47A', fontSize: 24, fontWeight: '900' }, muted: { color: '#9fb0bd', fontSize: 13, lineHeight: 19 }, error: { color: '#fecaca', backgroundColor: '#351419', padding: 11, borderRadius: 9 }, notice: { color: '#86efac', backgroundColor: '#0c2c1c', padding: 11, borderRadius: 9 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, chipActive: { borderColor: '#2BF47A', backgroundColor: '#0d2d1d' }, chipText: { color: '#cbd5e1', fontSize: 12 }, green: { color: '#2BF47A', fontWeight: '800' }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, empty: { padding: 24, alignItems: 'center', gap: 6 }, list: { gap: 10 }, card: { padding: 15 }, unread: { borderColor: '#2BF47A' }, meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, pill: { color: '#86efac', backgroundColor: '#0b2f22', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '900' }, critical: { color: '#fecaca', backgroundColor: '#49151b' }, date: { color: '#7f93a2', fontSize: 11, marginLeft: 'auto' }, cardTitle: { color: '#eff8f2', fontSize: 15, fontWeight: '800', marginTop: 8 }, body: { color: '#bfd0c6', fontSize: 13, lineHeight: 20, marginTop: 5 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }, action: { backgroundColor: '#2BF47A', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#3b4b5f' }, actionText: { color: '#04140b', fontSize: 12, fontWeight: '900' }, secondaryText: { color: '#e2e8f0' }, disabled: { opacity: 0.45 }, section: { padding: 16, marginTop: 8 }, sectionTitle: { color: '#2BF47A', fontSize: 17, fontWeight: '900', marginBottom: 5 }, preference: { borderTopWidth: 1, borderTopColor: '#243044', paddingTop: 10, marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }, channel: { borderWidth: 1, borderColor: '#3b4b5f', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, channelOn: { borderColor: '#2BF47A', backgroundColor: '#0d2d1d' }, channelText: { color: '#9fb0bd', fontSize: 11, fontWeight: '700' }, connection: { color: '#eff8f2', fontWeight: '800', marginTop: 12 }, qr: { width: 220, height: 220, marginTop: 12, backgroundColor: '#fff', borderRadius: 12 }, hint: { color: '#7f93a2', fontSize: 11, marginTop: 10 }, bell: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#354559' }, badge: { position: 'absolute', right: -4, top: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: '#2BF47A', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#04140b', fontSize: 10, fontWeight: '900' } });
