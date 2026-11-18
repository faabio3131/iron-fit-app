// This does not waive or filter any tests: only scheduling is bounded on CI.
const jestConfig = require('../jest.config.js') as {
  maxWorkers?: number;
  testMatch: string[];
  clearMocks: boolean;
  testPathIgnorePatterns: string[];
};

test('the complete Expo/Web Jest inventory runs with a bounded worker budget in CI', () => {
  if (process.env.CI === 'true') {
    expect(jestConfig.maxWorkers).toBe(1);
  } else {
    expect(jestConfig.maxWorkers).toBeUndefined();
  }
  expect(jestConfig.clearMocks).toBe(true);
  expect(jestConfig.testMatch).toEqual(expect.arrayContaining([
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
  ]));
  // Live-backend contract requires its own PostgreSQL/HTTP fixture; this fix
  // must never expand or alter the established explicit live certification gate.
  if (process.env.IRON_LIVE_E2E === 'true') {
    expect(jestConfig.testPathIgnorePatterns).toEqual([]);
  } else {
    expect(jestConfig.testPathIgnorePatterns).toEqual([
      '<rootDir>/test/live-system-contract.test.ts',
    ]);
  }
});
