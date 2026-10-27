import fs from 'node:fs';

const screen = fs.readFileSync('src/screens/IntelligenceScreen.tsx', 'utf8');
const navigator = fs.readFileSync('src/navigation/RootNavigator.tsx', 'utf8');
const ai = fs.readFileSync('src/services/ai.ts', 'utf8');

test('D7 exposes a dedicated governed IRON Intelligence surface for students', () => {
  expect(navigator).toContain("type Tab = 'treino' | 'intelligence'");
  expect(navigator).toContain('<IntelligenceScreen />');
  expect(navigator).toContain('label="Intelligence"');
  expect(screen).toContain('testID="iron-intelligence-screen"');
  expect(screen).toContain('Seu copiloto de treino');
  expect(screen).toContain('A IRON Intelligence é consultiva');
});

test('D7 reuses canonical advisory endpoints and never introduces provider credentials', () => {
  expect(ai).toContain("'/me/ai/workout-insights'");
  expect(ai).toContain("'/me/ai/chat'");
  expect(ai).toContain("'/me/ai/content-recommendations'");
  expect(screen).toContain('getWorkoutInsights()');
  expect(screen).toContain('getEvolutionProjection()');
  expect(screen).toContain('chatWithWorkoutAssistant(message)');
  expect(screen).not.toMatch(/api.?key|gemini|openai|anthropic|secret/i);
});

test('D7 keeps student canonical data available while AI fails open safely', () => {
  expect(screen).toContain("api('/me/workouts')");
  expect(screen).toContain("api('/me/assessments')");
  expect(ai).toContain("source: 'fallback'");
  expect(ai).toContain('assistente está temporariamente indisponível');
});
