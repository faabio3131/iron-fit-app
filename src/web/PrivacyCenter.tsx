import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { IronInput as TextInput } from '../components/IronInput';

type PrivacyCenterProps = {
  canOperatePrivacy?: boolean;
};

const requestTypeLabels: Record<string, string> = {
  ACCESS: 'Acesso aos meus dados',
  CORRECTION: 'Correção de dados',
  DELETION: 'Exclusão de dados',
  PORTABILITY: 'Portabilidade',
  RESTRICTION: 'Restrição de tratamento',
  OBJECTION: 'Oposição ao tratamento',
};

const requestStatusLabels: Record<string, string> = {
  OPEN: 'Aberta',
  IN_REVIEW: 'Em análise',
  FULFILLED: 'Concluída',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
};

const documentKindLabels: Record<string, string> = {
  PRIVACY_POLICY: 'Política de Privacidade',
  TERMS_OF_SERVICE: 'Termos de Uso',
};

const requestTypes = [
  'ACCESS',
  'CORRECTION',
  'DELETION',
  'PORTABILITY',
  'RESTRICTION',
  'OBJECTION',
];

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary,
  danger,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PrivacyCenter({ canOperatePrivacy = false }: PrivacyCenterProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [governance, setGovernance] = useState<any>(null);
  const [selectedType, setSelectedType] = useState('ACCESS');
  const [selectedOperation, setSelectedOperation] = useState('');
  const [resolutionCode, setResolutionCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const acceptedDocumentIds = useMemo(
    () => new Set(acceptances.map((item) => item.legalDocumentId)),
    [acceptances],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, legalDocuments, mineAcceptances, ops, governanceState] = await Promise.all([
        api('/privacy/dsr'),
        api('/privacy/legal-documents'),
        api('/privacy/legal-acceptances'),
        canOperatePrivacy ? api('/privacy/operations/dsr') : Promise.resolve([]),
        canOperatePrivacy ? api('/privacy/operations/governance') : Promise.resolve(null),
      ]);
      setRequests(Array.isArray(mine) ? mine : []);
      setDocuments(Array.isArray(legalDocuments) ? legalDocuments : []);
      setAcceptances(Array.isArray(mineAcceptances) ? mineAcceptances : []);
      setOperations(Array.isArray(ops) ? ops : []);
      setGovernance(governanceState);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar o Privacy Center.');
    } finally {
      setLoading(false);
    }
  }, [canOperatePrivacy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

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

  function createRequest() {
    void execute(
      () =>
        api('/privacy/dsr', undefined, {
          method: 'POST',
          body: JSON.stringify({ type: selectedType }),
        }),
      'Solicitação de privacidade registrada.',
    );
  }

  function cancelRequest(requestId: string) {
    void execute(
      () =>
        api('/privacy/dsr/cancel', undefined, {
          method: 'POST',
          body: JSON.stringify({ requestId }),
        }),
      'Solicitação cancelada.',
    );
  }

  function acceptDocument(legalDocumentId: string) {
    void execute(
      () =>
        api('/privacy/legal-acceptances', undefined, {
          method: 'POST',
          body: JSON.stringify({ legalDocumentId }),
        }),
      'Aceite registrado.',
    );
  }

  function reviewRequest(requestId: string, status: 'IN_REVIEW' | 'FULFILLED' | 'REJECTED') {
    void execute(
      () =>
        api('/privacy/operations/dsr/' + requestId + '/review', undefined, {
          method: 'POST',
          body: JSON.stringify({
            status,
            ...(status === 'REJECTED' && resolutionCode.trim()
              ? { resolutionCode: resolutionCode.trim() }
              : {}),
          }),
        }),
      'Status operacional atualizado.',
    ).then(() => {
      setSelectedOperation('');
      setResolutionCode('');
    });
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#2f91ff" />
        <Text style={styles.muted}>Carregando privacidade e documentos…</Text>
      </View>
    );
  }

  return (
    <View testID="privacy-center">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>PRIVACY CENTER</Text>
          <Text style={styles.heroTitle}>Privacidade e dados pessoais</Text>
          <Text style={styles.muted}>
            Consulte documentos vigentes, seus aceites e o andamento das solicitações relacionadas aos seus dados.
          </Text>
        </View>
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Solicitações ativas</Text>
          <Text style={styles.bigValue}>
            {requests.filter((item) => ['OPEN', 'IN_REVIEW'].includes(item.status)).length}
          </Text>
          <Text style={styles.meta}>Abertas ou em análise</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solicitar exercício de direito</Text>
        <Text style={styles.muted}>
          O IRON registra a solicitação e permite acompanhar o status. Nenhum prazo legal é inventado pela interface.
        </Text>
        <View style={styles.chips}>
          {requestTypes.map((type) => (
            <TouchableOpacity
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedType === type }}
              style={[styles.chip, selectedType === type && styles.chipActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={styles.chipText}>{requestTypeLabels[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ActionButton
          testID="privacy-create-request"
          label={saving ? 'Registrando…' : 'Registrar solicitação'}
          disabled={saving}
          onPress={createRequest}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minhas solicitações</Text>
        <Text style={styles.muted}>Histórico e status das solicitações registradas por esta conta.</Text>
        {requests.length ? requests.map((request) => (
          <View key={request.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>
                {requestTypeLabels[String(request.type)] ?? String(request.type)}
              </Text>
              <Text style={styles.meta}>
                {requestStatusLabels[String(request.status)] ?? String(request.status)}
                {' · '}
                solicitada em {formatDate(request.requestedAt)}
              </Text>
              {request.completedAt ? (
                <Text style={styles.meta}>Encerrada em {formatDate(request.completedAt)}</Text>
              ) : null}
            </View>
            {request.status === 'OPEN' ? (
              <ActionButton
                secondary
                testID={'privacy-cancel-' + request.id}
                label="Cancelar"
                disabled={saving}
                onPress={() => cancelRequest(request.id)}
              />
            ) : null}
          </View>
        )) : (
          <Text style={styles.empty}>Nenhuma solicitação registrada.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentos legais vigentes</Text>
        <Text style={styles.muted}>
          Somente versões aprovadas e vigentes pelo backend são exibidas para leitura e aceite.
        </Text>
        {documents.length ? documents.map((document) => {
          const accepted = acceptedDocumentIds.has(document.id);
          return (
            <View key={document.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {documentKindLabels[String(document.kind)] ?? 'Documento legal'}
                </Text>
                <Text style={styles.meta}>
                  Versão {document.version} · vigente desde {formatDate(document.effectiveAt)}
                </Text>
                <Text style={accepted ? styles.acceptedBadge : styles.pendingBadge}>
                  {accepted ? 'Aceite registrado' : 'Aceite pendente'}
                </Text>
              </View>
              <View style={styles.actions}>
                {typeof document.contentUrl === 'string' && document.contentUrl ? (
                  <ActionButton
                    secondary
                    label="Abrir documento"
                    onPress={() => {
                      void Linking.openURL(document.contentUrl);
                    }}
                  />
                ) : null}
                {!accepted ? (
                  <ActionButton
                    testID={'privacy-accept-' + document.id}
                    label={saving ? 'Registrando…' : 'Aceitar'}
                    disabled={saving}
                    onPress={() => acceptDocument(document.id)}
                  />
                ) : null}
              </View>
            </View>
          );
        }) : (
          <Text style={styles.empty}>Nenhum documento legal aprovado está disponível.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meus aceites</Text>
        <Text style={styles.muted}>Registro das versões legais aceitas por esta conta.</Text>
        {acceptances.length ? acceptances.map((acceptance) => (
          <View key={acceptance.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>
                {documentKindLabels[String(acceptance.legalDocument?.kind)] ?? 'Documento legal'}
              </Text>
              <Text style={styles.meta}>
                Versão {acceptance.legalDocument?.version ?? '—'} · aceito em {formatDate(acceptance.acceptedAt)}
              </Text>
            </View>
          </View>
        )) : (
          <Text style={styles.empty}>Nenhum aceite registrado.</Text>
        )}
      </View>

      {canOperatePrivacy ? (
        <View style={styles.adminSection} testID="privacy-operations">
          <Text style={styles.adminEyebrow}>GOVERNANÇA RESTRITA</Text>
          <Text style={styles.sectionTitle}>Operação de privacidade</Text>
          <Text style={styles.muted}>
            Área exclusiva de SUPER_ADMIN. Aprovação jurídica continua externa ao software.
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.kicker}>DSR abertas</Text>
              <Text style={styles.bigValue}>{Number(governance?.openRequests ?? 0)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.kicker}>Retenção aprovada</Text>
              <Text style={styles.summaryText}>{governance?.gate?.retentionApproved ? 'Sim' : 'Não'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.kicker}>Subprocessadores revisados</Text>
              <Text style={styles.summaryText}>{governance?.gate?.subprocessorsReviewed ? 'Sim' : 'Não'}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.kicker}>Política / termos</Text>
              <Text style={styles.summaryText}>
                {governance?.gate?.privacyPolicyApproved && governance?.gate?.termsApproved ? 'Aprovados' : 'Pendência jurídica'}
              </Text>
            </View>
          </View>

          {operations.length ? operations.map((request) => (
            <View key={request.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {requestTypeLabels[String(request.type)] ?? String(request.type)}
                </Text>
                <Text style={styles.meta}>
                  {requestStatusLabels[String(request.status)] ?? String(request.status)}
                  {' · '}
                  {formatDate(request.requestedAt)}
                </Text>
              </View>
              {!['FULFILLED', 'REJECTED', 'CANCELLED'].includes(request.status) ? (
                <View style={styles.actions}>
                  <ActionButton
                    secondary
                    label="Em análise"
                    disabled={saving}
                    onPress={() => reviewRequest(request.id, 'IN_REVIEW')}
                  />
                  <ActionButton
                    label="Concluir"
                    disabled={saving}
                    onPress={() => reviewRequest(request.id, 'FULFILLED')}
                  />
                  <ActionButton
                    danger
                    label="Rejeitar"
                    disabled={saving}
                    onPress={() => setSelectedOperation(request.id)}
                  />
                </View>
              ) : null}

              {selectedOperation === request.id ? (
                <View style={styles.rejectBox}>
                  <Text style={styles.kicker}>Código operacional da rejeição</Text>
                  <TextInput
                    accessibilityLabel="Código operacional da rejeição"
                    style={styles.input}
                    value={resolutionCode}
                    onChangeText={setResolutionCode}
                    placeholder="Ex.: IDENTITY_NOT_VERIFIED"
                    placeholderTextColor="#71879e"
                    autoCapitalize="characters"
                  />
                  <View style={styles.actions}>
                    <ActionButton
                      danger
                      label="Confirmar rejeição"
                      disabled={saving || !resolutionCode.trim()}
                      onPress={() => reviewRequest(request.id, 'REJECTED')}
                    />
                    <ActionButton
                      secondary
                      label="Cancelar"
                      onPress={() => {
                        setSelectedOperation('');
                        setResolutionCode('');
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )) : (
            <Text style={styles.empty}>Nenhuma solicitação operacional pendente.</Text>
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
  heroCard: { minWidth: 170, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  muted: { color: '#9fb0c5', fontSize: 11, lineHeight: 16 },
  kicker: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  bigValue: { color: '#eef7ff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  meta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 13, marginBottom: 8 },
  adminSection: { backgroundColor: '#10131c', borderWidth: 1, borderColor: '#5a3340', borderRadius: 14, padding: 13, marginBottom: 8 },
  adminEyebrow: { color: '#fca5a5', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginBottom: 3 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  chip: { minHeight: 36, justifyContent: 'center', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#dce9f6', fontSize: 10, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10, marginTop: 7 },
  rowCopy: { flex: 1, minWidth: 240 },
  rowTitle: { color: '#eef7ff', fontSize: 12, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  secondaryButton: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  dangerButton: { backgroundColor: '#7f1d1d' },
  buttonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  acceptedBadge: { alignSelf: 'flex-start', color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800', marginTop: 5 },
  pendingBadge: { alignSelf: 'flex-start', color: '#fde68a', backgroundColor: '#2a210d', borderWidth: 1, borderColor: '#785e13', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800', marginTop: 5 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 180, minWidth: 160, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 9 },
  summaryText: { color: '#eef7ff', fontSize: 12, fontWeight: '900', marginTop: 4 },
  rejectBox: { width: '100%', backgroundColor: '#160d12', borderWidth: 1, borderColor: '#5a3340', borderRadius: 9, padding: 9 },
  input: { color: '#eef7ff', backgroundColor: '#050b14', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, marginVertical: 6 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 9 },
  error: { color: '#fca5a5', backgroundColor: '#301215', borderWidth: 1, borderColor: '#7f2d3a', padding: 9, borderRadius: 9, marginBottom: 8 },
  notice: { color: '#bfdbfe', backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', padding: 9, borderRadius: 9, marginBottom: 8 },
});
