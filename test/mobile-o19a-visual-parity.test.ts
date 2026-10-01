import fs from 'node:fs';

const workout = fs.readFileSync('src/screens/WorkoutsScreen.tsx', 'utf8');
const schedule = fs.readFileSync('src/screens/SchedulesScreen.tsx', 'utf8');
const evolution = fs.readFileSync('src/screens/EvolutionScreen.tsx', 'utf8');
const plan = fs.readFileSync('src/screens/FinancialScreen.tsx', 'utf8');
const profile = fs.readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
const security = fs.readFileSync('src/components/AccountSecurityPanel.tsx', 'utf8');
const insight = fs.readFileSync('src/components/AIInsightCard.tsx', 'utf8');
const assistant = fs.readFileSync('src/components/AIWorkoutAssistant.tsx', 'utf8');
const projection = fs.readFileSync('src/components/AIProjectionCard.tsx', 'utf8');
const checkin = fs.readFileSync('src/screens/CheckInScreen.tsx', 'utf8');

test('O19A removes legacy purple and obsolete exposed mobile version', () => {
  for (const source of [workout, schedule, evolution, plan, profile, security, insight, assistant, projection, checkin]) {
    expect(source.toLowerCase()).not.toContain('#312e81');
    expect(source.toLowerCase()).not.toContain('#7c3aed');
    expect(source.toLowerCase()).not.toContain('#8b5cf6');
    expect(source.toLowerCase()).not.toContain('#a855f7');
  }
  expect(profile).not.toContain('Iron Fit v0.2.0');
});

test('O19A aligns primary mobile accents with the official IRON blue system', () => {
  expect(workout).toContain('color="#67d6ff"');
  expect(schedule).toContain('color="#2f91ff"');
  expect(evolution).toContain('color="#2f91ff"');
  expect(profile).toContain("backgroundColor: '#176bc1'");
  expect(plan).toContain('color="#2f91ff"');
  expect(insight).toContain("backgroundColor: '#071528'");
  expect(assistant).toContain("backgroundColor: '#176bc1'");
  expect(projection).toContain("borderColor: '#203b55'");
  expect(checkin).toContain("okText: { color: '#67d6ff'");
});

test('O19B plan surface removes fake payment promise and uses real HTTPS paymentLink only', () => {
  expect(plan).not.toContain('chegando em breve');
  expect(plan).not.toContain('Pagamento via PIX chegando');
  expect(plan).toContain('safePaymentUrl');
  expect(plan).toContain("charge.paymentLink");
  expect(plan).toContain('Linking.openURL(checkoutUrl)');
  expect(plan).toContain('/ 100');
});
