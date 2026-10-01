import fs from 'node:fs';

const screens = [
  'src/screens/WorkoutsScreen.tsx',
  'src/screens/SchedulesScreen.tsx',
  'src/screens/EvolutionScreen.tsx',
  'src/screens/FinancialScreen.tsx',
].map((path) => fs.readFileSync(path, 'utf8'));
const requestError = fs.readFileSync('src/components/RequestErrorState.tsx', 'utf8');

test('O19B differentiates network/service failures from genuine empty states', () => {
  for (const source of screens) {
    expect(source).toContain('RequestErrorState');
    expect(source).toContain('Sem conexão ou serviço indisponível');
    expect(source).not.toMatch(/\.catch\(\(\) => \{[^}]*set(?:Workouts|Schedules|Assessments|Charges)\(\[\]\)/s);
  }
  expect(requestError).toContain('Tentar novamente');
  expect(requestError).toContain('cloud-offline-outline');
});

test('O19B preserves explicit empty states after successful requests', () => {
  expect(screens[0]).toContain('Nenhum treino ainda');
  expect(screens[1]).toContain('Nenhum horário reservado');
  expect(screens[2]).toContain('Nenhuma avaliação');
  expect(screens[3]).toContain('Nenhuma cobrança');
});
