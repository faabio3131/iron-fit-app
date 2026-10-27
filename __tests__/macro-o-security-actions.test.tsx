import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

let mockProfile: any = {
  id: 'owner-1',
  name: 'Proprietário QA',
  email: 'owner@example.com',
  roles: ['OWNER'],
  permissions: [],
};
let mockFeatureSet: any[] = [];
const mockLogout = jest.fn(async () => undefined);
const mockApi = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    activeTenantId: 'gym-1',
    logout: mockLogout,
  }),
}));
jest.mock('../src/services/api', () => ({
  api: (...args: any[]) => mockApi(...args),
}));

import { CommercialWebApp } from '../src/web/CommercialWebApp';

function installApi() {
  mockApi.mockImplementation(async (path: string, _query?: unknown, options?: { method?: string; body?: string }) => {
    if (path === '/product-entitlements/tenant/features') return mockFeatureSet;
    if (path === '/product-entitlements/tenant/current') return { id: 'sub-1', status: 'ACTIVE' };
    if (path === '/commercial/trial/status') return { status: 'TRIALING', subscriptionId: 'sub-1' };
    if (path === '/commercial/onboarding') return { status: 'COMPLETED', completedSteps: ['FINISH'], nextStep: null };
    if (path === '/auth/step-up/status') return { active: false, expiresAt: null };
    if (path === '/auth/step-up' && options?.method === 'POST') return { active: true, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
    if (path === '/financial/accounts') return [];
    if (path === '/financial/charges') return [];
    if (path === '/students') return [{ id: 'student-1', name: 'Aluno 360', email: 'student360@example.com', phone: '11999990000', status: 'ACTIVE' }];
    if (path === '/students/student-1') return { id: 'student-1', name: 'Aluno 360', email: 'student360@example.com', status: 'ACTIVE', consentHealth: true, consentComm: false, consentBiometry: false };
    if (path === '/students/student-1/assessments') return [
      { id: 'assessment-2', weight: 78, height: 180, bmi: 24.1, bodyFatPercent: 18, measurements: { chest: 101, waist: 84, hip: 98 }, restrictions: { notes: 'Cuidado com joelho direito' }, notes: 'Evolução positiva', createdAt: '2026-09-30T10:00:00.000Z' },
      { id: 'assessment-1', weight: 80, height: 180, bmi: 24.7, bodyFatPercent: 20, measurements: { chest: 100, waist: 87, hip: 99 }, restrictions: { notes: 'Cuidado com joelho direito' }, notes: 'Baseline', createdAt: '2026-08-30T10:00:00.000Z' },
    ];
    if (path === '/students/student-1/schedules') return [{ id: 'schedule-1', status: 'SCHEDULED', date: '2026-09-30T00:00:00.000Z', slot: { weekday: 3, startTime: '18:00', endTime: '19:00' } }];
    if (path === '/students/student-1/workouts') return [{ id: 'student-workout-1', goal: 'Hipertrofia', status: 'ACTIVE' }];
    if (path === '/access/events?studentId=student-1') return [{ id: 'access-1', studentId: 'student-1', allowed: true, occurredAt: '2026-09-30T08:00:00.000Z' }];
    if (path === '/dashboard/summary') return { students: { total: 2, active: 2 }, workouts: { approved: 1 }, charges: { pending: 0, overdue: 0 }, revenue: { thisMonth: 10000 } };
    if (path.startsWith('/dashboard/revenue')) return [];
    if (path.startsWith('/dashboard/attendance')) return [];
    if (path === '/dashboard/overdue') return [];
    if (path.startsWith('/dashboard/birthdays')) return [];
    if (path === '/schedule-slots') return [{ id: 'slot-1', weekday: 1, startTime: '08:00', endTime: '09:00', capacity: 12, active: true }];
    if (path === '/workouts' && options?.method === 'POST') return { id: 'workout-manual-1', status: 'DRAFT' };
    if (path === '/workouts') return [
      { id: 'workout-ai-1', status: 'PENDING_REVIEW', createdByAI: true, goal: 'Hipertrofia', student: { user: { name: 'Aluno IA' } }, sessions: [] },
      { id: 'workout-approved-1', status: 'APPROVED', createdByAI: false, goal: 'Força', student: { user: { name: 'Aluno 360' } }, sessions: [{ id: 'session-1', name: 'Treino A', exercises: [{ id: 'we-1', sets: 3, reps: '10', exercise: { name: 'Agachamento' }, equipment: { name: 'Leg Press' } }] }] },
    ];
    if (path === '/workouts/workout-ai-1/status' && options?.method === 'PATCH') return { id: 'workout-ai-1', status: 'APPROVED' };
    if (path === '/workouts/workout-approved-1/status' && options?.method === 'PATCH') return { id: 'workout-approved-1', status: 'ACTIVE' };
    if (path === '/equipments') return [{ id: 'inv-1', name: 'Leg Press', catalogItemId: 'catalog-1', active: true, catalogItem: { id: 'catalog-1', name: 'Leg Press', category: 'PLATE_LOADED' } }];
    if (path.startsWith('/equipments/catalog?') || path === '/equipments/catalog') return [{ id: 'catalog-1', name: 'Leg Press', category: 'PLATE_LOADED', selected: true, inventoryId: 'inv-1' }, { id: 'catalog-2', name: 'Esteira', category: 'CARDIO', selected: false, inventoryId: null }];
    if (path === '/equipments/catalog/candidates' && !options?.method) return [{ id: 'candidate-1', proposedName: 'Máquina Especial', status: 'PENDING', proposedCategory: 'SPECIALIZED_STRENGTH' }];
    if (path === '/equipments/catalog/candidates' && options?.method === 'POST') return { id: 'candidate-new', proposedName: 'Equipamento Novo', status: 'PENDING' };
    if (path === '/exercises') return [
      { id: 'exercise-1', name: 'Agachamento', muscleGroup: 'Pernas', movement: 'Agachar', level: 'Intermediário', videoUrl: 'video-agachamento', contraindications: { notes: 'Avaliar joelho' } },
      { id: 'exercise-2', name: 'Supino reto', muscleGroup: 'Peito', movement: 'Empurrar', level: 'Iniciante', videoUrl: null, contraindications: null },
    ];
    if (path === '/equipments/exercises/exercise-1/compatible') return [{ id: 'inv-1', name: 'Leg Press', compatibility: 'SUPPORTED', mappingPriority: 1 }];
    if (path === '/gyms/gym-1') return { id: 'gym-1', name: 'Academia QA' };
    if (path === '/users' && options?.method === 'POST') return { id: 'member-1', name: 'Professor QA', email: 'professor@example.com' };
    if (path === '/users/invite' && options?.method === 'POST') return { id: 'member-invite-1', name: 'Recepção Convite', email: 'recepcao.convite@example.com', invitation: { accepted: true, delivery: 'PASSWORD_SETUP_EMAIL' } };
    if (path === '/users/member-2/membership/status' && options?.method === 'PATCH') return { userId: 'member-2', active: false, roleName: 'TRAINER' };
    if (path === '/users/member-2/membership/role' && options?.method === 'PATCH') return { userId: 'member-2', active: true, roleName: 'RECEPTION' };
    if (path === '/users') return [
      { id: 'owner-1', name: 'Proprietário QA', email: 'owner@example.com', roleName: 'OWNER', membershipActive: true, permissions: ['financial.read'], canManage: false },
      { id: 'member-2', name: 'Professor Dois', email: 'professor2@example.com', roleName: 'TRAINER', membershipActive: true, permissions: ['workouts.read', 'assessments.write'], canManage: true },
    ];
    if (path === '/creator-network/content/tenant/items') return [];
    if (path === '/creator-network/operations/tenant/overview') return { status: 'ACTIVE', total: 0 };
    if (path.startsWith('/creator-network/operations/tenant/analytics')) return { views: 0, total: 0 };
    throw new Error(`Rota não simulada: ${path}`);
  });
}

beforeEach(() => {
  mockProfile = {
    id: 'owner-1',
    name: 'Proprietário QA',
    email: 'owner@example.com',
    roles: ['OWNER'],
    permissions: [],
  };
  mockFeatureSet = [];
  mockApi.mockReset();
  mockLogout.mockClear();
  installApi();
});

test('Equipe exige identidade válida e envia convite seguro sem senha compartilhada', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByTestId('team-invite-submit')).toBeTruthy());

  fireEvent.press(view.getByTestId('team-invite-submit')); expect(mockApi.mock.calls.some(([path]) => path === '/users/invite')).toBe(false);
  fireEvent.changeText(view.getByTestId('team-invite-name'), 'Professor QA');
  fireEvent.changeText(view.getByTestId('team-invite-email'), 'professor@example.com');
  expect(view.getByTestId('team-invite-submit')).toBeTruthy();
  fireEvent.press(view.getByTestId('team-invite-submit'));

  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/users/invite' && options?.method === 'POST');
    expect(call).toBeTruthy();
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body).toEqual({ name: 'Professor QA', email: 'professor@example.com', roleName: 'TRAINER' });
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('gymId');
  });
  expect(mockApi.mock.calls.some(([path, _query, options]) => path === '/users' && options?.method === 'POST')).toBe(false);
});

