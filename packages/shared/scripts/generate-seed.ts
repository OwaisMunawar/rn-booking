import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderSeedCatalogSql, SEED_BEGIN, SEED_END } from '../src/seed-sql';

const seedPath = fileURLToPath(new URL('../../../supabase/seed.sql', import.meta.url));
const current = readFileSync(seedPath, 'utf8');
const start = current.indexOf(SEED_BEGIN);
const end = current.indexOf(SEED_END);

if (start === -1 || end === -1) {
  throw new Error(`Could not find the generated block markers in ${seedPath}`);
}

const next =
  current.slice(0, start) + renderSeedCatalogSql() + current.slice(end + SEED_END.length);
writeFileSync(seedPath, next);
console.log(next === current ? 'seed.sql already up to date' : 'seed.sql catalogue regenerated');
