import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type RequestType = 'ACCESS' | 'CORRECTION' | 'DELETION' | 'PORTABILITY' | 'RESTRICTION' | 'OBJECTION';
type Dsr = { id: string; type: RequestType; status: string; requestedAt?: string; completedAt?: string };
type Document = { id: string; kind: string; version: string; contentUrl?: string | null; effectiveAt?: string | null };
type Acceptance = { id: string; legalDocumentId: string; acceptedAt?: string };
type Consents = { available: boolean; consentHealth: boolean | null; consentComm: boolean | null; consentBiometry: boolean | null };
const dsrLabels: Record<RequestType, string> = {
  ACCESS: 'Acesso aos dados', CORRECTION: 'Correção', DELETION: 'Eliminação',
  PORTABILITY: 'Portabilidade', RESTRICTION: 'Restrição de tratamento', OBJECTION: 'Oposição ao tratamento',
};
const statusLabels: Record<string, string> = {
  OPEN: 'Aberta', IN_REVIEW: 'Em análise', FULFILLED: 'Concluída',
  REJECTED: 'Recusada', CANCELLED: 'Cancelada',
};
const documentNames: Record<string, string> = {
  PRIVACY_POLICY: 'Política de privacidade', TERMS_OF_SERVICE: 'Termos de serviço',
};

