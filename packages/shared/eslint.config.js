import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['coverage/**', 'src/database.types.ts'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Repository adapters implement an async port; some are synchronous inside.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      // Tests index fixtures they just created; a failed lookup fails the test anyway.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
