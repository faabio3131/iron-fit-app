import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';
import { api } from '../services/api';

type CatalogItem = {
  id: string; name: string; category?: string; slug?: string; selected?: boolean;
  manufacturerName?: string; modelName?: string; aliases?: string[];
  metadata?: { manufacturerName?: string; modelName?: string };
};
type InventoryItem = { id: string; name?: string; catalogItemId?: string | null; catalogItem?: CatalogItem };
type Candidate = {
  id: string; proposedName: string; proposedCategory?: string; status?: string;
  manufacturerName?: string; modelName?: string; reviewNotes?: string;
};
const candidateStatus: Record<string, string> = {
  PENDING: 'Em análise', APPROVED: 'Aprovado', REJECTED: 'Recusado', MERGED: 'Vinculado ao catálogo',
};
function Action({ label, testID, onPress, disabled = false }: {
  label: string; testID?: string; onPress: () => void; disabled?: boolean;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled} onPress={onPress}
    style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}
function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <GlowCard style={styles.block}><Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}<View style={styles.body}>{children}</View></GlowCard>;
}

export function EquipmentIntelligencePanel({ inventory, catalog, canManage, canSuggest, canGovern, catalogEnabled, onUpdated }: {
  inventory: InventoryItem[]; catalog: CatalogItem[];
  canManage: boolean; canSuggest: boolean; canGovern: boolean; catalogEnabled: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [serverRows, setServerRows] = useState<CatalogItem[] | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [governance, setGovernance] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedCatalogEquipment, setSelectedCatalogEquipment] = useState('');
  const [pendingDeselect, setPendingDeselect] = useState('');
  const [proposedName, setProposedName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  const [reviewing, setReviewing] = useState<{ id: string; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!canSuggest && !canGovern) return;
    let active = true;
    Promise.all([
      canSuggest ? api('/equipments/catalog/candidates') : Promise.resolve([]),
      canGovern ? api('/equipments/catalog/governance/candidates') : Promise.resolve([]),
    ]).then(([tenantRows, globalRows]) => {
      if (active) {
        setCandidates(Array.isArray(tenantRows) ? tenantRows : []);
        setGovernance(Array.isArray(globalRows) ? globalRows : []);
        setLoadingCandidates(false);
      }
    }).catch((reason: unknown) => {
      if (active) { setError(reason instanceof Error ? reason.message : 'Falha ao carregar candidatos.'); setLoadingCandidates(false); }
    });
    return () => { active = false; };
  }, [canSuggest, canGovern, revision]);

  const rows = serverRows ?? catalog;
  const categories = useMemo(() => Array.from(new Set(catalog.map((c) => c.category).filter((c): c is string => !!c))).sort(), [catalog]);
  const visible = rows.filter((row) =>
    (!category || row.category === category) &&
    [row.name, row.manufacturerName, row.modelName, row.metadata?.manufacturerName, row.metadata?.modelName]
      .some((value) => (value ?? '').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))),
  ).slice(0, 70);
  const selectedIds = new Set(inventory.map((i) => i.catalogItemId).filter(Boolean));

  async function perform(action: () => Promise<unknown>, success: string, reset?: () => void) {
    setBusy(true); setError(''); setMessage('');
    try {
      await action();
      reset?.();
      setMessage(success);
      await onUpdated();
      setRevision((v) => v + 1);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Operação não concluída.');
    } finally { setBusy(false); }
  }
  async function searchCatalog() {
    if (!catalogEnabled || busy) return;
    setBusy(true); setError('');
    try {
      const result = await api(`/equipments/catalog?limit=250${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`);
      setServerRows(Array.isArray(result) ? result : []);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Falha na pesquisa do catálogo.'); }
    finally { setBusy(false); }
  }
  async function review() {
    if (!canGovern || !reviewing) return;
    const choice = governance.find((c) => c.id === reviewing.id);
    if (!choice || (reviewing.decision === 'REJECT' && !reviewNotes.trim()) ||
        (reviewing.decision === 'APPROVE' && !choice.proposedCategory)) return;
    await perform(() => api(`/equipments/catalog/governance/candidates/${reviewing.id}/review`, undefined, {
      method: 'POST', body: JSON.stringify({
        decision: reviewing.decision,
        ...(reviewNotes.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
      }),
    }), 'Decisão registrada no catálogo canônico.', () => { setReviewing(null); setReviewNotes(''); });
  }

  return <View>
    {error ? <Text testID="equipment-error" style={styles.error}>{error}</Text> : null}
    {message ? <Text testID="equipment-success" style={styles.accent}>{message}</Text> : null}
    <Block title="Inventário da academia" subtitle="Equipamentos ativos registrados no tenant autenticado.">
      <Text style={styles.metric}>{inventory.length} equipamento(s)</Text>
      {inventory.length ? inventory.map((i) => <View key={i.id} style={styles.entry}>
        <Text style={styles.white}>{i.catalogItem?.name ?? i.name ?? 'Equipamento'}</Text>
        <Text style={styles.muted}>{i.catalogItem?.category ?? 'Categoria não informada'}</Text>
        {canManage && i.catalogItemId ? pendingDeselect === i.catalogItemId ?
          <View style={styles.actions}><Text style={styles.muted}>Confirma retirar este equipamento do inventário?</Text>
            <Action testID={`equipment-remove-confirm-${i.catalogItemId}`} label="Confirmar retirada" disabled={busy}
              onPress={() => { void perform(() => api(`/equipments/catalog/${i.catalogItemId}/selection`, undefined, { method: 'DELETE' }), 'Equipamento retirado.', () => setPendingDeselect('')); }} />
            <Action label="Cancelar" onPress={() => setPendingDeselect('')} />
          </View> :
          <Action testID={`equipment-remove-${i.catalogItemId}`} label="Retirar do inventário" disabled={busy}
            onPress={() => setPendingDeselect(i.catalogItemId ?? '')} /> : null}
      </View>) : <Text style={styles.muted}>Nenhum equipamento selecionado.</Text>}
    </Block>

    {catalogEnabled ? <Block title="Catálogo mestre de equipamentos" subtitle="Pesquisa e seleção no domínio canônico, sem cadastro manual paralelo.">
      <TextInput testID="equipment-search" placeholder="Pesquisar nome, modelo ou fabricante" placeholderTextColor="#64748b"
        style={styles.input} value={search} onChangeText={setSearch} />
      <View style={styles.actions}><Action testID="equipment-search-server" label="Pesquisar no catálogo inteiro" disabled={busy}
        onPress={() => { void searchCatalog(); }} />
        <Action label="Limpar filtros" onPress={() => { setSearch(''); setCategory(''); setServerRows(null); }} />
      </View>
      <ScrollView horizontal contentContainerStyle={styles.actions}>
        <Action label="Todas as categorias" onPress={() => setCategory('')} />
        {categories.map((c) => <Action key={c} label={c} onPress={() => setCategory(c)} />)}
      </ScrollView>
      {visible.map((item) => {
        const selected = selectedIds.has(item.id) || item.selected === true;
        return <TouchableOpacity key={item.id} accessibilityRole="button" testID={`equipment-item-${item.id}`}
          onPress={() => { setSelectedCatalogEquipment(item.id); setPendingDeselect(''); }}
          style={[styles.entry, selectedCatalogEquipment === item.id && styles.selected]}>
          <Text style={styles.white}>{item.name}</Text>
          <Text style={styles.muted}>{item.category ?? 'Outros'} · {selected ? 'No inventário' : 'Disponível'}</Text>
          <Text style={styles.muted}>{item.manufacturerName ?? item.metadata?.manufacturerName ?? 'Fabricante não informado'}
            {item.modelName ?? item.metadata?.modelName ? ` · ${item.modelName ?? item.metadata?.modelName}` : ''}</Text>
        </TouchableOpacity>;
      })}
      {visible.length === 0 ? <Text style={styles.muted}>Nenhum item corresponde aos filtros.</Text> : null}
      {canManage && selectedCatalogEquipment && !selectedIds.has(selectedCatalogEquipment) &&
        !rows.find((x) => x.id === selectedCatalogEquipment)?.selected ?
        <Action testID="equipment-catalog-select" label="Adicionar ao inventário" disabled={busy}
          onPress={() => { void perform(() => api('/equipments/catalog/selection', undefined, {
            method: 'POST', body: JSON.stringify({ catalogItemIds: [selectedCatalogEquipment] }),
          }), 'Equipamento adicionado.', () => { setSelectedCatalogEquipment(''); setServerRows(null); }); }} /> : null}
    </Block> : <Text style={styles.muted}>Catálogo indisponível para este plano.</Text>}

    {canSuggest ? <Block title="Sugerir equipamento ao catálogo" subtitle="Propostas passam por governança da FM. A sugestão não publica um item.">
      <TextInput testID="equipment-candidate-name" placeholder="Nome do equipamento" placeholderTextColor="#64748b" style={styles.input}
        value={proposedName} onChangeText={setProposedName} />
      <TextInput placeholder="Fabricante (opcional)" placeholderTextColor="#64748b" style={styles.input} value={manufacturer} onChangeText={setManufacturer} />
      <TextInput placeholder="Modelo (opcional)" placeholderTextColor="#64748b" style={styles.input} value={model} onChangeText={setModel} />
      <TextInput placeholder="Observações (opcional)" placeholderTextColor="#64748b" style={styles.input} value={notes} onChangeText={setNotes} />
      <Action testID="equipment-candidate-submit" label="Enviar para revisão" disabled={busy || proposedName.trim().length < 2}
        onPress={() => { void perform(() => api('/equipments/catalog/candidates', undefined, {
          method: 'POST', body: JSON.stringify({
            proposedName: proposedName.trim(),
            ...(manufacturer.trim() ? { manufacturerName: manufacturer.trim() } : {}),
            ...(model.trim() ? { modelName: model.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }),
        }), 'Sugestão enviada para revisão.', () => { setProposedName(''); setManufacturer(''); setModel(''); setNotes(''); }); }} />
      {loadingCandidates ? <ActivityIndicator color="#2BF47A" /> : null}
      {candidates.map((c) => <Text key={c.id} style={styles.white}>
        {c.proposedName} · {candidateStatus[c.status ?? ''] ?? 'Status não informado'}
      </Text>)}
    </Block> : null}
    {canGovern ? <Block title="Governança do catálogo (FM)" subtitle="Somente SUPER_ADMIN. A decisão é auditada no backend.">
      {governance.filter((c) => c.status === 'PENDING').map((c) => <View key={c.id} style={styles.entry}>
        <Text style={styles.white}>{c.proposedName} · {c.proposedCategory ?? 'Sem categoria canônica'}</Text>
        <Text style={styles.muted}>Academia proponente registrada no backend.</Text>
        {reviewing?.id === c.id ? <View style={styles.actions}>
          <Text style={styles.muted}>Revisão: {reviewing.decision === 'APPROVE' ? 'Aprovar e publicar no catálogo' : 'Recusar a proposta'}</Text>
          <TextInput testID="equipment-review-notes" placeholder="Justificativa da revisão" placeholderTextColor="#64748b"
            style={styles.input} value={reviewNotes} onChangeText={setReviewNotes} />
          <Action testID="equipment-review-confirm" label="Confirmar decisão" disabled={busy ||
            (reviewing.decision === 'REJECT' && !reviewNotes.trim()) ||
            (reviewing.decision === 'APPROVE' && !c.proposedCategory)}
            onPress={() => { void review(); }} />
          <Action label="Cancelar" onPress={() => { setReviewing(null); setReviewNotes(''); }} />
        </View> : <View style={styles.actions}>
          {c.proposedCategory ? <Action testID={`equipment-approve-${c.id}`} label="Revisar aprovação"
            onPress={() => setReviewing({ id: c.id, decision: 'APPROVE' })} /> : null}
          <Action testID={`equipment-reject-${c.id}`} label="Revisar recusa"
            onPress={() => setReviewing({ id: c.id, decision: 'REJECT' })} />
        </View>}
      </View>)}
      {governance.length === 0 ? <Text style={styles.muted}>Sem candidatos para governança.</Text> : null}
    </Block> : null}
  </View>;
}

const styles = StyleSheet.create({
  block: { padding: 16, marginBottom: 12 }, body: { marginTop: 10, gap: 10 },
  title: { color: '#2BF47A', fontSize: 17, fontWeight: '800' },
  metric: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
  white: { color: '#e2e8f0', fontWeight: '600', fontSize: 13 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  accent: { color: '#2BF47A', fontSize: 12, marginBottom: 8 },
  error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
  input: { borderRadius: 9, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0b1120', color: '#f8fafc', padding: 10 },
  entry: { borderBottomWidth: 1, borderBottomColor: '#273248', paddingVertical: 10, gap: 4 },
  actions: { gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  action: { backgroundColor: '#172033', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, alignSelf: 'flex-start' },
  actionText: { color: '#2BF47A', fontWeight: '700', fontSize: 12 },
  disabled: { opacity: 0.45 }, selected: { backgroundColor: '#123524', borderRadius: 8, paddingHorizontal: 8 },
});
