import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

const webShell = read('src/web/CommercialWebApp.tsx');
const schedule = read('src/web/ScheduleWorkspace.tsx');
const creator = read('src/web/CreatorNetworkWorkspace.tsx');
const entitlements = read('src/web/EntitlementsWorkspace.tsx');
const communication = read('src/web/CommunicationCenter.tsx');
const integration = read('src/components/IntegrationCredentialsPanel.tsx');
const security = read('src/components/AccountSecurityPanel.tsx');
const billing = read('src/components/SaasBillingPanel.tsx');
const privacy = read('src/web/PrivacyCenter.tsx');
const fiscal = read('src/web/FiscalCenter.tsx');

const mobileInteractive = [
  read('src/screens/WorkoutsScreen.tsx'),
  read('src/screens/ProfileScreen.tsx'),
  read('src/screens/CheckInScreen.tsx'),
  read('src/screens/FinancialScreen.tsx'),
  read('src/components/AIInsightCard.tsx'),
  read('src/components/AIWorkoutAssistant.tsx'),
  read('src/components/TabItem.tsx'),
];

function touchableOpenings(source: string) {
  return [...source.matchAll(/<TouchableOpacity[\s\S]{0,500}?>/g)].map((match) => match[0]);
}

test('O20 Web has a compact breakpoint and no rigid 300+px minimum on flexible workspaces', () => {
  expect(webShell).toContain('useWindowDimensions().width < 980');
  expect(webShell).toContain("navCompact: { width: '100%', maxWidth: '100%', minWidth: 0");
  expect(webShell).toContain('compactPane: { flexGrow: 1, flexBasis: 330, minWidth: 0');
  expect(webShell).toContain('compactPaneWide: { flexGrow: 1, flexBasis: 480, minWidth: 0');
  expect(schedule).toContain("dayColumnSingle: { flex: 1, width: '100%', minWidth: 0");
  expect(schedule).toContain('operationCard: { flexGrow: 1, flexBasis: 380, minWidth: 0');
  expect(creator).toContain('column: { flexGrow: 1, flexBasis: 380, minWidth: 0');
  expect(entitlements).toContain('featureCard: { flexGrow: 1, flexBasis: 390, minWidth: 0');
  expect(communication).toContain('column: { flexGrow: 1, flexBasis: 430, minWidth: 0');
});

test('O20 common Web actions and compact selectors have explicit target sizes', () => {
  expect(webShell).toContain('button: { minHeight: 44');
  expect(webShell).toContain('navItem: { minHeight: 44');
  expect(webShell).toContain('chip: { minHeight: 36');
  expect(webShell).toContain('input: { minHeight: 44');
  expect(integration).toContain('button: { minHeight: 44');
  expect(security).toContain('button: { minHeight: 44');
  expect(privacy).toContain('button: { minHeight: 44');
  expect(communication).toContain('button: { minHeight: 44');
  expect(fiscal).toContain('button: { minHeight: 44');
  expect(entitlements).toContain('button: { minHeight: 44');
  expect(schedule).toContain('primaryButton: { minHeight: 44');
});

test('O20 Billing and mobile critical touchables expose button semantics', () => {
  for (const opening of touchableOpenings(billing)) {
    expect(opening).toContain('accessibilityRole="button"');
  }
  for (const source of mobileInteractive) {
    for (const opening of touchableOpenings(source)) {
      expect(opening).toContain('accessibilityRole="button"');
    }
  }
});

test('O20 critical forms expose accessible labels and selected/disabled states', () => {
  expect(webShell).toContain('TextInput accessibilityLabel={label}');
  expect(webShell).toContain('accessibilityState={{ selected: selected === row.id }}');
  expect(integration).toContain('accessibilityState={{ disabled: !!disabled }}');
  expect(privacy).toContain('accessibilityState={{ disabled: !!disabled }}');
  expect(communication).toContain('accessibilityState={{ disabled: !!disabled }}');
  expect(fiscal).toContain('accessibilityState={{ disabled: !!disabled }}');
  expect(schedule).toContain('accessibilityState={{ selected: mode ===');
  expect(schedule).toContain('accessibilityState={{ disabled:');
});