test('Equipe apresenta permissões efetivas e permite somente convites governados por função', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByTestId('team-invite-submit')).toBeTruthy());

  expect(view.getByText('Professor Dois')).toBeTruthy();
  expect(view.getByText('workouts.read')).toBeTruthy();
  expect(view.getAllByText(/Vínculo: Ativo/).length).toBeGreaterThan(0);

  fireEvent.changeText(view.getByTestId('team-invite-name'), 'Recepção Convite');
  fireEvent.changeText(view.getByTestId('team-invite-email'), 'recepcao.convite@example.com');
  fireEvent.press(view.getByTestId('team-invite-role-RECEPTION'));
  fireEvent.press(view.getByTestId('team-invite-submit'));

  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/users/invite' && options?.method === 'POST');
    expect(call).toBeTruthy();
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toEqual({
      name: 'Recepção Convite', email: 'recepcao.convite@example.com', roleName: 'RECEPTION',
    });
  });
});

test('Equipe exige confirmação humana para suspender somente o vínculo do tenant', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByTestId('team-status-toggle-member-2')).toBeTruthy());

  fireEvent.press(view.getByTestId('team-status-toggle-member-2'));
  expect(mockApi.mock.calls.some(([path, _query, options]) => path === '/users/member-2/membership/status' && options?.method === 'PATCH')).toBe(false);
  fireEvent.press(view.getByTestId('team-status-confirm-member-2'));
  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/users/member-2/membership/status' && options?.method === 'PATCH');
    expect(call).toBeTruthy();
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toEqual({ active: false });
  });
  expect(mockApi.mock.calls.some(([path, _query, options]) => path === '/users/member-2' && options?.method === 'PATCH')).toBe(false);
});

