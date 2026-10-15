import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IronInput as TextInput } from '../components/IronInput';

type AccessCenterWorkspaceProps = {
  students: any[];
  credentials: any[];
  events: any[];
  devices: any[];
  saving: boolean;
  canManageDevices: boolean;
  onCreateCredential: (payload: {
    studentId: string;
    type: string;
    expiresAt?: string;
  }) => Promise<any>;
  onRevokeCredential: (credentialId: string) => Promise<void>;
  onRotateDeviceToken: (deviceId: string) => Promise<any>;
};

type DecisionFilter = 'ALL' | 'ALLOWED' | 'DENIED';
type CredentialFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

const accessTypeLabels: Record<string, string> = {
  QR_CODE: 'QR Code',
  BIOMETRIC: 'Biometria',
  FACIAL: 'Reconhecimento facial',
  TAG: 'Tag',
  MANUAL: 'Manual',
};

const credentialStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Revogada',
  EXPIRED: 'Expirada',
};

function studentName(student: any) {
  return student?.user?.name ?? student?.name ?? student?.user?.email ?? student?.email ?? 'Aluno';
}

function credentialStudentName(credential: any) {
  return credential?.student?.user?.name ?? credential?.student?.user?.email ?? credential?.studentId ?? 'Aluno';
}

function eventStudentName(event: any) {
  return event?.student?.user?.name ?? event?.student?.user?.email ?? (event?.studentId ? 'Aluno identificado' : 'Sem aluno');
}

function displayDateTime(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function displayDate(value: unknown) {
  if (!value) return 'Sem validade definida';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Sem validade definida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'danger' | 'warning' }) {
  return <View style={[
    styles.statusPill,
    tone === 'primary' && styles.statusPrimary,
    tone === 'danger' && styles.statusDanger,
    tone === 'warning' && styles.statusWarning,
  ]}><Text style={[
    styles.statusText,
    tone === 'primary' && styles.statusTextPrimary,
    tone === 'danger' && styles.statusTextDanger,
    tone === 'warning' && styles.statusTextWarning,
  ]}>{label}</Text></View>;
}

