import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderSeedCatalogSql } from './seed-sql';

describe('supabase/seed.sql', () => {
  it('matches the demo catalogue used by the in-memory repository', () => {
    const seed = readFileSync(
      fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url)),
      'utf8',
    );
    // If this fails run: npm run seed:generate -w @rn-booking/shared
    expect(seed).toContain(renderSeedCatalogSql());
  });
});
