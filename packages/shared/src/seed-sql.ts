import { demoProfiles, demoProviders, demoRules, demoServices } from './demo-data';

/**
 * Renders the demo users and catalogue as SQL for supabase/seed.sql, so the
 * in-memory demo and a seeded database can never drift apart. Regenerate with
 * `npm run seed:generate -w @rn-booking/shared`; a test fails if it is stale.
 */

export const SEED_BEGIN =
  '-- BEGIN GENERATED CATALOG (npm run seed:generate -w @rn-booking/shared)';
export const SEED_END = '-- END GENERATED CATALOG';

/** Local-only password shared by every seeded account. */
export const DEMO_PASSWORD = 'demo-password';

const q = (value: string | null) => (value === null ? 'null' : `'${value.replaceAll("'", "''")}'`);

export function renderSeedCatalogSql(): string {
  const users = demoProfiles.map(
    (p) => `  (${q(p.id)}, ${q(p.email)}, ${q(p.fullName)}, '${p.role}')`,
  );

  const providers = demoProviders.map(
    (p) =>
      `  (${q(p.id)}, ${q(p.userId)}, ${q(p.name)}, '${p.category}', ${q(p.bio)}, ${q(p.neighborhood)}, ${q(p.address)}, ${p.lat}, ${p.lng}, ${p.rating}, ${p.reviewCount}, ${q(p.timeZone)})`,
  );

  const services = demoServices.map(
    (s) =>
      `  (${q(s.id)}, ${q(s.providerId)}, ${q(s.name)}, ${q(s.description)}, '${s.category}', ${s.durationMinutes}, ${s.bufferMinutes}, ${s.priceCents})`,
  );

  const rules = demoRules.map(
    (r) =>
      `  (${q(r.id)}, ${q(r.providerId)}, '${r.kind}', ${r.weekday}, '${r.startTime}', '${r.endTime}')`,
  );

  return [
    SEED_BEGIN,
    '',
    'with demo_users (id, email, full_name, role) as (values',
    users.join(',\n'),
    '), inserted as (',
    '  insert into auth.users (',
    '    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,',
    '    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,',
    '    confirmation_token, email_change, email_change_token_new, recovery_token',
    '  )',
    "  select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,",
    `    extensions.crypt('${DEMO_PASSWORD}', extensions.gen_salt('bf')), now(),`,
    `    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name),`,
    "    now(), now(), '', '', '', ''",
    '  from demo_users',
    '  returning id, email',
    ')',
    'insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)',
    "select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()",
    'from inserted;',
    '',
    '-- handle_new_user() created the profiles; now assign roles.',
    'update public.profiles p set role = u.role::public.user_role',
    'from (values',
    demoProfiles.map((p) => `  (${q(p.id)}, '${p.role}')`).join(',\n'),
    ') as u (id, role)',
    'where p.id = u.id::uuid;',
    '',
    'insert into public.providers (id, user_id, name, category, bio, neighborhood, address, lat, lng, rating, review_count, time_zone) values',
    `${providers.join(',\n')};`,
    '',
    'insert into public.services (id, provider_id, name, description, category, duration_minutes, buffer_minutes, price_cents) values',
    `${services.join(',\n')};`,
    '',
    'insert into public.availability_rules (id, provider_id, kind, weekday, start_time, end_time) values',
    `${rules.join(',\n')};`,
    '',
    SEED_END,
  ].join('\n');
}
