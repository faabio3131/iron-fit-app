process.env.EXPO_PUBLIC_API_URL ||= 'https://example.invalid/api/v1';

module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx',
  ],
  clearMocks: true,
};
