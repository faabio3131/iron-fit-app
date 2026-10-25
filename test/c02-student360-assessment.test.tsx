import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Student360Panel } from '../src/components/Student360Panel';
import { AssessmentEvolutionPanel } from '../src/components/AssessmentEvolutionPanel';

const mockApi = jest.fn();
jest.mock('../src/services/api', () => ({ api: (...args: unknown[]) => mockApi(...args) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.setTimeout(20000);

const students = [{ id: 'student-a', name: 'Ana Silva', email: 'ana@example.test' }];
function route(path: string, _token?: string, options?: { method?: string; body?: string }) {
  if (options?.method === 'PATCH') return Promise.resolve({ consentHealth: true });
  if (options?.method === 'POST') return Promise.resolve({ id: 'assess-new' });
  if (path === '/students/student-a') return Promise.resolve({
    id: 'student-a', name: 'Ana Silva', email: 'ana@example.test', status: 'ACTIVE',
    consentHealth: false, consentComm: true, consentBiometry: false,
  });
  if (path === '/students/student-a/assessments') return Promise.resolve([
    { id: 'assess-2', createdAt: '2026-10-20T12:00:00Z', weight: 71, bmi: 24, bodyFatPercent: 20, workoutCount: 2, measurements: { waist: 80 }, notes: 'Melhora de força' },
    { id: 'assess-1', createdAt: '2026-09-20T12:00:00Z', weight: 72, bmi: 24.3, bodyFatPercent: 21, workoutCount: 1 },
  ]);
  if (path === '/students/student-a/schedules') return Promise.resolve([
    { id: 'booking-a', date: '2026-10-21T12:00:00Z', status: 'CHECKED_IN', slot: { name: 'Treino funcional' } },
  ]);
  if (path === '/students/student-a/workouts') return Promise.resolve([{ id: 'workout-a', goal: 'Força', status: 'APPROVED', sessions: [] }]);
  if (path.startsWith('/access/credentials?studentId=')) return Promise.resolve([{ id: 'credential-a', type: 'QR_CODE', active: true }]);
  if (path.startsWith('/financial/charges?studentId=')) return Promise.resolve([{ id: 'charge-a', amount: 25000, dueDate: '2026-11-10', status: 'PENDING' }]);
  if (path.startsWith('/financial/subscriptions?studentId=')) return Promise.resolve([{ id: 'plan-a', planName: 'Premium', status: 'ACTIVE' }]);
  throw new Error('Rota inesperada: ' + path);
}
beforeEach(() => { mockApi.mockReset(); mockApi.mockImplementation(route); });

test('C02 Alunos 360 shows canonical profile, assessments, bookings and permitted workouts without requesting protected financial data', async () => {
  const view = render(<Student360Panel students={students}
    canReadWorkouts canReadAccess={false} canReadFinance={false} canEditConsents={false} />);
  fireEvent.press(view.getByTestId('student360-select-student-a'));
  await waitFor(() => expect(view.getByText(/Treino funcional/)).toBeTruthy());
  expect(view.getAllByText('Ana Silva').length).toBeGreaterThan(0);
  expect(view.getByText(/Força · Aprovado/)).toBeTruthy();
  expect(view.getByText(/Presença confirmada/)).toBeTruthy();
  expect(view.queryByText('Plano e financeiro da academia')).toBeNull();
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/financial/'))).toBe(false);
  expect(mockApi.mock.calls.some(([path]) => String(path).startsWith('/access/'))).toBe(false);
});

test('C02 owner finance is requested only with verified step-up flag; reception gets no workouts or financial queries', async () => {
  const view = render(<Student360Panel students={students}
    canReadWorkouts={false} canReadAccess canReadFinance canEditConsents />);
  fireEvent.press(view.getByTestId('student360-select-student-a'));
  await waitFor(() => expect(view.getByText('Plano e financeiro da academia')).toBeTruthy());
  expect(view.getByText(/Premium · Ativo/)).toBeTruthy();
  expect(view.getByText(/R\$ 250,00/)).toBeTruthy();
  expect(mockApi).toHaveBeenCalledWith('/financial/charges?studentId=student-a');
  expect(mockApi).toHaveBeenCalledWith('/financial/subscriptions?studentId=student-a');
  expect(mockApi).not.toHaveBeenCalledWith('/students/student-a/workouts');
  view.unmount();
  mockApi.mockClear();
  const reception = render(<Student360Panel students={students}
    canReadWorkouts={false} canReadAccess canReadFinance={false} canEditConsents />);
  fireEvent.press(reception.getByTestId('student360-select-student-a'));
  await waitFor(() => expect(reception.getByText('Credenciais de acesso')).toBeTruthy());
  expect(mockApi.mock.calls.some(([p]) => String(p).startsWith('/financial/'))).toBe(false);
  expect(mockApi).not.toHaveBeenCalledWith('/students/student-a/workouts');
});

test('C02 consent changes require human confirmation and only transmit the explicit field', async () => {
  const view = render(<Student360Panel students={students}
    canReadWorkouts={false} canReadAccess={false} canReadFinance={false} canEditConsents />);
  fireEvent.press(view.getByTestId('student360-select-student-a'));
  await waitFor(() => expect(view.getByTestId('student360-consent-consentHealth')).toBeTruthy());
  fireEvent.press(view.getByTestId('student360-consent-consentHealth'));
  expect(mockApi.mock.calls.filter(([, , opts]) => opts?.method === 'PATCH')).toHaveLength(0);
  fireEvent.press(view.getByTestId('student360-consent-confirm-consentHealth'));
  await waitFor(() => expect(mockApi.mock.calls.some(([, , opts]) => opts?.method === 'PATCH')).toBe(true));
  const write = mockApi.mock.calls.find(([, , opts]) => opts?.method === 'PATCH');
  expect(write[0]).toBe('/students/student-a/consents');
  expect(JSON.parse(write[2].body)).toEqual({ consentHealth: true });
});

test('C02 Evolução compares two real measurements and stops invalid percentages and negative weights', async () => {
  const view = render(<AssessmentEvolutionPanel students={students} canCreate />);
  fireEvent.press(view.getByTestId('assessment-select-student-a'));
  await waitFor(() => expect(view.getByTestId('assessment-weight-delta')).toBeTruthy());
  expect(view.getByText(/-1.0 kg/)).toBeTruthy();
  expect(view.getByText(/Cintura: 80 cm/)).toBeTruthy();
  fireEvent.changeText(view.getByTestId('assessment-weight'), '-10');
  expect(view.getByTestId('assessment-validation')).toBeTruthy();
  fireEvent.press(view.getByTestId('assessment-create'));
  expect(mockApi.mock.calls.filter(([, , opts]) => opts?.method === 'POST')).toHaveLength(0);
  fireEvent.changeText(view.getByTestId('assessment-weight'), '70,5');
  fireEvent.press(view.getByTestId('assessment-create'));
  await waitFor(() => expect(mockApi.mock.calls.some(([, , opts]) => opts?.method === 'POST')).toBe(true));
  const write = mockApi.mock.calls.find(([, , opts]) => opts?.method === 'POST');
  expect(write[0]).toBe('/students/student-a/assessments');
  expect(JSON.parse(write[2].body)).toEqual({ weight: 70.5 });
});

test('C02 assessments restricted to read-only for reception', async () => {
  const view = render(<AssessmentEvolutionPanel students={students} canCreate={false} />);
  fireEvent.press(view.getByTestId('assessment-select-student-a'));
  await waitFor(() => expect(view.getByText(/Melhora de força/)).toBeTruthy());
  expect(view.queryByTestId('assessment-create')).toBeNull();
  expect(mockApi.mock.calls.filter(([, , opts]) => opts?.method === 'POST')).toHaveLength(0);
});
