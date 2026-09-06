import fs from 'node:fs';

const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const app = fs.readFileSync('App.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');

test('Iron Fit is the canonical mobile brand and application identity', () => {
  expect(appConfig.expo.name).toBe('Iron Fit');
  expect(appConfig.expo.displayName).toBe('Iron Fit');
  expect(appConfig.expo.slug).toBe('iron-fit-app');
  expect(appConfig.expo.android.package).toBe('com.ironfit.app');
  expect(appConfig.expo.ios.bundleIdentifier).toBe('com.ironfit.app');
  expect(pkg.name).toBe('iron-fit-mobile');
  expect(app).toContain('Iron Fit');
  expect(app).not.toContain('IronCloud');
});

test('mobile quality scripts are canonical', () => {
  expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
  expect(pkg.scripts.lint).toBe('eslint . --ext .js,.jsx,.ts,.tsx');
  expect(pkg.scripts.test).toBe('jest');
});

test('mobile CI runs install, typecheck, lint and tests on Node 20', () => {
  expect(workflow).toMatch(/node-version:\s*20/);
  expect(workflow).toContain('npm ci');
  expect(workflow).toContain('npm run typecheck');
  expect(workflow).toContain('npm run lint');
  expect(workflow).toContain('npm test');
});
