import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    // Pin the process timezone so tests prove the engine never relies on it.
    env: { TZ: 'Pacific/Honolulu' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/database.types.ts',
        // Exercised against a real Postgres by the integration suite instead.
        'src/supabase-repository.ts',
      ],
      reporter: ['text-summary', 'text', 'lcov'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
