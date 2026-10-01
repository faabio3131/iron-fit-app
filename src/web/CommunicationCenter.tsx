import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { IronInput as TextInput } from '../components/IronInput';

type Props = {
  canManageAutomations?: boolean;
  canInspectIntegrations?: boolean;
};

const statusLabels: Record<string, string> = {
  QUEUED: 'Na fila',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  FAILED: 'Falhou',
  CANCELED: 'Cancelada',
};

const failureLabels: Record<string, string> = {
  COMMUNICATION_CONSENT_REQUIRED: 'O aluno não autorizou comunicações.',
  WHATSAPP_PREFERENCE_DISABLED: 'O aluno desativou mensagens por WhatsApp.',
  RECIPIENT_PHONE_MISSING: 'O aluno não possui telefone cadastrado.',
  PROVIDER_CONNECTION_MISSING: 'Conexão Meta/WhatsApp indisponível para esta academia.',
  PROVIDER_CONNECTION_AMBIGUOUS: 'Há mais de uma conexão Meta elegível; revise as integrações.',
  OAUTH_ACCESS_TOKEN_EXPIRED: 'A autorização Meta expirou e precisa ser renovada.',
  CHANNEL_NOT_EXTERNAL_I6: 'Canal externo não suportado nesta versão.',
  MESSAGE_STATE_CHANGED: 'A mensagem mudou de estado antes do envio.',
};

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(value: unknown) {
  const key = String(value ?? '');
  return statusLabels[key] ?? (key || 'Indisponível');
}

