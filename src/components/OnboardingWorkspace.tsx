import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlowCard } from './GlowCard';

type Step = 'ACADEMY_PROFILE' | 'EQUIPMENT_INVENTORY' | 'TEAM_REVIEW' | 'FINISH';
type OnboardingState = {
  status?: string; completedSteps?: string[]; nextStep?: string | null;
};
type Target = 'equipment' | 'team';
type Props = {
  state: OnboardingState | null; name: string; timezone: string; saving: boolean;
  onNameChange: (value: string) => void; onTimezoneChange: (value: string) => void;
  onComplete: (step: Step, data?: { name: string; timezone: string }) => void;
  availableTargets: readonly Target[];
  onNavigate: (target: Target) => void;
};
const steps: { key: Step; label: string; summary: string; target?: Target }[] = [
  { key: 'ACADEMY_PROFILE', label: 'Dados da academia', summary: 'Identificação e fuso horário oficial' },
  { key: 'EQUIPMENT_INVENTORY', label: 'Inventário de equipamentos', summary: 'Conferir se os equipamentos cadastrados estão corretos', target: 'equipment' },
  { key: 'TEAM_REVIEW', label: 'Revisão da equipe', summary: 'Revisar os membros e as permissões', target: 'team' },
  { key: 'FINISH', label: 'Finalizar configuração', summary: 'Confirmar que as etapas anteriores foram verificadas' },
];
function Action({ label, testID, disabled, secondary, onPress }: {
  label: string; testID: string; disabled?: boolean; secondary?: boolean; onPress: () => void;
}) {
  return <TouchableOpacity accessibilityRole="button" testID={testID} disabled={disabled}
    onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </TouchableOpacity>;
}