test('Cockpit mostra agenda, alertas e candidatos da Intelligence com drill-down', async () => {
  const view = render(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('dashboard-overview')).toBeTruthy());
  expect(view.getAllByText('Agenda operacional').length).toBeGreaterThan(0);
  expect(view.getByText('Alertas operacionais')).toBeTruthy();
  expect(view.getByText('IRON Intelligence')).toBeTruthy();
  expect(view.getByText('Aluno IA')).toBeTruthy();
  expect(view.getByText(/Seg · 08:00–09:00/)).toBeTruthy();
});

test('Equipment Intelligence oferece catálogo, inventário e candidate intake sem cadastro manual paralelo', async () => {
  mockFeatureSet = [
    { featureKey: 'equipment.catalog', kind: 'FEATURE', value: true, source: 'PLAN' },
    { featureKey: 'equipment.inventory', kind: 'FEATURE', value: true, source: 'PLAN' },
  ];
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-equipment')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-equipment'));
  await waitFor(() => expect(view.getByText('Catálogo mestre de equipamentos')).toBeTruthy());
  expect(view.getByText('Inventário da academia')).toBeTruthy();
  expect(view.getByText('Sugerir equipamento ao catálogo')).toBeTruthy();
  expect(view.getByTestId('equipment-search')).toBeTruthy();
  expect(view.queryByText('Novo equipamento')).toBeNull();
  fireEvent.changeText(view.getByTestId('equipment-candidate-name'), 'Equipamento Novo');
  fireEvent.press(view.getByTestId('equipment-candidate-submit'));
  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/equipments/catalog/candidates' && options?.method === 'POST');
    expect(call).toBeTruthy();
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toMatchObject({ proposedName: 'Equipamento Novo' });
  });
});

test('Biblioteca de exercícios pesquisa, filtra e consulta compatibilidade canônica', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-exercises')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-exercises'));
  await waitFor(() => expect(view.getByText('Biblioteca de exercícios')).toBeTruthy());
  await waitFor(() => expect(view.getByText('Agachamento')).toBeTruthy());
  expect(view.getByText('Supino reto')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('exercise-search'), 'supino');
  expect(view.queryByText('Agachamento')).toBeNull();
  expect(view.getByText('Supino reto')).toBeTruthy();
  fireEvent.changeText(view.getByTestId('exercise-search'), '');
  expect(view.getByText('Contraindicações e cuidados')).toBeTruthy();
  fireEvent.press(view.getByTestId('exercise-compatibility-exercise-1'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/equipments/exercises/exercise-1/compatible')).toBe(true));
  expect(view.getByText('Compatibilidade com o inventário')).toBeTruthy();
});

