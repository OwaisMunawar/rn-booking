// @ts-check
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.expo/**', 'expo-env.d.ts'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    // Server code (API routes, model calls, secrets) must never reach the app bundle.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/**', 'src/app/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server', '@/server/*', '../server/*'],
              message: 'Server-only module. Import it from src/app/api/** only.',
            },
            {
              group: ['ai', 'ai/*'],
              message: 'Model calls belong in src/server, behind an API route.',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
