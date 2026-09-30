import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IronInput as TextInput } from '../components/IronInput';

type EntitlementWorkspaceProps = {
  subscription: any;
  features: any[];
  saving: boolean;
  onSetConfiguration: (featureKey: string, payload: Record<string, unknown>) => Promise<void>;
  onResetConfiguration: (featureKey: string) => Promise<void>;
};

const domainLabels: Record<string, string> = {
  CORE: 'Recursos principais',
  CONTENT: 'Conteúdo',
  EQUIPMENT: 'Equipamentos',
  AGGREGATOR: 'Agregadores',
  ANALYTICS: 'Indicadores e análises',
  AI: 'IRON Intelligence',
  INTEGRATION: 'Integrações',
};

const featureLabels: Record<string, string> = {
  'equipment.catalog': 'Catálogo de equipamentos',
  'equipment.inventory': 'Inventário de equipamentos',
  'ai.workout_generation': 'Geração assistida de treinos',
  'ai.content_recommendation': 'Recomendação inteligente de conteúdo',
  'content.external_youtube': 'Conteúdo externo do YouTube',
  'content.iron_managed': 'Conteúdo gerenciado pelo IRON',
  'content.tenant_private': 'Conteúdo privado da academia',
  'content.private_items_max': 'Limite de conteúdo privado',
  'content.delivery_mode': 'Modo de entrega de conteúdo',
  'aggregator.wellhub': 'Wellhub',
  'aggregator.totalpass': 'TotalPass',
  'analytics.aggregator': 'Indicadores de agregadores',
  'integration.meta': 'Meta — Facebook, Instagram e WhatsApp',
  'integration.google': 'Google',
};

const policyLabels: Record<string, string> = {
  YOUTUBE_EXTERNAL: 'YouTube externo',
  IRON_FIRST: 'Priorizar conteúdo IRON',
  TENANT_PRIVATE_FIRST: 'Priorizar conteúdo da academia',
  IRON_ONLY: 'Somente conteúdo IRON',
  YOUTUBE_ONLY: 'Somente YouTube',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  TRIALING: 'Em teste',
  SUSPENDED: 'Suspenso',
  CANCELED: 'Cancelado',
  PUBLISHED: 'Publicado',
  RETIRED: 'Legado',
};

const sourceLabels: Record<string, string> = {
  PLAN_ENTITLEMENT: 'Incluído no plano',
  TENANT_CONFIGURATION: 'Personalizado pela academia',
  FAIL_CLOSED_DEFAULT: 'Bloqueado por segurança',
};

const reasonLabels: Record<string, string> = {
  TENANT_INACTIVE_OR_MISSING: 'Academia inativa ou indisponível.',
  NO_ACTIVE_TENANT_SUBSCRIPTION: 'Nenhum plano ativo foi encontrado.',
  PLAN_VERSION_NOT_EFFECTIVE: 'A versão do plano não está disponível.',
  ENTITLEMENT_NOT_GRANTED: 'Este recurso não faz parte do plano atual.',
  INVALID_ENTITLEMENT_DATA: 'O plano contém uma configuração inválida.',
  INVALID_TENANT_CONFIGURATION: 'A personalização da academia é inválida.',
  TENANT_CONFIGURATION_EXCEEDS_PLAN: 'A personalização excede o que o plano permite.',
};

function humanize(value: string) {
  return value
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function featureName(feature: any) {
  return featureLabels[feature?.featureKey] ?? humanize(String(feature?.featureKey ?? 'Recurso'));
}

function policyName(value: string) {
  return policyLabels[value] ?? humanize(value);
}

function valueText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Desativado';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => policyName(String(item))).join(' · ') : 'Nenhuma opção';
  return 'Não disponível';
}