test('Avaliações apresentam histórico real, evolução e restrições sem trocar de domínio', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-assessments')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-assessments'));
  await waitFor(() => expect(view.getByText('Histórico de evolução física')).toBeTruthy());
  fireEvent.press(view.getByTestId('assessment-select-student-1'));
  await waitFor(() => expect(view.getByTestId('assessment-weight-delta')).toBeTruthy());
  expect(view.getByText(/Variação de peso desde a avaliação anterior: -2.0 kg/)).toBeTruthy();
  expect(view.getAllByText(/Cintura: 84 cm/).length).toBeGreaterThan(0);
  expect(view.getAllByText(/Restrições: Cuidado com joelho direito/).length).toBeGreaterThan(0);
  expect(mockApi.mock.calls.some(([path]) => path === '/students/student-1/assessments')).toBe(true);
});

test('Workout Studio monta sessão completa e envia rascunho canônico', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-workouts')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-workouts'));

  await waitFor(() => expect(view.getByText('Workout Studio')).toBeTruthy());
  await waitFor(() => expect(view.getAllByText('Aluno 360').length).toBeGreaterThan(0));
  fireEvent.press(view.getAllByText('Aluno 360')[0]);

  await waitFor(() => expect(view.getByText('Agachamento')).toBeTruthy());
  fireEvent.press(view.getAllByText('Agachamento')[0]);
  fireEvent.press(view.getByText('Buscar equipamentos compatíveis'));
  await waitFor(
    () => expect(mockApi.mock.calls.some(([path]) => path === '/equipments/exercises/exercise-1/compatible')).toBe(true),
    { timeout: 12000 },
  );
  await waitFor(() => expect(view.getAllByText('Leg Press').length).toBeGreaterThan(0), { timeout: 12000 });
  fireEvent.press(view.getAllByText('Leg Press')[0]);
  fireEvent.press(view.getByTestId('workout-add-exercise'));
  await waitFor(() => expect(view.getByTestId('workout-add-session')).toBeTruthy());
  fireEvent.press(view.getByTestId('workout-add-session'));
  fireEvent.press(view.getByTestId('manual-workout-create'));

  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/workouts' && options?.method === 'POST');
    expect(call).toBeTruthy();
    const body = JSON.parse(String(call?.[2]?.body ?? '{}'));
    expect(body.studentId).toBe('student-1');
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].exercises[0]).toMatchObject({
      exerciseId: 'exercise-1',
      equipmentId: 'inv-1',
      sets: 3,
      reps: '10',
      restSeconds: 60,
    });
  });
}, 30000);

test('Workout Studio exige aprovação humana antes de oferecer ativação', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-workouts')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-workouts'));

  await waitFor(() => expect(view.getByTestId('workout-approve-workout-ai-1')).toBeTruthy());
  expect(view.queryByTestId('workout-activate-workout-ai-1')).toBeNull();
  expect(view.getByTestId('workout-activate-workout-approved-1')).toBeTruthy();
});

test('área administrativa exige reautenticação antes de carregar Financeiro', async () => {
  const view = render(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-financial'));

  await waitFor(() => expect(view.getByText('Acesso administrativo protegido')).toBeTruthy());
  expect(mockApi.mock.calls.some(([path]) => path === '/financial/accounts')).toBe(false);

  fireEvent.changeText(view.getByLabelText('Senha atual'), 'Senha-Forte-2026!');
  fireEvent.press(view.getByTestId('admin-step-up-submit'));

  await waitFor(() => {
    expect(mockApi.mock.calls.some(([path, _query, options]) => path === '/auth/step-up' && options?.method === 'POST')).toBe(true);
    expect(mockApi.mock.calls.some(([path]) => path === '/financial/accounts')).toBe(true);
  });
});

test('senha administrativa é compacta, oculta por padrão e pode ser exibida ou ocultada sem alterar autoridade', async () => {
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-financial'));
  await waitFor(() => expect(view.getByTestId('admin-password-input')).toBeTruthy());

  const passwordInput = view.getByTestId('admin-password-input');
  expect(passwordInput.props.secureTextEntry).toBe(true);
  expect(view.getByText(/Para criar ou alterar uma senha: Use 12–128 caracteres/)).toBeTruthy();
  expect(view.getByLabelText('Mostrar senha atual')).toBeTruthy();

  fireEvent.changeText(passwordInput, 'Senha-Forte-2026!');
  expect(mockApi.mock.calls.some(([path]) => path === '/auth/step-up')).toBe(false);
  fireEvent.press(view.getByTestId('admin-password-visibility-toggle'));
  expect(view.getByTestId('admin-password-input').props.secureTextEntry).toBe(false);
  expect(view.getByLabelText('Ocultar senha atual')).toBeTruthy();

  fireEvent.press(view.getByTestId('admin-password-visibility-toggle'));
  expect(view.getByTestId('admin-password-input').props.secureTextEntry).toBe(true);
  expect(mockApi.mock.calls.some(([path]) => path === '/financial/accounts')).toBe(false);

  fireEvent.press(view.getByTestId('admin-step-up-submit'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/financial/accounts')).toBe(true));
  const calls = mockApi.mock.calls.filter(([path, _query, options]) => path === '/auth/step-up' && options?.method === 'POST');
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0][2].body)).toEqual({ currentPassword: 'Senha-Forte-2026!' });
});