function Button({ testID, label, onPress, disabled = false, secondary = false }: {
  testID?: string; label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}
function dateLabel(input?: string) {
  if (!input) return 'Não informado';
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleString('pt-BR');
}
function errorText(reason: unknown) {
  if (reason instanceof Error && (reason as Error & { status?: number }).status === 403)
    return 'Seu perfil não possui permissão para esta operação.';
  return reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.';
}
function labelFor(key: string) {
  return documentNames[key] ?? 'Documento oficial';
}

export function PrivacyCenterPanel() {
  const [requests, setRequests] = useState<Dsr[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [consents, setConsents] = useState<Consents | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingType, setPendingType] = useState<RequestType | null>(null);
  const [pendingCancel, setPendingCancel] = useState('');
  const [pendingAccept, setPendingAccept] = useState('');
  const [visitedDocument, setVisitedDocument] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([
      api('/privacy/dsr'),
      api('/privacy/legal-documents'),
      api('/privacy/legal-acceptances'),
      api('/privacy/consents'),
    ]).then(([dsr, docs, accepted, own]) => {
      if (!live) return;
      setRequests(Array.isArray(dsr) ? dsr : []);
      setDocuments(Array.isArray(docs) ? docs : []);
      setAcceptances(Array.isArray(accepted) ? accepted : []);
      setConsents(own && typeof own === 'object' ? own : null);
      setLoadError('');
    }).catch((reason: unknown) => {
      if (live) {
        setLoadError(errorText(reason));
        setRequests([]); setDocuments([]); setAcceptances([]); setConsents(null);
      }
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [revision]);

  async function mutate(operation: () => Promise<unknown>, success: string, reset: () => void) {
    if (busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await operation();
      reset();
      setNotice(success);
      setRevision((current) => current + 1);
      setLoading(true);
    } catch (reason) {
      setActionError(errorText(reason));
    } finally { setBusy(false); }
  }

  async function openDocument(document: Document) {
    const url = document.contentUrl ?? '';
    if (!/^https:\/\//i.test(url)) {
      setActionError('O documento não possui um endereço HTTPS válido. Não é possível confirmar a leitura.');
      return;
    }
    try {
      await Linking.openURL(url);
      setVisitedDocument(document.id);
      setActionError('');
    } catch {
      setActionError('Não foi possível abrir o documento. Verifique o endereço antes de aceitar.');
    }
  }

  return <View>
    <GlowCard style={styles.panel}>
      <Text style={styles.title}>Central de privacidade</Text>
      <Text style={styles.muted}>Direitos LGPD, documentos oficiais e escolhas de privacidade da sua conta. A administração global das solicitações pertence exclusivamente à FM Tecnologia.</Text>
      <Button testID="privacy-refresh" label="Atualizar dados" secondary disabled={loading} onPress={() => { setLoading(true); setRevision((v) => v + 1); }} />
      {loading ? <View style={styles.loading}><ActivityIndicator color="#2BF47A" /><Text style={styles.muted}>Consultando seus registros…</Text></View> : null}
      {loadError ? <Text testID="privacy-load-error" style={styles.error}>{loadError}</Text> : null}
      {notice ? <Text testID="privacy-notice" style={styles.success}>{notice}</Text> : null}
      {actionError ? <Text testID="privacy-action-error" style={styles.error}>{actionError}</Text> : null}
    </GlowCard>
    {!loading && !loadError ? <>
      <GlowCard style={styles.panel}>
        <Text style={styles.title}>Seus direitos sobre os dados</Text>
        <Text style={styles.muted}>Solicite uma operação sobre seus próprios dados. A solicitação não executa exclusões automaticamente; a FM fará a análise governada.</Text>
        <View style={styles.actions}>
          {(Object.keys(dsrLabels) as RequestType[]).map((type) =>
            <Button key={type} testID={'privacy-request-' + type} label={dsrLabels[type]}
              secondary={pendingType !== type} disabled={busy} onPress={() => setPendingType(type)} />)}
        </View>
        {pendingType ? <View testID="privacy-request-confirmation" style={styles.confirm}>
          <Text style={styles.warning}>Confirma abrir uma solicitação de {dsrLabels[pendingType].toLocaleLowerCase('pt-BR')} em seu nome?</Text>
          <View style={styles.actions}>
            <Button testID="privacy-request-submit" label="Confirmar solicitação" disabled={busy}
              onPress={() => { void mutate(() => api('/privacy/dsr', undefined, { method: 'POST', body: JSON.stringify({ type: pendingType }) }),
                'Solicitação registrada. A análise e os prazos são responsabilidade do processo LGPD.', () => setPendingType(null)); }} />
            <Button label="Voltar" secondary disabled={busy} onPress={() => setPendingType(null)} />
          </View>
        </View> : null}
        <Text style={styles.subtitle}>Histórico de solicitações</Text>
        {requests.map((request) => <View key={request.id} style={styles.entry}>
          <Text style={styles.entryTitle}>{dsrLabels[request.type] ?? 'Solicitação LGPD'}</Text>
          <Text style={styles.muted}>{statusLabels[request.status] ?? 'Estado não identificado'} · {dateLabel(request.requestedAt)}</Text>
          {request.status === 'OPEN' ? pendingCancel === request.id ? <View style={styles.actions}>
            <Text style={styles.warning}>Confirma cancelar esta solicitação ainda aberta?</Text>
            <Button testID={'privacy-cancel-confirm-' + request.id} label="Confirmar cancelamento" disabled={busy}
              onPress={() => { void mutate(() => api('/privacy/dsr/cancel', undefined, { method: 'POST', body: JSON.stringify({ requestId: request.id }) }),
                'Cancelamento confirmado pelo servidor.', () => setPendingCancel('')); }} />
            <Button label="Voltar" secondary disabled={busy} onPress={() => setPendingCancel('')} />
          </View> : <Button testID={'privacy-cancel-' + request.id} label="Cancelar solicitação" secondary disabled={busy}
            onPress={() => setPendingCancel(request.id)} /> : null}
        </View>)}
        {!requests.length ? <Text style={styles.muted}>Você ainda não abriu solicitações LGPD.</Text> : null}
      </GlowCard>
      <GlowCard style={styles.panel}>
        <Text style={styles.title}>Documentos legais</Text>
        <Text style={styles.muted}>Somente documentos aprovados e vigentes são listados pela API. Abra o conteúdo oficial antes de confirmar seu aceite.</Text>
        {documents.map((doc) => {
          const accepted = acceptances.some((acceptance) => acceptance.legalDocumentId === doc.id);
          return <View key={doc.id} style={styles.entry}>
            <Text style={styles.entryTitle}>{labelFor(doc.kind)} · versão {doc.version}</Text>
            <Text style={styles.muted}>Vigência: {dateLabel(doc.effectiveAt)} · {accepted ? 'Aceite registrado' : 'Aceite pendente'}</Text>
            <View style={styles.actions}>
              <Button testID={'privacy-document-open-' + doc.id} label="Abrir documento" secondary onPress={() => { void openDocument(doc); }} />
              {!accepted && pendingAccept === doc.id && visitedDocument === doc.id ? <>
                <Text style={styles.warning}>Confirma que leu este documento e deseja registrar o aceite?</Text>
                <Button testID={'privacy-document-accept-confirm-' + doc.id} label="Confirmar aceite" disabled={busy}
                  onPress={() => { void mutate(() => api('/privacy/legal-acceptances', undefined, { method: 'POST', body: JSON.stringify({ legalDocumentId: doc.id }) }),
                    'Aceite registrado no backend.', () => setPendingAccept('')); }} />
                <Button label="Voltar" secondary onPress={() => setPendingAccept('')} />
              </> : !accepted ? <Button testID={'privacy-document-accept-' + doc.id} label="Registrar aceite"
                disabled={visitedDocument !== doc.id || busy} onPress={() => setPendingAccept(doc.id)} /> : null}
            </View>
          </View>;
        })}
        {!documents.length ? <Text style={styles.muted}>Nenhum documento aprovado disponível. Nenhum aceite pode ser realizado.</Text> : null}
      </GlowCard>
      <GlowCard style={styles.panel}>
        <Text style={styles.title}>Consentimentos pessoais</Text>
        {consents?.available ? <>
          <Text style={styles.muted}>Estas escolhas se aplicam somente ao seu próprio perfil de aluno, quando existente.</Text>
          {([
            ['consentHealth', 'Dados de saúde'], ['consentComm', 'Comunicações'],
            ['consentBiometry', 'Biometria'],
          ] as const).map(([key, label]) => <View key={key} style={styles.entry}>
            <Text style={styles.entryTitle}>{label}</Text>
            <Text style={styles.muted}>Escolha atual: {consents[key] === true ? 'Autorizado' : consents[key] === false ? 'Não autorizado' : 'Não informado'}</Text>
            <View style={styles.actions}>
              <Button testID={'privacy-consent-enable-' + key} label="Autorizar" secondary={consents[key] !== true} disabled={busy || consents[key] === true}
                onPress={() => { void mutate(() => api('/privacy/consents', undefined, { method: 'PATCH', body: JSON.stringify({ [key]: true }) }),
                  'Consentimento atualizado.', () => undefined); }} />
              <Button testID={'privacy-consent-disable-' + key} label="Não autorizar" secondary={consents[key] !== false} disabled={busy || consents[key] === false}
                onPress={() => { void mutate(() => api('/privacy/consents', undefined, { method: 'PATCH', body: JSON.stringify({ [key]: false }) }),
                  'Consentimento atualizado.', () => undefined); }} />
            </View>
          </View>)}
        </> : <Text style={styles.muted}>Não existe perfil de aluno vinculado a esta conta. Nenhum consentimento de terceiros pode ser alterado aqui.</Text>}
      </GlowCard>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 16, marginBottom: 12, gap: 10 },
  title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#e9f5ff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  muted: { color: '#a8bacf', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { backgroundColor: '#2BF47A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, alignSelf: 'flex-start' },
  buttonText: { color: '#04140b', fontSize: 12, fontWeight: '800' },
  secondary: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155' },
  secondaryText: { color: '#f0f5ff' },
  disabled: { opacity: 0.45 },
  warning: { color: '#f4c387', fontSize: 12 },
  error: { color: '#fca5a5', fontSize: 12 },
  success: { color: '#2BF47A', fontSize: 12 },
  loading: { padding: 16, alignItems: 'center', gap: 10 },
  entry: { borderTopWidth: 1, borderTopColor: '#293347', paddingTop: 10, gap: 8 },
  entryTitle: { color: '#eef6ff', fontSize: 13, fontWeight: '700' },
  confirm: { backgroundColor: '#203022', borderRadius: 9, padding: 10, gap: 8 },
});