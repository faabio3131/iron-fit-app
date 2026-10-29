import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type Student = { id: string; name?: string; status?: string };
type Template = { id: string; name?: string; title?: string | null; body?: string; channel?: string };
type Message = {
  id: string; title?: string | null; body?: string; channel?: string; status?: string;
  createdAt?: string; student?: { user?: { name?: string } };
};
type Automation = { id: string; name?: string; triggerEvent?: string; active?: boolean };

const stateLabel: Record<string, string> = {
  QUEUED: 'Na fila', SENDING: 'Processando', SENT: 'Enviada ao provedor',
  DELIVERED: 'Entregue', READ: 'Lida', FAILED: 'Falha', CANCELED: 'Cancelada',
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <GlowCard style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    <View style={styles.body}>{children}</View>
  </GlowCard>;
}

function Button({ label, onPress, testID, disabled, secondary }: {
  label: string; onPress: () => void; testID?: string; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button"
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    disabled={disabled} onPress={onPress}>
    <Text style={secondary ? styles.secondaryText : styles.buttonText}>{label}</Text>
  </TouchableOpacity>;
}

export function CommunicationCenterPanel({ canManageAutomations }: { canManageAutomations: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [confirmQueue, setConfirmQueue] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api('/students'),
      api('/communication/templates'),
      api('/communication/messages'),
      canManageAutomations ? api('/communication/automations') : Promise.resolve([]),
    ]).then(([studentRows, templateRows, messageRows, automationRows]) => {
      if (!active) return;
      if (![studentRows, templateRows, messageRows, automationRows].every(Array.isArray)) {
        throw new Error('O servidor retornou dados inválidos de comunicação.');
      }
      setStudents(studentRows);
      setTemplates(templateRows);
      setMessages(messageRows);
      setAutomations(automationRows);
      setDataReady(true);
      setError('');
    }).catch((reason: unknown) => {
      if (active) {
        setDataReady(false);
        setStudents([]); setTemplates([]); setMessages([]); setAutomations([]);
        setSelectedStudentId(''); setSelectedTemplateId(''); setConfirmQueue(false);
        setError(reason instanceof Error ? reason.message : 'Falha ao consultar comunicação.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManageAutomations, refreshVersion]);

  function reload() {
    setLoading(true);
    setDataReady(false);
    setError('');
    setConfirmQueue(false);
    setRefreshVersion((v) => v + 1);
  }

  async function createTemplate() {
    if (!dataReady || loading || !templateName.trim() || !templateBody.trim() || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/communication/templates', undefined, {
        method: 'POST',
        body: JSON.stringify({
          name: templateName.trim(), channel: 'WHATSAPP', body: templateBody.trim(),
          ...(templateTitle.trim() ? { title: templateTitle.trim() } : {}),
        }),
      });
      setTemplateName(''); setTemplateTitle(''); setTemplateBody('');
      setNotice('Modelo cadastrado para esta academia.');
      reload();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o modelo.');
    } finally {
      setBusy(false);
    }
  }

  async function queueMessage() {
    if (!dataReady || loading || !selectedStudentId || !messageBody.trim() || busy || !confirmQueue) return;
    setBusy(true); setError(''); setNotice('');
    try {
      // The student's canonical consent comes from a tenant-scoped endpoint;
      // the backend dispatcher rechecks consent and channel preferences.
      const student = await api(`/students/${selectedStudentId}`);
      if (student?.status !== 'ACTIVE' || student?.consentComm !== true) {
        throw new Error('Aluno sem matrícula ativa ou consentimento para comunicação.');
      }
      const queued = await api('/communication/messages', undefined, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          channel: 'WHATSAPP',
          body: messageBody.trim(),
          ...(messageTitle.trim() ? { title: messageTitle.trim() } : {}),
          ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
        }),
      });
      setConfirmQueue(false);
      setMessageBody(''); setMessageTitle(''); setSelectedTemplateId('');
      setNotice(queued?.status === 'QUEUED'
        ? 'Mensagem adicionada à fila. Isso não confirma entrega: acompanhe o estado abaixo.'
        : 'Solicitação registrada. Consulte o histórico para verificar o resultado.');
      reload();
    } catch (reason: unknown) {
      setConfirmQueue(false);
      setError(reason instanceof Error ? reason.message : 'Não foi possível enfileirar a mensagem.');
    } finally {
      setBusy(false);
    }
  }

  if (!dataReady) return <View testID="communication-read-gate">
    <Section title="Comunicação indisponível" subtitle="Sem consulta confirmada do IRON, não é seguro apresentar listas vazias ou permitir novos envios.">
      {loading ? <ActivityIndicator testID="communication-loading" color="#2BF47A" /> : <>
        <Text testID="communication-read-error" style={styles.error}>{error || 'Não foi possível confirmar os dados da comunicação.'}</Text>
        <Button testID="communication-retry" label="Tentar novamente" onPress={reload} />
      </>}
    </Section>
  </View>;

  return <View>
    <Section title="Mensagens e entregas" subtitle="Status consultado no IRON: fila, processamento e confirmação de entrega são etapas distintas.">
      {loading ? <ActivityIndicator color="#2BF47A" /> : messages.length === 0
        ? <Text style={styles.muted}>Nenhuma mensagem registrada.</Text>
        : messages.slice(0, 50).map((item) => <View key={item.id} style={styles.entry}>
          <Text style={styles.heading}>{item.student?.user?.name ?? 'Aluno'} · {stateLabel[item.status ?? ''] ?? 'Status indisponível'}</Text>
          <Text style={styles.muted}>{item.channel === 'WHATSAPP' ? 'WhatsApp' : item.channel ?? 'Canal não definido'}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString('pt-BR')}` : ''}</Text>
          <Text style={styles.message}>{item.body ?? ''}</Text>
        </View>)}
      <Button testID="communication-refresh" label="Atualizar histórico" secondary onPress={reload} disabled={loading || busy} />
    </Section>

    <Section title="Preparar comunicação" subtitle="O envio WhatsApp exige consentimento do aluno e uma integração autorizada. Enfileirar não significa entregar.">
      <Text style={styles.muted}>Destinatário</Text>
      <View style={styles.chips}>
        {students.map((s) => <TouchableOpacity key={s.id} testID={`communication-student-${s.id}`}
          accessibilityRole="button" onPress={() => { setSelectedStudentId(s.id); setConfirmQueue(false); }}
          style={[styles.chip, selectedStudentId === s.id && styles.chipSelected]}>
          <Text style={styles.chipText}>{s.name ?? 'Aluno'}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={styles.muted}>Modelos disponíveis (opcional)</Text>
      <View style={styles.chips}>{templates.filter((t) => t.channel === 'WHATSAPP').map((t) =>
        <TouchableOpacity key={t.id} testID={`communication-use-template-${t.id}`}
          accessibilityRole="button" style={styles.chip} onPress={() => {
            setSelectedTemplateId(t.id); setMessageBody(t.body ?? '');
            setMessageTitle(t.title ?? ''); setConfirmQueue(false);
          }}>
          <Text style={styles.chipText}>{t.name ?? 'Modelo'}</Text>
        </TouchableOpacity>)}</View>
      <TextInput testID="communication-message-title" placeholder="Título (opcional)" placeholderTextColor="#64748b"
        style={styles.input} value={messageTitle} onChangeText={(v) => { setMessageTitle(v); setConfirmQueue(false); }} />
      <TextInput testID="communication-message-body" placeholder="Texto da mensagem" placeholderTextColor="#64748b"
        style={[styles.input, styles.multiline]} multiline value={messageBody}
        onChangeText={(v) => { setMessageBody(v); setSelectedTemplateId(''); setConfirmQueue(false); }} />
      {confirmQueue ? <View style={styles.actions}>
        <Text style={styles.muted}>Confirma colocar esta mensagem na fila de envio?</Text>
        <Button testID="communication-confirm-queue" label="Confirmar inclusão na fila" disabled={busy} onPress={() => { void queueMessage(); }} />
        <Button label="Cancelar" secondary onPress={() => setConfirmQueue(false)} />
      </View> : <Button testID="communication-prepare-queue" label="Revisar envio" disabled={busy || !selectedStudentId || !messageBody.trim()} onPress={() => setConfirmQueue(true)} />}
    </Section>

    <Section title="Modelos de comunicação" subtitle="Criados no domínio canônico da academia, sem chaves externas no navegador.">
      <TextInput testID="communication-template-name" style={styles.input} placeholder="Nome do modelo"
        placeholderTextColor="#64748b" value={templateName} onChangeText={setTemplateName} />
      <TextInput style={styles.input} placeholder="Título (opcional)" placeholderTextColor="#64748b"
        value={templateTitle} onChangeText={setTemplateTitle} />
      <TextInput testID="communication-template-body" style={[styles.input, styles.multiline]}
        placeholder="Conteúdo do modelo WhatsApp" placeholderTextColor="#64748b" multiline
        value={templateBody} onChangeText={setTemplateBody} />
      <Button testID="communication-template-create" label="Cadastrar modelo" disabled={busy || !templateName.trim() || !templateBody.trim()} onPress={() => { void createTemplate(); }} />
      <Text style={styles.muted}>{templates.length} modelo(s) cadastrados</Text>
    </Section>

    {canManageAutomations ? <Section title="Automações cadastradas" subtitle="Consulta de regras persistidas; execução governada pelo backend.">
      {automations.length ? automations.map((a) => <View key={a.id} style={styles.entry}>
        <Text style={styles.heading}>{a.name ?? 'Automação'}</Text>
        <Text style={styles.muted}>Gatilho: {a.triggerEvent ?? '—'} · {a.active ? 'Ativa' : 'Inativa'}</Text>
      </View>) : <Text style={styles.muted}>Nenhuma automação cadastrada.</Text>}
    </Section> : null}
    {notice ? <Text testID="communication-notice" style={styles.notice}>{notice}</Text> : null}
    {error ? <Text testID="communication-error" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12 },
  sectionTitle: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  body: { marginTop: 12, gap: 10 },
  heading: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 19 },
  message: { color: '#e2e8f0', fontSize: 13, marginTop: 5 },
  entry: { borderBottomWidth: 1, borderBottomColor: '#273248', paddingVertical: 10 },
  input: { color: '#f8fafc', backgroundColor: '#0b1120', borderWidth: 1, borderColor: '#2a3650',
    borderRadius: 9, padding: 10, minHeight: 42 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#2BF47A', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#04140b', fontSize: 12, fontWeight: '800' },
  secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  secondaryText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: '#334155', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipSelected: { backgroundColor: '#123524', borderColor: '#2BF47A' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
  actions: { gap: 8 },
  error: { color: '#fca5a5', fontSize: 13, padding: 12 },
  notice: { color: '#2BF47A', fontSize: 13, padding: 12 },
});