test('step-up administrativo exige MFA quando habilitado e protege todos os módulos restritos', async () => {
  mockProfile = {
    id: 'owner-mfa-1',
    name: 'Proprietário MFA',
    email: 'owner.mfa@example.com',
    roles: ['OWNER'],
    permissions: [],
    mfaEnabled: true,
  };

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-financial')).toBeTruthy());

  for (const testID of ['nav-financial', 'nav-saasBilling', 'nav-entitlements', 'nav-integrations']) {
    fireEvent.press(view.getByTestId(testID));
    await waitFor(() => expect(view.getByText('Acesso administrativo protegido')).toBeTruthy());
  }

  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/saas-billing/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => path === '/product-entitlements/tenant/configurations')).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/integrations/'))).toBe(false);

  fireEvent.press(view.getByTestId('nav-financial'));
  fireEvent.changeText(view.getByLabelText('Senha atual'), 'Senha-Forte-2026!');
  fireEvent.changeText(view.getByLabelText('Código MFA ou código de recuperação'), '123456');
  fireEvent.press(view.getByTestId('admin-step-up-submit'));

  await waitFor(() => {
    const call = mockApi.mock.calls.find(([path, _query, options]) => path === '/auth/step-up' && options?.method === 'POST');
    expect(call).toBeTruthy();
    expect(JSON.parse(String(call?.[2]?.body ?? '{}'))).toEqual({
      currentPassword: 'Senha-Forte-2026!',
      mfaCode: '123456',
    });
  });
});

test('gerente acessa equipe operacional sem poder criar outro gerente ou abrir administração restrita', async () => {
  mockProfile = {
    id: 'manager-1',
    name: 'Gerente QA',
    email: 'manager@example.com',
    roles: ['MANAGER'],
    permissions: [],
  };

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-team')).toBeTruthy());

  expect(view.queryByTestId('nav-financial')).toBeNull();
  expect(view.queryByTestId('nav-saasBilling')).toBeNull();
  expect(view.queryByTestId('nav-entitlements')).toBeNull();
  expect(view.queryByTestId('nav-integrations')).toBeNull();

  fireEvent.press(view.getByTestId('nav-team'));
  await waitFor(() => expect(view.getByTestId('team-invite-submit')).toBeTruthy());

  expect(view.getByTestId('team-invite-role-TRAINER')).toBeTruthy();
  expect(view.getByTestId('team-invite-role-RECEPTION')).toBeTruthy();
  expect(view.queryByTestId('team-invite-role-MANAGER')).toBeNull();
});

test('perfil de recepção não recebe superfícies administrativas sensíveis', async () => {
  mockProfile = {
    id: 'reception-1',
    name: 'Recepção QA',
    email: 'recepcao@example.com',
    roles: ['RECEPTION'],
    permissions: [],
  };

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-overview')).toBeTruthy());

  expect(view.queryByTestId('nav-team')).toBeNull();
  expect(view.queryByTestId('nav-financial')).toBeNull();
  expect(view.queryByTestId('nav-saasBilling')).toBeNull();
  expect(view.queryByTestId('nav-entitlements')).toBeNull();
  expect(view.queryByTestId('nav-integrations')).toBeNull();

  await waitFor(() => {
    expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/dashboard/revenue'))).toBe(false);
    expect(mockApi.mock.calls.some(([path]) => path === '/dashboard/overdue')).toBe(false);
  });
});

