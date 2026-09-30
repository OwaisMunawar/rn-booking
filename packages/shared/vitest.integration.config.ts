import { defineConfig } from 'vitest/config';

// Runs against a local Supabase stack: `supabase start && supabase db reset`.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