export function AccessCenterWorkspace({
  students,
  credentials,
  events,
  devices,
  saving,
  canManageDevices,
  onCreateCredential,
  onRevokeCredential,
  onRotateDeviceToken,
}: AccessCenterWorkspaceProps) {
  const [credentialFilter, setCredentialFilter] = useState<CredentialFilter>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('ALL');
  const [studentFilter, setStudentFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [credentialType, setCredentialType] = useState('QR_CODE');
  const [expiresAt, setExpiresAt] = useState('');
  const [lastCredential, setLastCredential] = useState<any>(null);
  const [lastDeviceToken, setLastDeviceToken] = useState<any>(null);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return students;
    return students.filter((student) => [
      studentName(student),
      student?.user?.email,
      student?.email,
      student?.phone,
    ].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  }, [studentSearch, students]);

  const visibleCredentials = useMemo(
    () => credentials.filter((credential) => {
      if (credentialFilter !== 'ALL' && credential?.status !== credentialFilter) return false;
      if (studentFilter && credential?.studentId !== studentFilter) return false;
      return true;
    }),
    [credentialFilter, credentials, studentFilter],
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => {
      if (decisionFilter === 'ALLOWED' && event?.allowed !== true) return false;
      if (decisionFilter === 'DENIED' && event?.allowed !== false) return false;
      if (studentFilter && event?.studentId !== studentFilter) return false;
      if (deviceFilter && event?.deviceId !== deviceFilter) return false;
      return true;
    }),
    [decisionFilter, deviceFilter, events, studentFilter],
  );

  const activeCredentials = credentials.filter((item) => item?.status === 'ACTIVE').length;
  const allowedEvents = events.filter((item) => item?.allowed === true).length;
  const deniedEvents = events.filter((item) => item?.allowed === false).length;
  const activeDevices = devices.filter((item) => item?.active === true).length;

  const issueCredential = async () => {
    if (!selectedStudent) return;
    const created = await onCreateCredential({
      studentId: selectedStudent,
      type: credentialType,
      ...(expiresAt.trim() ? { expiresAt: expiresAt.trim() } : {}),
    });
    if (created?.qrToken) {
      setLastCredential(created);
      setExpiresAt('');
    }
  };

  const rotateDeviceToken = async (deviceId: string) => {
    const created = await onRotateDeviceToken(deviceId);
    if (created?.deviceToken) setLastDeviceToken(created);
  };

  return <View testID="access-center-workspace">
    <View style={styles.kpiGrid}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Credenciais ativas</Text>
        <Text style={styles.kpiValue}>{activeCredentials}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Acessos permitidos</Text>
        <Text style={styles.kpiValue}>{allowedEvents}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Acessos negados</Text>
        <Text style={styles.kpiValue}>{deniedEvents}</Text>
      </View>
      {canManageDevices ? <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Dispositivos ativos</Text>
        <Text style={styles.kpiValue}>{activeDevices}</Text>
      </View> : null}
    </View>

    <View style={styles.filterBar}>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Aluno</Text>
        <ScrollView horizontal contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: !studentFilter }}
            style={[styles.filterChip, !studentFilter && styles.filterChipActive]}
            onPress={() => setStudentFilter('')}
          >
            <Text style={styles.filterChipText}>Todos</Text>
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
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Decisão</Text>
        <View style={styles.filterRow}>
          {([
            ['ALL', 'Todos'],
            ['ALLOWED', 'Permitidos'],
            ['DENIED', 'Negados'],
          ] as const).map(([id, label]) => <TouchableOpacity
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: decisionFilter === id }}
            style={[styles.filterChip, decisionFilter === id && styles.filterChipActive]}
            onPress={() => setDecisionFilter(id)}
          >
            <Text style={styles.filterChipText}>{label}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
    </View>

    <View style={styles.mainGrid}>
      <View style={styles.primaryPane}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>Credenciais</Text>
            <Text style={styles.sectionSubtitle}>Ciclo de vida das credenciais emitidas para alunos.</Text>
          </View>
          <View style={styles.filterRow}>
            {(['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRED'] as CredentialFilter[]).map((status) => <TouchableOpacity
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected: credentialFilter === status }}
              style={[styles.miniChip, credentialFilter === status && styles.filterChipActive]}
              onPress={() => setCredentialFilter(status)}
            >
              <Text style={styles.filterChipText}>{status === 'ALL' ? 'Todas' : credentialStatusLabels[status]}</Text>
            </TouchableOpacity>)}
          </View>
        </View>

        <View style={styles.credentialList}>
          {visibleCredentials.length ? visibleCredentials.map((credential) => {
            const tone = credential.status === 'ACTIVE' ? 'primary' : credential.status === 'EXPIRED' ? 'warning' : 'neutral';
            return <View key={credential.id} style={styles.credentialCard}>
              <View style={styles.cardHead}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{credentialStudentName(credential)}</Text>
                  <Text style={styles.cardMeta}>{accessTypeLabels[credential.type] ?? credential.type ?? 'Credencial'}</Text>
                </View>
                <StatusPill label={credentialStatusLabels[credential.status] ?? credential.status ?? '—'} tone={tone} />
              </View>
              <Text style={styles.cardDetail}>Validade: {displayDate(credential.expiresAt)}</Text>
              {credential.status === 'ACTIVE' ? <TouchableOpacity
                testID={`access-credential-revoke-${credential.id}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                disabled={saving}
                style={[styles.secondaryButton, saving && styles.disabled]}
                onPress={() => { void onRevokeCredential(credential.id); }}
              >
                <Text style={styles.secondaryButtonText}>Revogar credencial</Text>
              </TouchableOpacity> : null}
            </View>;
          }) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Nenhuma credencial neste filtro</Text><Text style={styles.emptyText}>Emita uma credencial ou ajuste os filtros.</Text></View>}
        </View>
      </View>

      <View style={styles.sidePane}>
        <Text style={styles.sectionTitle}>Emitir credencial</Text>
        <Text style={styles.sectionSubtitle}>O segredo é exibido uma única vez após a emissão.</Text>
        <Text style={styles.fieldLabel}>Aluno</Text>
        <TextInput
          accessibilityLabel="Buscar aluno para credencial"
          style={styles.input}
          value={studentSearch}
          onChangeText={setStudentSearch}
          placeholder="Buscar aluno"
          placeholderTextColor="#71879e"
        />
        <View style={styles.studentPicker}>
          {filteredStudents.slice(0, 12).map((student) => <TouchableOpacity
            key={student.id}
            testID={`access-student-${student.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedStudent === student.id }}
            style={[styles.studentChip, selectedStudent === student.id && styles.filterChipActive]}
            onPress={() => setSelectedStudent(student.id)}
          >
            <Text style={styles.filterChipText}>{studentName(student)}</Text>
          </TouchableOpacity>)}
        </View>

        <Text style={styles.fieldLabel}>Tipo</Text>
        <View style={styles.typeGrid}>
          {Object.entries(accessTypeLabels).map(([type, label]) => <TouchableOpacity
            key={type}
            accessibilityRole="button"
            accessibilityState={{ selected: credentialType === type }}
            style={[styles.typeChip, credentialType === type && styles.filterChipActive]}
            onPress={() => setCredentialType(type)}
          >
            <Text style={styles.filterChipText}>{label}</Text>
          </TouchableOpacity>)}
        </View>

        <Text style={styles.fieldLabel}>Validade opcional</Text>
        <TextInput
          accessibilityLabel="Validade da credencial"
          style={styles.input}
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="AAAA-MM-DD"
          placeholderTextColor="#71879e"
        />
        <TouchableOpacity
          testID="access-credential-create"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !selectedStudent }}
          disabled={saving || !selectedStudent}
          style={[styles.primaryButton, (saving || !selectedStudent) && styles.disabled]}
          onPress={() => { void issueCredential(); }}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Emitindo…' : 'Emitir credencial'}</Text>
        </TouchableOpacity>

        {lastCredential?.qrToken ? <View style={styles.oneTimeSecret} testID="access-credential-one-time">
          <Text style={styles.secretEyebrow}>EXIBIÇÃO ÚNICA</Text>
          <Text style={styles.secretTitle}>Código da credencial QR</Text>
          <Text style={styles.secretHelp}>Use este código para materializar o QR da credencial. Ele não será exibido novamente pelo servidor.</Text>
          <Text selectable style={styles.secretValue}>{lastCredential.qrToken}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setLastCredential(null)}>
            <Text style={styles.secondaryButtonText}>Ocultar código</Text>
          </TouchableOpacity>
        </View> : null}
      </View>
    </View>

    <View style={styles.timelineSection}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Timeline de acessos</Text>
          <Text style={styles.sectionSubtitle}>Decisões registradas pelo domínio canônico de acesso.</Text>
        </View>
        {devices.length ? <ScrollView horizontal contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: !deviceFilter }}
            style={[styles.miniChip, !deviceFilter && styles.filterChipActive]}
            onPress={() => setDeviceFilter('')}
          >
            <Text style={styles.filterChipText}>Todos os dispositivos</Text>
          </TouchableOpacity>
          {devices.map((device) => <TouchableOpacity
            key={device.id}
            accessibilityRole="button"
            accessibilityState={{ selected: deviceFilter === device.id }}
            style={[styles.miniChip, deviceFilter === device.id && styles.filterChipActive]}
            onPress={() => setDeviceFilter(device.id)}
          >
            <Text style={styles.filterChipText}>{device.name}</Text>
          </TouchableOpacity>)}
        </ScrollView> : null}
      </View>

      <View style={styles.timeline}>
        {visibleEvents.length ? visibleEvents.map((event) => <View key={event.id} style={styles.timelineItem}>
          <View style={[styles.timelineDot, event.allowed === false && styles.timelineDotDenied]} />
          <View style={styles.timelineContent}>
            <View style={styles.cardHead}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{eventStudentName(event)}</Text>
                <Text style={styles.cardMeta}>{event?.device?.name ?? 'Dispositivo'} · {displayDateTime(event.occurredAt)}</Text>
              </View>
              <StatusPill label={event.allowed ? 'Permitido' : 'Negado'} tone={event.allowed ? 'primary' : 'danger'} />
            </View>
            {!event.allowed && event.denialReason ? <Text style={styles.denialReason}>{event.denialReason}</Text> : null}
          </View>
        </View>) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Nenhum evento neste filtro</Text><Text style={styles.emptyText}>A timeline exibirá as decisões de acesso registradas.</Text></View>}
      </View>
    </View>

    {canManageDevices ? <View style={styles.deviceSection}>
      <Text style={styles.sectionTitle}>Dispositivos de acesso</Text>
      <Text style={styles.sectionSubtitle}>Inventário configurado no backend. Tokens são rotacionados e exibidos uma única vez.</Text>
      <View style={styles.deviceGrid}>
        {devices.length ? devices.map((device) => <View key={device.id} style={styles.deviceCard}>
          <View style={styles.cardHead}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{device.name}</Text>
              <Text style={styles.cardMeta}>{accessTypeLabels[device.type] ?? device.type ?? 'Dispositivo'}{device.protocol ? ` · ${device.protocol}` : ''}</Text>
            </View>
            <StatusPill label={device.active ? 'Ativo' : 'Inativo'} tone={device.active ? 'primary' : 'neutral'} />
          </View>
          <Text style={styles.cardDetail}>Última sincronização: {displayDateTime(device.lastSyncAt)}</Text>
          <Text style={styles.cardDetail}>Token rotacionado: {displayDateTime(device.tokenRotatedAt)}</Text>
          {device.active ? <TouchableOpacity
            testID={`access-device-rotate-${device.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            style={[styles.secondaryButton, saving && styles.disabled]}
            onPress={() => { void rotateDeviceToken(device.id); }}
          >
            <Text style={styles.secondaryButtonText}>Rotacionar token</Text>
          </TouchableOpacity> : null}
        </View>) : <View style={styles.emptyState}><Text style={styles.emptyTitle}>Nenhum dispositivo configurado</Text><Text style={styles.emptyText}>O Access Center não cria dispositivos sem um contrato canônico de backend.</Text></View>}
      </View>

      {lastDeviceToken?.deviceToken ? <View style={styles.oneTimeSecret} testID="access-device-token-one-time">
        <Text style={styles.secretEyebrow}>EXIBIÇÃO ÚNICA</Text>
        <Text style={styles.secretTitle}>Novo token do dispositivo</Text>
        <Text style={styles.secretHelp}>Atualize o dispositivo físico com este segredo. O valor não será exibido novamente.</Text>
        <Text selectable style={styles.secretValue}>{lastDeviceToken.deviceToken}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setLastDeviceToken(null)}>
          <Text style={styles.secondaryButtonText}>Ocultar token</Text>
        </TouchableOpacity>
      </View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  kpiCard: { flexGrow: 1, flexBasis: 160, minWidth: 140, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  kpiLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { color: '#eef6ff', fontSize: 23, fontWeight: '900', marginTop: 3 },
  filterBar: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 8, marginBottom: 8, gap: 7 },
  filterGroup: { gap: 4 },
  filterLabel: { color: '#71879e', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipActive: { borderColor: '#2f91ff', backgroundColor: '#102b4d' },
  filterChipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  miniChip: { borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  mainGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  primaryPane: { flexGrow: 2, flexBasis: 600, minWidth: 300, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  sidePane: { flexGrow: 1, flexBasis: 330, minWidth: 290, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  sectionTitle: { color: '#eef6ff', fontSize: 15, fontWeight: '900' },
  sectionSubtitle: { color: '#9aadc1', fontSize: 10, lineHeight: 15, marginTop: 2 },
  credentialList: { gap: 6 },
  credentialCard: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 9 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 7 },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#eef6ff', fontSize: 11, fontWeight: '900' },
  cardMeta: { color: '#9aadc1', fontSize: 9, marginTop: 2 },
  cardDetail: { color: '#71879e', fontSize: 9, marginTop: 5 },
  statusPill: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusPrimary: { borderColor: '#1e4d7a', backgroundColor: '#0b2340' },
  statusDanger: { borderColor: '#7f1d1d', backgroundColor: '#2b1015' },
  statusWarning: { borderColor: '#76591b', backgroundColor: '#241b08' },
  statusText: { color: '#cbd5e1', fontSize: 9, fontWeight: '900' },
  statusTextPrimary: { color: '#bfdbfe' },
  statusTextDanger: { color: '#fecaca' },
  statusTextWarning: { color: '#fde68a' },
  fieldLabel: { color: '#9aadc1', fontSize: 10, fontWeight: '800', marginBottom: 4, marginTop: 7 },
  input: { color: '#eef6ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  studentPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  studentChip: { borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  typeChip: { borderWidth: 1, borderColor: '#2a3b52', backgroundColor: '#050b14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  primaryButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9, marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 34, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: '#111a29', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 7 },
  secondaryButtonText: { color: '#dce9f6', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  oneTimeSecret: { marginTop: 9, padding: 10, borderRadius: 10, backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#2f91ff' },
  secretEyebrow: { color: '#93c5fd', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  secretTitle: { color: '#eef6ff', fontSize: 12, fontWeight: '900', marginTop: 3 },
  secretHelp: { color: '#b3c3d5', fontSize: 9, lineHeight: 14, marginTop: 3 },
  secretValue: { color: '#eef6ff', backgroundColor: '#050b14', borderRadius: 8, padding: 8, marginTop: 7, fontSize: 10, lineHeight: 15 },
  timelineSection: { marginTop: 8, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 9, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#17263a' },
  timelineDot: { width: 9, height: 9, marginTop: 4, borderRadius: 999, backgroundColor: '#2f91ff', borderWidth: 2, borderColor: '#93c5fd' },
  timelineDotDenied: { backgroundColor: '#7f1d1d', borderColor: '#fecaca' },
  timelineContent: { flex: 1, minWidth: 0 },
  denialReason: { color: '#fecaca', fontSize: 9, marginTop: 4 },
  deviceSection: { marginTop: 8, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 11 },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  deviceCard: { flexGrow: 1, flexBasis: 260, minWidth: 230, maxWidth: 420, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 9 },
  emptyState: { paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#dce9f6', fontSize: 11, fontWeight: '900' },
  emptyText: { color: '#71879e', fontSize: 9, textAlign: 'center', marginTop: 3 },
});