test('professor recebe somente superfícies operacionais compatíveis com o backend', async () => {
  mockProfile = {
    id: 'trainer-1',
    name: 'Professor QA',
    email: 'trainer@example.com',
    roles: ['TRAINER'],
    permissions: [],
  };
  mockFeatureSet = [
    { featureKey: 'equipment.catalog', kind: 'FEATURE', value: true, source: 'PLAN' },
    { featureKey: 'equipment.inventory', kind: 'FEATURE', value: true, source: 'PLAN' },
  ];

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-students')).toBeTruthy());

  for (const allowed of ['nav-students', 'nav-equipment', 'nav-exercises', 'nav-assessments', 'nav-workouts', 'nav-schedule', 'nav-security']) {
    expect(view.getByTestId(allowed)).toBeTruthy();
  }
  for (const denied of ['nav-overview', 'nav-team', 'nav-access', 'nav-financial', 'nav-saasBilling', 'nav-entitlements', 'nav-integrations']) {
    expect(view.queryByTestId(denied)).toBeNull();
  }
});

test('aluno não recebe módulos administrativos no shell comercial', async () => {
  mockProfile = {
    id: 'student-1',
    name: 'Aluno QA',
    email: 'student@example.com',
    roles: ['STUDENT'],
    permissions: [],
  };

  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-security')).toBeTruthy());

  for (const denied of ['nav-overview', 'nav-students', 'nav-team', 'nav-equipment', 'nav-exercises', 'nav-assessments', 'nav-workouts', 'nav-schedule', 'nav-access', 'nav-financial', 'nav-saasBilling', 'nav-entitlements', 'nav-integrations']) {
    expect(view.queryByTestId(denied)).toBeNull();
  }
});

test('Creator Network usa descrições em português e superfície compacta', async () => {
  mockFeatureSet = [
    { featureKey: 'content.tenant_private', kind: 'FEATURE', value: true, source: 'PLAN' },
  ];
  const view = render(<CommercialWebApp />);

  await waitFor(() => expect(view.getByTestId('nav-creator')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-creator'));

  await waitFor(() => expect(view.getByText('Indicadores')).toBeTruthy());
  expect(view.getAllByText('Visão geral').length).toBeGreaterThan(0);
  expect(view.getAllByText('Conteúdo').length).toBeGreaterThan(0);
  expect(view.queryByText('Analytics')).toBeNull();
  expect(view.getByText(/Conteúdo, utilização e desempenho/)).toBeTruthy();
});

test('RBAC: recepcao nao consulta financeiro do aluno mesmo ao abrir a ficha 360', async () => {
  mockProfile = { id: 'reception-audit', name: 'Recepcao Auditoria', email: 'reception@example.com', roles: ['RECEPTION'], permissions: [] };
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-students')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-students'));
  await waitFor(() => expect(view.getByText('Aluno 360')).toBeTruthy());
  fireEvent.press(view.getByText('Aluno 360'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/students/student-1')).toBe(true));
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/saas-billing/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => path === '/auth/step-up' )).toBe(false);
});

test.each(['MANAGER', 'TRAINER'])('RBAC: %s nao solicita financeiro pela ficha do aluno', async (roleName) => {
  mockProfile = { id: 'audit-role', name: 'Auditoria', email: 'audit@example.com', roles: [roleName], permissions: [] };
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-students')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-students'));
  await waitFor(() => expect(view.getByText('Aluno 360')).toBeTruthy());
  fireEvent.press(view.getByText('Aluno 360'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/students/student-1')).toBe(true));
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/saas-billing/'))).toBe(false);
  expect(view.queryByTestId('nav-financial')).toBeNull();
  expect(view.queryByTestId('nav-saasBilling')).toBeNull();
});


test('RBAC: recepcao nao consulta historico de transacoes financeiras no Aluno 360', async () => {
  mockProfile = { id: 'reception-transaction-audit', name: 'Recepcao', email: 'reception@example.com', roles: ['RECEPTION'], permissions: [] };
  const view = render(<CommercialWebApp />);
  await waitFor(() => expect(view.getByTestId('nav-students')).toBeTruthy());
  fireEvent.press(view.getByTestId('nav-students'));
  await waitFor(() => expect(view.getByText('Aluno 360')).toBeTruthy());
  fireEvent.press(view.getByText('Aluno 360'));
  await waitFor(() => expect(mockApi.mock.calls.some(([path]) => path === '/students/student-1')).toBe(true));
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/transactions'))).toBe(false);
});