function providerHasWhatsApp(connection: any) {
  return (
    String(connection?.providerCode ?? '').toLowerCase() === 'meta'
    && connection?.status === 'ACTIVE'
    && Array.isArray(connection?.capabilities)
    && connection.capabilities.some(
      (capability: unknown) => String(capability).toLowerCase() === 'meta.whatsapp',
    )
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CommunicationCenter({
  canManageAutomations = false,
  canInspectIntegrations = false,
}: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [environment, setEnvironment] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const metaConnection = useMemo(
    () => connections.find(providerHasWhatsApp) ?? null,
    [connections],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [templateRows, messageRows, studentRows, automationRows, connectionRows, providerCatalog] =
        await Promise.all([
          api('/communication/templates'),
          api('/communication/messages'),
          api('/students'),
          canManageAutomations ? api('/communication/automations') : Promise.resolve([]),
          canInspectIntegrations ? api('/integrations/connections') : Promise.resolve([]),
          canInspectIntegrations ? api('/integrations/providers') : Promise.resolve(null),
        ]);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setMessages(Array.isArray(messageRows) ? messageRows : []);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
      setAutomations(Array.isArray(automationRows) ? automationRows : []);
      setConnections(Array.isArray(connectionRows) ? connectionRows : []);
      setEnvironment(typeof providerCatalog?.environment === 'string' ? providerCatalog.environment : '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar o Communication Center.');
    } finally {
      setLoading(false);
    }
  }, [canInspectIntegrations, canManageAutomations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedStudentId) return;
    let active = true;
    api('/students/' + selectedStudentId)
      .then((student) => {
        if (active) setSelectedStudent(student);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Falha ao verificar o aluno.');
      });
    return () => {
      active = false;
    };
  }, [selectedStudentId]);

  const studentLoading =
    !!selectedStudentId && selectedStudent?.id !== selectedStudentId;

  function selectStudent(studentId: string) {
    setSelectedStudent(null);
    setSelectedStudentId(studentId);
  }

  async function execute(operation: () => Promise<unknown>, success: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.');
    } finally {
      setSaving(false);
    }
  }

  function chooseTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setMessageTitle(String(template.title ?? ''));
      setMessageBody(String(template.body ?? ''));
    }
  }

  function createTemplate() {
    if (!templateName.trim() || !templateBody.trim()) return;
    void execute(
      () =>
        api('/communication/templates', undefined, {
          method: 'POST',
          body: JSON.stringify({
            name: templateName.trim(),
            channel: 'WHATSAPP',
            ...(templateTitle.trim() ? { title: templateTitle.trim() } : {}),
            body: templateBody.trim(),
          }),
        }),
      'Modelo de WhatsApp criado.',
    ).then(() => {
      setTemplateName('');
      setTemplateTitle('');
      setTemplateBody('');
    });
  }

  function queueMessage() {
    if (
      !selectedStudentId
      || !selectedStudent?.consentComm
      || !messageBody.trim()
      || studentLoading
    ) {
      return;
    }
    void execute(
      () =>
        api('/communication/messages', undefined, {
          method: 'POST',
          body: JSON.stringify({
            studentId: selectedStudentId,
            ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
            channel: 'WHATSAPP',
            ...(messageTitle.trim() ? { title: messageTitle.trim() } : {}),
            body: messageBody.trim(),
          }),
        }),
      'Mensagem adicionada à fila de envio.',
    ).then(() => {
      setMessageTitle('');
      setMessageBody('');
      setSelectedTemplateId('');
    });
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#2f91ff" />
        <Text style={styles.muted}>Carregando comunicação da academia…</Text>
      </View>
    );
  }

  const failedCount = messages.filter((item) => item.status === 'FAILED').length;
  const queuedCount = messages.filter((item) => ['QUEUED', 'SENDING'].includes(item.status)).length;
  const sentCount = messages.filter((item) => ['SENT', 'DELIVERED', 'READ'].includes(item.status)).length;

  return (
    <View testID="communication-center">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>COMMUNICATION CENTER</Text>
          <Text style={styles.heroTitle}>Comunicação com alunos</Text>
          <Text style={styles.muted}>
            Modelos, fila e status reais. O servidor valida consentimento, preferência, conexão Meta e credencial antes do envio externo.
          </Text>
        </View>
        <View style={styles.providerCard}>
          <Text style={styles.kicker}>WhatsApp</Text>
          <Text style={styles.providerValue}>
            {canInspectIntegrations
              ? metaConnection
                ? 'Conexão Meta ativa'
                : 'Conexão não disponível'
              : 'Validação pelo servidor'}
          </Text>
          <Text style={styles.meta}>
            {environment ? 'Ambiente ' + environment : 'Provider governado pelo Integration Center'}
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Na fila</Text>
          <Text style={styles.bigValue}>{queuedCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Enviadas</Text>
          <Text style={styles.bigValue}>{sentCount}</Text>
        </View>
        <View style={[styles.summaryCard, failedCount > 0 && styles.alertCard]}>
          <Text style={styles.kicker}>Falhas</Text>
          <Text style={styles.bigValue}>{failedCount}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.kicker}>Modelos</Text>
          <Text style={styles.bigValue}>{templates.length}</Text>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Nova mensagem</Text>
          <Text style={styles.muted}>
            A fila usa um identificador idempotente persistido pelo backend. O envio físico pode permanecer pendente se Meta não estiver homologado/configurado.
          </Text>

          <Text style={styles.label}>Aluno</Text>
          <View style={styles.chips}>
            {students.map((student) => (
              <TouchableOpacity
                key={student.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedStudentId === student.id }}
                style={[styles.chip, selectedStudentId === student.id && styles.chipActive]}
                onPress={() => selectStudent(student.id)}
              >
                <Text style={styles.chipText}>{student.name ?? student.email ?? 'Aluno'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {studentLoading ? (
            <Text style={styles.meta}>Verificando consentimento…</Text>
          ) : selectedStudent ? (
            <View style={selectedStudent.consentComm ? styles.consentOk : styles.consentBlocked}>
              <Text style={styles.consentTitle}>
                {selectedStudent.consentComm ? 'Comunicação autorizada' : 'Comunicação não autorizada'}
              </Text>
              <Text style={styles.meta}>
                A preferência específica de WhatsApp também será revalidada pelo servidor no dispatch.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Modelo opcional</Text>
          <View style={styles.chips}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedTemplateId }}
              style={[styles.chip, !selectedTemplateId && styles.chipActive]}
              onPress={() => chooseTemplate('')}
            >
              <Text style={styles.chipText}>Mensagem livre</Text>
            </TouchableOpacity>
            {templates
              .filter((template) => template.channel === 'WHATSAPP')
              .map((template) => (
                <TouchableOpacity
                  key={template.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedTemplateId === template.id }}
                  style={[styles.chip, selectedTemplateId === template.id && styles.chipActive]}
                  onPress={() => chooseTemplate(template.id)}
                >
                  <Text style={styles.chipText}>{template.name}</Text>
                </TouchableOpacity>
              ))}
          </View>

          <Text style={styles.label}>Título opcional</Text>
          <TextInput
            accessibilityLabel="Título da mensagem"
            style={styles.input}
            value={messageTitle}
            onChangeText={setMessageTitle}
            placeholder="Ex.: Lembrete"
            placeholderTextColor="#71879e"
          />
          <Text style={styles.label}>Mensagem</Text>
          <TextInput
            accessibilityLabel="Mensagem"
            style={[styles.input, styles.textArea]}
            value={messageBody}
            onChangeText={setMessageBody}
            multiline
            placeholder="Escreva a mensagem"
            placeholderTextColor="#71879e"
          />
          <ActionButton
            testID="communication-queue-message"
            label={saving ? 'Adicionando…' : 'Adicionar à fila'}
            disabled={
              saving
              || studentLoading
              || !selectedStudentId
              || selectedStudent?.consentComm !== true
              || !messageBody.trim()
            }
            onPress={queueMessage}
          />
        </View>

        <View style={styles.column}>
          <Text style={styles.sectionTitle}>Criar modelo</Text>
          <Text style={styles.muted}>
            Modelos desta V1 são específicos de WhatsApp. Nenhum canal sem adapter real é apresentado como disponível.
          </Text>
          <Text style={styles.label}>Nome do modelo</Text>
          <TextInput
            accessibilityLabel="Nome do modelo"
            style={styles.input}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="Ex.: Lembrete de treino"
            placeholderTextColor="#71879e"
          />
          <Text style={styles.label}>Título opcional</Text>
          <TextInput
            accessibilityLabel="Título do modelo"
            style={styles.input}
            value={templateTitle}
            onChangeText={setTemplateTitle}
            placeholder="Título interno"
            placeholderTextColor="#71879e"
          />
          <Text style={styles.label}>Conteúdo</Text>
          <TextInput
            accessibilityLabel="Conteúdo do modelo"
            style={[styles.input, styles.textArea]}
            value={templateBody}
            onChangeText={setTemplateBody}
            multiline
            placeholder="Mensagem do modelo"
            placeholderTextColor="#71879e"
          />
          <ActionButton
            testID="communication-create-template"
            label={saving ? 'Salvando…' : 'Salvar modelo'}
            disabled={saving || !templateName.trim() || !templateBody.trim()}
            onPress={createTemplate}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico e status</Text>
        <Text style={styles.muted}>
          O status abaixo vem da fila canônica do backend; falhas de provider não são convertidas em sucesso.
        </Text>
        {messages.length ? messages.map((message) => (
          <View key={message.id} style={styles.messageRow}>
            <View style={styles.messageCopy}>
              <Text style={styles.rowTitle}>
                {message.student?.user?.name ?? message.student?.user?.email ?? 'Aluno'}
              </Text>
              <Text style={styles.meta}>
                {statusLabel(message.status)} · WhatsApp · {formatDate(message.createdAt)}
              </Text>
              {message.body ? <Text style={styles.messageBody}>{String(message.body)}</Text> : null}
              {message.status === 'FAILED' ? (
                <Text style={styles.failureText}>
                  {failureLabels[String(message.lastErrorCode ?? '')]
                    ?? 'Falha operacional. Revise consentimento, preferência e Integration Center.'}
                </Text>
              ) : null}
              {message.attemptCount ? (
                <Text style={styles.meta}>Tentativas: {message.attemptCount}</Text>
              ) : null}
            </View>
            <Text style={message.status === 'FAILED' ? styles.failedBadge : styles.statusBadge}>
              {statusLabel(message.status)}
            </Text>
          </View>
        )) : (
          <Text style={styles.empty}>Nenhuma mensagem registrada.</Text>
        )}
      </View>

      {canManageAutomations ? (
        <View style={styles.section} testID="communication-automations">
          <Text style={styles.sectionTitle}>Automações</Text>
          <Text style={styles.muted}>
            Automações existentes são exibidas sem expor JSON técnico. A criação avançada permanece oculta até existir contrato comercial tipado para condições e ações.
          </Text>
          {automations.length ? automations.map((automation) => (
            <View key={automation.id} style={styles.automationRow}>
              <View>
                <Text style={styles.rowTitle}>{automation.name}</Text>
                <Text style={styles.meta}>Gatilho: {String(automation.triggerEvent ?? 'Não informado')}</Text>
              </View>
              <Text style={automation.active !== false ? styles.statusBadge : styles.failedBadge}>
                {automation.active !== false ? 'Ativa' : 'Inativa'}
              </Text>
            </View>
          )) : (
            <Text style={styles.empty}>Nenhuma automação ativa.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 260 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', marginTop: 3, marginBottom: 4 },
  providerCard: { minWidth: 190, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  providerValue: { color: '#eef7ff', fontSize: 13, fontWeight: '900', marginTop: 4 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  kicker: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  meta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 160, minWidth: 140, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 9 },
  alertCard: { borderColor: '#7f2d3a', backgroundColor: '#1a1018' },
  bigValue: { color: '#eef7ff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  column: { flexGrow: 1, flexBasis: 430, minWidth: 320, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  label: { color: '#9fb0c5', fontSize: 10, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  consentOk: { backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 9, padding: 8, marginBottom: 5 },
  consentBlocked: { backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', borderRadius: 9, padding: 8, marginBottom: 5 },
  consentTitle: { color: '#eef7ff', fontSize: 10, fontWeight: '900' },
  button: { alignSelf: 'flex-start', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  secondaryButton: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  buttonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  messageRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10, marginTop: 7 },
  messageCopy: { flex: 1, minWidth: 240 },
  rowTitle: { color: '#eef7ff', fontSize: 12, fontWeight: '900' },
  messageBody: { color: '#cbd5e1', fontSize: 10, lineHeight: 15, marginTop: 5 },
  failureText: { color: '#fca5a5', fontSize: 9, lineHeight: 13, marginTop: 5 },
  statusBadge: { alignSelf: 'flex-start', color: '#bfdbfe', backgroundColor: '#0b2340', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  failedBadge: { alignSelf: 'flex-start', color: '#fecaca', backgroundColor: '#301215', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' },
  automationRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 10, padding: 9, marginTop: 6 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 9 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 9, borderRadius: 9, marginBottom: 8 },
});
