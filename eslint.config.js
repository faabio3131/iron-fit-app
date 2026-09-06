const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/**', 'coverage/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
