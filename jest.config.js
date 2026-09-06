process.env.EXPO_PUBLIC_API_URL ||= 'https://example.invalid/api/v1';

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.tsx'],
  clearMocks: true,
};
