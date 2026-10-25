import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OnboardingWorkspace } from '../src/components/OnboardingWorkspace';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const onComplete = jest.fn();
const onNavigate = jest.fn();
const onNameChange = jest.fn();
const onTimezoneChange = jest.fn();
beforeEach(() => { jest.clearAllMocks(); });

function mount(nextStep: string | null, opts: Partial<React.ComponentProps<typeof OnboardingWorkspace>> = {}) {
  const state = { status: nextStep ? 'IN_PROGRESS' : 'COMPLETED',
    completedSteps: nextStep === 'ACADEMY_PROFILE' ? [] : ['ACADEMY_PROFILE'], nextStep };
  return render(<OnboardingWorkspace state={state} name="Academia Teste" timezone="America/Sao_Paulo"
    saving={false} onNameChange={onNameChange} onTimezoneChange={onTimezoneChange}
    onComplete={onComplete} availableTargets={['team', 'equipment']} onNavigate={onNavigate} {...opts} />);
}

test('C04 canonical backend steps are visible but not marked complete locally', () => {
  const view = mount('ACADEMY_PROFILE');
  expect(view.getByTestId('onboarding-step-ACADEMY_PROFILE')).toBeTruthy();
  expect(view.getByText('0 de 4 etapas concluídas')).toBeTruthy();
  expect(view.getByText('Etapa atual')).toBeTruthy();
  expect(view.getByText('Aguardando etapa anterior')).toBeTruthy();
});

test('C04 Academy Profile requires valid name and submits only canonical step/data', () => {
  const view = mount('ACADEMY_PROFILE', { name: 'A' });
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).not.toHaveBeenCalled();
  view.rerender(<OnboardingWorkspace state={{ status: 'NOT_STARTED', completedSteps: [], nextStep: 'ACADEMY_PROFILE' }}
    name="Academia Dois" timezone="America/Sao_Paulo" saving={false}
    onNameChange={onNameChange} onTimezoneChange={onTimezoneChange}
    onComplete={onComplete} availableTargets={['equipment', 'team']} onNavigate={onNavigate} />);
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).toHaveBeenCalledWith('ACADEMY_PROFILE',
    { name: 'Academia Dois', timezone: 'America/Sao_Paulo' });
});

test('C04 Equipment review opens real module and cannot be confirmed without acknowledgment', () => {
  const view = mount('EQUIPMENT_INVENTORY');
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('onboarding-open-equipment'));
  expect(onNavigate).toHaveBeenCalledWith('equipment');
  fireEvent.press(view.getByTestId('onboarding-review-ack'));
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).toHaveBeenCalledWith('EQUIPMENT_INVENTORY', undefined);
});

test('C04 no permission or entitlement to Equipment prevents marking it reviewed', () => {
  const view = mount('EQUIPMENT_INVENTORY', { availableTargets: [] });
  expect(view.queryByTestId('onboarding-open-equipment')).toBeNull();
  fireEvent.press(view.getByTestId('onboarding-review-ack'));
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).not.toHaveBeenCalled();
  expect(view.getByText(/perfil ou plano não permite abrir este módulo/)).toBeTruthy();
});

test('C04 unknown state and completed onboarding are fail-closed / display backend-confirmed completion only', () => {
  let view = mount('UNRECOGNIZED');
  expect(view.getByTestId('onboarding-unknown')).toBeTruthy();
  expect(view.queryByTestId('onboarding-complete-step')).toBeNull();
  view.unmount();
  view = mount(null, { state: { status: 'COMPLETED', completedSteps: ['ACADEMY_PROFILE', 'EQUIPMENT_INVENTORY', 'TEAM_REVIEW', 'FINISH'], nextStep: null } });
  expect(view.getByText(/Configuração concluída no backend/)).toBeTruthy();
  expect(view.queryByTestId('onboarding-complete-step')).toBeNull();
});

test('C04 final step needs explicit review and cannot be sent twice while saving', () => {
  const view = mount('FINISH');
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('onboarding-review-ack'));
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).toHaveBeenCalledWith('FINISH', undefined);
  onComplete.mockClear();
  view.rerender(<OnboardingWorkspace state={{ status: 'IN_PROGRESS', completedSteps: ['ACADEMY_PROFILE', 'EQUIPMENT_INVENTORY', 'TEAM_REVIEW'], nextStep: 'FINISH' }}
    name="Academia" timezone="America/Sao_Paulo" saving onNameChange={onNameChange}
    onTimezoneChange={onTimezoneChange} onComplete={onComplete} availableTargets={['team','equipment']} onNavigate={onNavigate} />);
  fireEvent.press(view.getByTestId('onboarding-complete-step'));
  expect(onComplete).not.toHaveBeenCalled();
});
