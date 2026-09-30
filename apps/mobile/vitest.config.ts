import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript modules (server routes, data helpers).
// Screens are covered by the Maestro flows in .maestro/.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
