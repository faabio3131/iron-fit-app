process.env.EXPO_PUBLIC_API_URL ||= 'https://example.invalid/api/v1';

module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx',
  ],
  // The mutating live-backend contract has a separate explicit certification gate.
  // Ordinary CI cannot provision a disposable tenant/backend and must never count it as skipped.
  testPathIgnorePatterns: process.env.IRON_LIVE_E2E === 'true' ? [] : ['<rootDir>/test/live-system-contract.test.ts'],
  // GitHub hosted runners can oversubscribe Expo/Jest setup across 97 suites:
  // serial CI execution keeps the full test inventory while preventing
  // nondeterministic 5-second test timeouts from worker contention.
  // Local development retains Jest's normal parallel worker policy.
  ...(process.env.CI === 'true' ? { maxWorkers: 1 } : {}),
  clearMocks: true,
};
