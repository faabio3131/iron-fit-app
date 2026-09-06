import fs from 'node:fs';

const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const app = fs.readFileSync('App.tsx', 'utf8');
const login = fs.readFileSync('src/screens/LoginScreen.tsx', 'utf8');
const profile = fs.readFileSync('src/screens/ProfileScreen.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');

test('Iron Fit is the canonical mobile brand and application identity', () => {
  expect(appConfig.expo.name).toBe('Iron Fit');
  expect(appConfig.expo.displayName).toBe('Iron Fit');
  expect(appConfig.expo.slug).toBe('iron-fit-app');
  expect(appConfig.expo.android.package).toBe('com.faabio3131.ironfit');
  expect(appConfig.expo.ios.bundleIdentifier).toBe('com.ironfit.app');
  expect(pkg.name).toBe('iron-fit-mobile');
  expect(`${login}\n${profile}`).toContain('Iron Fit');
  expect(`${app}\n${login}\n${profile}`).not.toContain('IronCloud');
});

test('App.tsx is a strict provider and navigator bootstrap', () => {
  expect(app).toContain('SafeAreaProvider');
  expect(app).toContain('AuthProvider');
  expect(app).toContain('RootNavigator');
  expect(app).not.toMatch(/fetch\(|api\(|useState|useEffect|TextInput|ScrollView/);
});

test('mobile quality scripts are canonical', () => {
  expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
  expect(pkg.scripts.lint).toBe('eslint . --ext .js,.jsx,.ts,.tsx');
  expect(pkg.scripts.test).toBe('jest');
});

test('mobile CI runs install, typecheck, lint and tests on the Expo 57 Node baseline', () => {
  expect(workflow).toMatch(/node-version:\s*22/);
  expect(workflow).toContain("'feat/**'");
  expect(workflow).toContain('npm ci');
  expect(workflow).toContain('npm run typecheck');
  expect(workflow).toContain('npm run lint');
  expect(workflow).toContain('npm test');
});
