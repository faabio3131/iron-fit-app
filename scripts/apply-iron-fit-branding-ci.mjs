import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeJson = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const appJson = readJson('app.json');
appJson.expo.name = 'Iron Fit';
appJson.expo.displayName = 'Iron Fit';
appJson.expo.slug = 'iron-fit-app';
appJson.expo.android = appJson.expo.android ?? {};
appJson.expo.android.package = 'com.ironfit.app';
appJson.expo.ios = appJson.expo.ios ?? {};
appJson.expo.ios.bundleIdentifier = 'com.ironfit.app';
writeJson('app.json', appJson);

const pkg = readJson('package.json');
pkg.name = 'iron-fit-mobile';
pkg.scripts = {
  ...(pkg.scripts ?? {}),
  typecheck: 'tsc --noEmit',
  lint: 'eslint . --ext .js,.jsx,.ts,.tsx',
  test: 'jest',
};
writeJson('package.json', pkg);

const trackedWithLegacyBrand = execFileSync('git', ['grep', '-Il', 'IronCloud'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => path !== 'scripts/apply-iron-fit-branding-ci.mjs');

for (const path of trackedWithLegacyBrand) {
  const original = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, original.replaceAll('IronCloud', 'Iron Fit'));
}

if (fs.existsSync('test/auth-session-hardening.test.mjs')) {
  fs.unlinkSync('test/auth-session-hardening.test.mjs');
}

fs.mkdirSync('test', { recursive: true });
fs.writeFileSync('test/auth-session-hardening.test.ts', `import fs from 'node:fs';\n\nconst app = fs.readFileSync('App.tsx', 'utf8');\nconst api = fs.readFileSync('src/api.ts', 'utf8');\nconst session = fs.readFileSync('src/auth-session.ts', 'utf8');\nconst config = fs.readFileSync('src/config.ts', 'utf8');\n\ntest('login starts without demo credentials', () => {\n  expect(app).toMatch(/useState\\(''\\)/);\n  expect(app).not.toMatch(/joao\\.silva@email\\.com|aluno123/);\n});\n\ntest('multi-tenant login selects tenant and resubmits gymId', () => {\n  expect(app).toMatch(/requires_tenant_selection/);\n  expect(app).toMatch(/data\\.tenants/);\n  expect(app).toMatch(/selectedGymId/);\n  expect(app).toMatch(/gymId: selectedGymId/);\n});\n\ntest('mobile session persists both access and refresh tokens in SecureStore', () => {\n  expect(session).toMatch(/expo-secure-store/);\n  expect(session).toMatch(/accessToken/);\n  expect(session).toMatch(/refreshToken/);\n  expect(session).toMatch(/SecureStore\\.setItemAsync/);\n});\n\ntest('401 path rotates refresh token once and retries original request', () => {\n  expect(api).toMatch(/refreshInFlight/);\n  expect(api).toMatch(/\\/auth\\/refresh/);\n  expect(api).toMatch(/response\\.status === 401/);\n  expect(api).toMatch(/retryOnUnauthorized: false/);\n});\n\ntest('logout revokes backend refresh session before local cleanup', () => {\n  expect(api).toMatch(/\\/auth\\/logout/);\n  expect(api).toMatch(/refreshToken: current\\.refreshToken/);\n  expect(api).toMatch(/finally[\\s\\S]*invalidateSession/);\n});\n\ntest('backend URL is centralized in EXPO_PUBLIC_API_URL', () => {\n  expect(config).toMatch(/EXPO_PUBLIC_API_URL/);\n  expect(app).not.toMatch(/gym-saas-backend-t9ej\\.onrender\\.com/);\n});\n`);

fs.writeFileSync('test/branding-and-ci.test.ts', `import fs from 'node:fs';\n\nconst appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nconst app = fs.readFileSync('App.tsx', 'utf8');\nconst workflow = fs.readFileSync('.github/workflows/mobile-ci.yml', 'utf8');\n\ntest('Iron Fit is the canonical mobile brand and application identity', () => {\n  expect(appConfig.expo.name).toBe('Iron Fit');\n  expect(appConfig.expo.displayName).toBe('Iron Fit');\n  expect(appConfig.expo.slug).toBe('iron-fit-app');\n  expect(appConfig.expo.android.package).toBe('com.ironfit.app');\n  expect(appConfig.expo.ios.bundleIdentifier).toBe('com.ironfit.app');\n  expect(pkg.name).toBe('iron-fit-mobile');\n  expect(app).toContain('Iron Fit');\n  expect(app).not.toContain('IronCloud');\n});\n\ntest('mobile quality scripts are canonical', () => {\n  expect(pkg.scripts.typecheck).toBe('tsc --noEmit');\n  expect(pkg.scripts.lint).toBe('eslint . --ext .js,.jsx,.ts,.tsx');\n  expect(pkg.scripts.test).toBe('jest');\n});\n\ntest('mobile CI runs install, typecheck, lint and tests on Node 20', () => {\n  expect(workflow).toMatch(/node-version:\\s*20/);\n  expect(workflow).toContain('npm ci');\n  expect(workflow).toContain('npm run typecheck');\n  expect(workflow).toContain('npm run lint');\n  expect(workflow).toContain('npm test');\n});\n`);

fs.writeFileSync('test/app-branding.test.tsx', `import React from 'react';\nimport { render, waitFor } from '@testing-library/react-native';\n\njest.mock('expo-secure-store', () => ({\n  getItemAsync: jest.fn(async () => null),\n  setItemAsync: jest.fn(async () => undefined),\n  deleteItemAsync: jest.fn(async () => undefined),\n}));\n\nimport App from '../App';\n\ntest('login renders the canonical Iron Fit brand', async () => {\n  const view = render(<App />);\n  await waitFor(() => {\n    expect(view.getAllByText('Iron Fit').length).toBeGreaterThan(0);\n  });\n});\n`);

fs.writeFileSync('jest.config.js', `process.env.EXPO_PUBLIC_API_URL ||= 'https://example.invalid/api/v1';\n\nmodule.exports = {\n  preset: 'jest-expo',\n  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.tsx'],\n  clearMocks: true,\n};\n`);

fs.writeFileSync('eslint.config.js', `const expoConfig = require('eslint-config-expo/flat');\n\nmodule.exports = [\n  ...expoConfig,\n  {\n    ignores: ['dist/**', 'coverage/**'],\n    rules: {\n      '@typescript-eslint/no-explicit-any': 'off',\n    },\n  },\n];\n`);

fs.mkdirSync('.github/workflows', { recursive: true });
fs.writeFileSync('.github/workflows/mobile-ci.yml', `name: Mobile CI\n\non:\n  push:\n    branches:\n      - main\n      - 'refactor/**'\n  pull_request:\n    branches:\n      - main\n\njobs:\n  quality:\n    runs-on: ubuntu-latest\n    env:\n      EXPO_PUBLIC_API_URL: https://example.invalid/api/v1\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node.js 20\n        uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n\n      - name: Install dependencies\n        run: npm ci\n\n      - name: Typecheck\n        run: npm run typecheck\n\n      - name: Lint\n        run: npm run lint\n\n      - name: Test\n        run: npm test\n`);

console.log('Iron Fit branding, Jest/ESLint configuration and Mobile CI sources applied.');