export function OnboardingWorkspace({ state, name, timezone, saving, onNameChange,
  onTimezoneChange, onComplete, availableTargets, onNavigate }: Props) {
  const [confirmedStep, setConfirmedStep] = useState<Step | null>(null);
  const completed = Array.isArray(state?.completedSteps) ? state.completedSteps : [];
  const step = steps.find((item) => item.key === state?.nextStep);
  const done = state?.status === 'COMPLETED' && state.nextStep == null;
  const knownState = !!state && (done || !!step);

  const filled = name.trim().length >= 2 && timezone.trim().length > 0;
  const ready = step?.key === 'ACADEMY_PROFILE' ? filled : step?.key === confirmedStep;
  const stepCount = completed.filter((key) => steps.some((item) => item.key === key)).length;
  return <View testID="onboarding-workspace">
    <GlowCard style={styles.card}>
      <Text style={styles.title}>Configuração da academia</Text>
      <Text style={styles.muted}>A sequência de implantação e os registros de conclusão vêm do backend do IRON. Nenhuma etapa é dada como concluída sem confirmação do servidor.</Text>
      {knownState ? <Text style={styles.progress} testID="onboarding-progress">
        {done ? 'Configuração concluída' : stepCount + ' de ' + steps.length + ' etapas concluídas'}
      </Text> : <Text testID="onboarding-unknown" style={styles.warning}>
        Estado de configuração não confirmado. As ações permanecem indisponíveis.
      </Text>}
    </GlowCard>

    <GlowCard style={styles.card}>
      <Text style={styles.title}>Etapas de implantação</Text>
      {steps.map((item, index) => {
        const completedStep = completed.includes(item.key);
        const current = item.key === step?.key && !done;
        return <View key={item.key} style={[styles.step, current && styles.current]} testID={'onboarding-step-' + item.key}>
          <Text style={styles.stepTitle}>{index + 1}. {item.label}</Text>
          <Text style={styles.muted}>{item.summary}</Text>
          <Text style={completedStep ? styles.completed : current ? styles.currentLabel : styles.muted}>
            {completedStep ? 'Concluída no IRON' : current ? 'Etapa atual' : 'Aguardando etapa anterior'}
          </Text>
        </View>;
      })}
    </GlowCard>

    {step && !done ? <GlowCard style={styles.card}>
      <Text style={styles.title}>{step.label}</Text>
      <Text style={styles.muted}>{step.summary}</Text>
      {step.key === 'ACADEMY_PROFILE' ? <View style={styles.fields}>
        <Text style={styles.label}>Nome da academia</Text>
        <TextInput testID="onboarding-academy-name" accessibilityLabel="Nome da academia" style={styles.input}
          value={name} onChangeText={onNameChange} placeholder="Nome comercial" placeholderTextColor="#94a3b8" />
        <Text style={styles.label}>Fuso horário (padrão IANA)</Text>
        <TextInput testID="onboarding-academy-timezone" accessibilityLabel="Fuso horário" style={styles.input}
          value={timezone} onChangeText={onTimezoneChange} placeholder="America/Sao_Paulo" placeholderTextColor="#94a3b8" />
        <Text style={styles.muted}>O backend validará o fuso horário antes de concluir a etapa.</Text>
      </View> : <>
        {step.target && availableTargets.includes(step.target) ? <Action
          testID={'onboarding-open-' + step.target} label={step.target === 'equipment' ? 'Abrir inventário real' : 'Abrir equipe e permissões'}
          secondary onPress={() => onNavigate(step.target!)} /> : null}
        {step.target && !availableTargets.includes(step.target) ? <Text style={styles.warning}>
          O seu perfil ou plano não permite abrir este módulo nesta sessão. Acesse por uma conta autorizada para realizar a revisão.
        </Text> : null}
        <Text style={styles.warning}>{step.key === 'FINISH'
          ? 'Confirme que os dados anteriores foram revisados antes de finalizar.'
          : 'O IRON não marca uma revisão como concluída apenas por abrir a tela. Verifique o cadastro antes de confirmar.'}</Text>
        <Action testID="onboarding-review-ack" label={confirmedStep === step.key ? 'Revisão confirmada nesta tela' : 'Confirmar que revisei esta etapa'}
          secondary disabled={saving || (!!step.target && !availableTargets.includes(step.target))}
          onPress={() => setConfirmedStep(step.key)} />
      </>}
      <Action testID="onboarding-complete-step" label={saving ? 'Salvando…' : 'Concluir etapa no IRON'}
        disabled={saving || !ready || (!!step.target && !availableTargets.includes(step.target))}
        onPress={() => {
          if (!ready || saving) return;
          onComplete(step.key, step.key === 'ACADEMY_PROFILE' ? { name: name.trim(), timezone: timezone.trim() } : undefined);
        }} />
    </GlowCard> : null}
    {done ? <GlowCard style={styles.card}>
      <Text style={styles.completed}>Configuração concluída no backend do IRON.</Text>
      <Text style={styles.muted}>Os módulos operacionais continuam sujeitos a perfil, permissão e assinatura ativa.</Text>
    </GlowCard> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 10 },
  title: { color: '#2BF47A', fontWeight: '800', fontSize: 17 },
  muted: { color: '#a8b9ca', fontSize: 12, lineHeight: 18 },
  progress: { color: '#f1f9f3', fontWeight: '800', fontSize: 14 },
  warning: { color: '#f7c58a', fontSize: 12, lineHeight: 18 },
  completed: { color: '#2BF47A', fontSize: 12, fontWeight: '800' },
  currentLabel: { color: '#d8f5e1', fontSize: 12, fontWeight: '800' },
  step: { borderTopWidth: 1, borderColor: '#2a3945', paddingVertical: 11, gap: 4 },
  current: { backgroundColor: '#152b23', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12 },
  stepTitle: { color: '#f0f6f9', fontWeight: '800', fontSize: 13 },
  fields: { gap: 7 },
  label: { color: '#c5d2e0', fontSize: 12, fontWeight: '700' },
  input: { color: '#f9fafb', backgroundColor: '#0d1522', padding: 10, borderColor: '#3e4f5f', borderWidth: 1, borderRadius: 8 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2BF47A', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 9 },
  buttonText: { color: '#071b0c', fontWeight: '800', fontSize: 12 },
  secondary: { backgroundColor: '#172a35', borderColor: '#34505d', borderWidth: 1 },
  secondaryText: { color: '#e5f3ed' },
  disabled: { opacity: 0.45 },
});