function planName(subscription: any) {
  return subscription?.planVersion?.productPlan?.name
    ?? subscription?.planVersion?.productPlan?.displayName
    ?? 'Plano IRON';
}

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

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipActive, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  secondary,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  secondary?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EntitlementCard({
  feature,
  saving,
  onSetConfiguration,
  onResetConfiguration,
}: {
  feature: any;
  saving: boolean;
  onSetConfiguration: EntitlementWorkspaceProps['onSetConfiguration'];
  onResetConfiguration: EntitlementWorkspaceProps['onResetConfiguration'];
}) {
  const planValue = feature?.planValue;
  const effectiveValue = feature?.value;
  const [limitDraft, setLimitDraft] = useState(
    typeof effectiveValue === 'number'
      ? String(effectiveValue)
      : typeof planValue === 'number'
        ? String(planValue)
        : '',
  );
  const [policyDraft, setPolicyDraft] = useState<string[]>(
    Array.isArray(effectiveValue)
      ? effectiveValue.map(String)
      : Array.isArray(planValue)
        ? planValue.map(String)
        : [],
  );

  const source = String(feature?.source ?? '');
  const inherited = source === 'PLAN_ENTITLEMENT';
  const blocked = source === 'FAIL_CLOSED_DEFAULT';
  const planAllowsFeature = feature?.kind !== 'FEATURE' || planValue === true;
  const description = String(feature?.definition?.description ?? '').trim();

  function togglePolicy(value: string) {
    setPolicyDraft((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  const planPolicyValues = Array.isArray(planValue) ? planValue.map(String) : [];
  const parsedLimit = Number(limitDraft);
  const validLimit =
    feature?.kind !== 'LIMIT'
    || (
      limitDraft.trim() !== ''
      && Number.isInteger(parsedLimit)
      && parsedLimit >= 0
      && typeof planValue === 'number'
      && parsedLimit <= planValue
    );

  return (
    <View style={[styles.featureCard, blocked && styles.featureCardBlocked]}>
      <View style={styles.featureHead}>
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>{featureName(feature)}</Text>
          {description ? <Text style={styles.featureDescription}>{description}</Text> : null}
        </View>
        <Text style={blocked ? styles.badgeBlocked : inherited ? styles.badgePlan : styles.badgeCustom}>
          {sourceLabels[source] ?? 'Configuração protegida'}
        </Text>
      </View>

      <View style={styles.valueGrid}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Seu plano permite</Text>
          <Text style={styles.valueText}>{valueText(planValue)}</Text>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Configuração efetiva</Text>
          <Text style={styles.valueText}>{valueText(effectiveValue)}</Text>
        </View>
      </View>

      {blocked ? (
        <Text style={styles.warningText}>
          {reasonLabels[String(feature?.reason ?? '')] ?? 'Este recurso está bloqueado de forma segura.'}
        </Text>
      ) : null}

      {feature?.kind === 'FEATURE' && planAllowsFeature ? (
        <View style={styles.actions}>
          {effectiveValue === true ? (
            <ActionButton
              testID={`entitlement-disable-${feature.featureKey}`}
              label="Desativar para a academia"
              disabled={saving}
              onPress={() => {
                void onSetConfiguration(feature.featureKey, { featureEnabled: false });
              }}
            />
          ) : (
            <ActionButton
              testID={`entitlement-inherit-${feature.featureKey}`}
              label="Usar o recurso do plano"
              disabled={saving || inherited}
              onPress={() => {
                void onResetConfiguration(feature.featureKey);
              }}
            />
          )}
        </View>
      ) : null}

      {feature?.kind === 'LIMIT' && typeof planValue === 'number' && !blocked ? (
        <View style={styles.configurationBox}>
          <Text style={styles.configurationTitle}>Limite da academia</Text>
          <Text style={styles.configurationHelp}>
            Defina um valor entre 0 e {planValue}. A academia não pode ultrapassar o limite contratado.
          </Text>
          <TextInput
            accessibilityLabel={`Limite de ${featureName(feature)}`}
            style={styles.input}
            value={limitDraft}
            onChangeText={(value) => setLimitDraft(value.replace(/\D/g, ''))}
            keyboardType="numeric"
            placeholder={String(planValue)}
            placeholderTextColor="#71879e"
          />
          {!validLimit ? <Text style={styles.warningText}>Informe um limite inteiro entre 0 e {planValue}.</Text> : null}
          <View style={styles.actions}>
            <ActionButton
              testID={`entitlement-limit-apply-${feature.featureKey}`}
              label="Aplicar limite"
              disabled={saving || !validLimit}
              onPress={() => {
                if (!validLimit) return;
                void onSetConfiguration(feature.featureKey, { limitValue: parsedLimit });
              }}
            />
            <ActionButton
              secondary
              label="Usar limite do plano"
              disabled={saving || inherited}
              onPress={() => {
                void onResetConfiguration(feature.featureKey);
              }}
            />
          </View>
        </View>
      ) : null}

      {feature?.kind === 'POLICY' && !blocked ? (
        <View style={styles.configurationBox}>
          <Text style={styles.configurationTitle}>Preferência da academia</Text>
          <Text style={styles.configurationHelp}>
            Selecione somente entre as opções autorizadas pelo seu plano.
          </Text>
          <View style={styles.chipRow}>
            {planPolicyValues.map((value) => (
              <Chip
                key={value}
                label={policyName(value)}
                selected={policyDraft.includes(value)}
                disabled={saving}
                onPress={() => togglePolicy(value)}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <ActionButton
              testID={`entitlement-policy-apply-${feature.featureKey}`}
              label="Aplicar preferência"
              disabled={saving || policyDraft.length === 0}
              onPress={() => {
                void onSetConfiguration(feature.featureKey, { policyValues: policyDraft });
              }}
            />
            <ActionButton
              secondary
              label="Usar opções do plano"
              disabled={saving || inherited}
              onPress={() => {
                void onResetConfiguration(feature.featureKey);
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function EntitlementsWorkspace({
  subscription,
  features,
  saving,
  onSetConfiguration,
  onResetConfiguration,
}: EntitlementWorkspaceProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const feature of features) {
      const domain = String(feature?.definition?.domain ?? 'CORE');
      const current = map.get(domain) ?? [];
      current.push(feature);
      map.set(domain, current);
    }
    return [...map.entries()];
  }, [features]);

  const activeCount = features.filter((feature) =>
    feature?.kind === 'FEATURE' ? feature?.value === true : feature?.value != null,
  ).length;
  const customizedCount = features.filter(
    (feature) => feature?.source === 'TENANT_CONFIGURATION',
  ).length;
  const blockedCount = features.filter(
    (feature) => feature?.source === 'FAIL_CLOSED_DEFAULT',
  ).length;

  return (
    <View testID="entitlements-workspace">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>PLANO E CONFIGURAÇÕES</Text>
          <Text style={styles.heroTitle}>{planName(subscription)}</Text>
          <Text style={styles.heroDescription}>
            Veja o que seu plano inclui e personalize somente o que pode ser restringido pela academia.
          </Text>
        </View>
        <View style={styles.planStatus}>
          <Text style={styles.planStatusLabel}>Situação do plano</Text>
          <Text style={styles.planStatusValue}>
            {statusLabels[String(subscription?.status ?? '')] ?? 'Indisponível'}
          </Text>
          <Text style={styles.planStatusMeta}>
            Versão {subscription?.planVersion?.version ?? '—'} · desde {formatDate(subscription?.effectiveFrom)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Recursos disponíveis</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryMeta}>Recursos, limites e políticas efetivamente disponíveis</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Personalizações</Text>
          <Text style={styles.summaryValue}>{customizedCount}</Text>
          <Text style={styles.summaryMeta}>Configurações específicas desta academia</Text>
        </View>
        <View style={[styles.summaryCard, blockedCount > 0 && styles.summaryAlert]}>
          <Text style={styles.summaryLabel}>Bloqueios seguros</Text>
          <Text style={styles.summaryValue}>{blockedCount}</Text>
          <Text style={styles.summaryMeta}>Itens indisponíveis ou inconsistentes permanecem fail-closed</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Hierarquia de autoridade</Text>
        <Text style={styles.infoText}>
          O plano define o máximo contratado. A academia pode apenas restringir recursos, limites e políticas.
          Preferências pessoais dos alunos podem restringir ainda mais a experiência, nunca ampliá-la.
        </Text>
      </View>

      {grouped.length ? grouped.map(([domain, rows]) => (
        <View key={domain} style={styles.section}>
          <Text style={styles.sectionTitle}>{domainLabels[domain] ?? humanize(domain)}</Text>
          <Text style={styles.sectionSubtitle}>
            {rows.length} {rows.length === 1 ? 'configuração disponível' : 'configurações disponíveis'}
          </Text>
          <View style={styles.featureGrid}>
            {rows.map((feature: any) => (
              <EntitlementCard
                key={`${feature.featureKey}:${JSON.stringify(feature.value)}:${feature.source}`}
                feature={feature}
                saving={saving}
                onSetConfiguration={onSetConfiguration}
                onResetConfiguration={onResetConfiguration}
              />
            ))}
          </View>
        </View>
      )) : (
        <View style={styles.section}>
          <Text style={styles.empty}>Nenhum recurso comercial foi disponibilizado para o plano atual.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 14, marginBottom: 8 },
  heroCopy: { flex: 1, minWidth: 280 },
  eyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: '#eef7ff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  heroDescription: { color: '#9fb0c5', fontSize: 11, lineHeight: 16, marginTop: 4 },
  planStatus: { minWidth: 190, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  planStatusLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  planStatusValue: { color: '#eef7ff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  planStatusMeta: { color: '#8296ab', fontSize: 9, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 210, minWidth: 180, backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 12, padding: 10 },
  summaryAlert: { borderColor: '#7f2d3a', backgroundColor: '#1a1018' },
  summaryLabel: { color: '#71879e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  summaryValue: { color: '#eef7ff', fontSize: 19, fontWeight: '900', marginTop: 4 },
  summaryMeta: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 3 },
  infoCard: { backgroundColor: '#071a31', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 11, padding: 10, marginBottom: 8 },
  infoTitle: { color: '#dbeafe', fontSize: 11, fontWeight: '900' },
  infoText: { color: '#9fb0c5', fontSize: 10, lineHeight: 15, marginTop: 3 },
  section: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#203b55', borderRadius: 14, padding: 12, marginBottom: 8 },
  sectionTitle: { color: '#eef7ff', fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#8296ab', fontSize: 9, marginTop: 2, marginBottom: 7 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  featureCard: { flexGrow: 1, flexBasis: 390, minWidth: 300, backgroundColor: '#050b14', borderWidth: 1, borderColor: '#203b55', borderRadius: 11, padding: 10 },
  featureCardBlocked: { borderColor: '#5a3040' },
  featureHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  featureCopy: { flex: 1, minWidth: 220 },
  featureTitle: { color: '#eef7ff', fontSize: 13, fontWeight: '900' },
  featureDescription: { color: '#8296ab', fontSize: 9, lineHeight: 14, marginTop: 3 },
  badgePlan: { color: '#bfdbfe', backgroundColor: '#0b2340', borderWidth: 1, borderColor: '#1e4d7a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '800' },
  badgeCustom: { color: '#dbeafe', backgroundColor: '#102b4d', borderWidth: 1, borderColor: '#2f91ff', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '800' },
  badgeBlocked: { color: '#fecaca', backgroundColor: '#2b1015', borderWidth: 1, borderColor: '#7f2d3a', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '800' },
  valueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  valueBox: { flexGrow: 1, flexBasis: 150, minWidth: 130, backgroundColor: '#071528', borderRadius: 8, padding: 7 },
  valueLabel: { color: '#71879e', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  valueText: { color: '#dce9f6', fontSize: 10, fontWeight: '800', lineHeight: 14, marginTop: 3 },
  configurationBox: { borderTopWidth: 1, borderTopColor: '#17263a', marginTop: 9, paddingTop: 8 },
  configurationTitle: { color: '#dce9f6', fontSize: 11, fontWeight: '900' },
  configurationHelp: { color: '#8296ab', fontSize: 9, lineHeight: 13, marginTop: 2, marginBottom: 6 },
  input: { color: '#eef7ff', backgroundColor: '#071528', borderWidth: 1, borderColor: '#243247', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, minWidth: 150, maxWidth: 250 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#071528', borderWidth: 1, borderColor: '#2a3b52', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  chipActive: { backgroundColor: '#102b4d', borderColor: '#2f91ff' },
  chipText: { color: '#a9b9ca', fontSize: 9, fontWeight: '800' },
  chipTextActive: { color: '#eef7ff' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  button: { backgroundColor: '#176bc1', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 },
  buttonSecondary: { backgroundColor: '#08172a', borderWidth: 1, borderColor: '#2a3b52' },
  buttonText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.42 },
  warningText: { color: '#fecaca', fontSize: 9, lineHeight: 13, marginTop: 6 },
  empty: { color: '#71879e', fontSize: 10, paddingVertical: 8 },
});
