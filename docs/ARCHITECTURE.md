# Architecture

This document records the decisions that shape the codebase, in a short ADR style: context, decision, consequences, and the alternatives that were considered and rejected.

## Overview

```
packages/shared   pure domain: schemas, slot engine, repository port + adapters, concierge tools
apps/mobile       Expo app (customers) + one API route for the concierge
apps/admin        Next.js admin (staff) with server-only data access
supabase          schema, RLS, triggers, RPCs, seed
```

Data always flows through the `BookingRepository` port in `packages/shared/src/repository.ts`. It has two adapters:

- `MemoryBookingRepository`, seeded from `demo-data.ts`, used in demo mode and tests
- `SupabaseBookingRepository`, which talks to PostgREST with the signed-in user's JWT

Each app picks the adapter from environment variables at startup, so there is no demo branch anywhere in the UI code.

---

## ADR 1: npm workspaces, no Turborepo or pnpm

**Context.** Three packages, two apps with very different toolchains (Metro and Next), one shared TypeScript package.

**Decision.** Plain npm workspaces. `packages/shared` ships TypeScript source (`"main": "./src/index.ts"`); Metro transpiles it natively and Next does so through `transpilePackages`. Root scripts fan out with `npm run <script> --workspaces --if-present`.

**Consequences.** One lockfile, no build step for the shared package, and a type change in `shared` is picked up by both apps immediately. Expo's monorepo support needs no Metro config since SDK 52. React is pinned to the exact version React Native 0.86 expects in both apps so npm hoists a single copy.

**Rejected.**

- _pnpm_: its symlinked layout still needs extra care with Metro, and it is not installed by default on CI runners or contributors' machines.
- _Turborepo / Nx_: task caching pays off with many packages or slow builds. Here the full pipeline runs in a few minutes; the extra config is not worth it yet.
- _Building `shared` to `dist`_: adds a watch process and stale-build bugs for no runtime benefit.

## ADR 2: One slot engine, pure and timezone-explicit

**Context.** The app, the admin, the concierge and the database all need to agree on what is bookable. Timezones and DST are where booking systems usually break.

**Decision.** `availability.ts` is a pure function from (date, IANA zone, weekly rules, breaks, busy intervals, duration, buffer, grid step, now) to slots. It converts wall-clock rules to absolute instants with `Intl.DateTimeFormat` only (`time.ts`), never `Date#getHours` or the process timezone, and steps through the day in real elapsed minutes.

- Non-existent wall times (spring forward) resolve forward, repeated ones (fall back) to the earlier instant, the same as Temporal's `compatible` mode. On a fall-back day the repeated hour yields two distinct slots, each labelled with its UTC offset.
- Intervals are half-open, so back-to-back bookings never collide.
- A service must fit inside working hours and outside breaks; its clean-up buffer may run past closing or into a break, but never into another booking.

**Consequences.** The engine is trivial to test (40+ cases, run with `TZ=Pacific/Honolulu` to prove independence from the host). Mobile computes slots on-device, which keeps the date picker instant.

**Rejected.**

- _Computing slots in SQL_: possible with `generate_series`, but harder to test and it would still need re-implementing for demo mode.
- _date-fns-tz / Luxon_: fine libraries, but the engine needs three conversions, and `Intl` is available in Hermes, browsers and Node without adding bundle weight.
- _Temporal_: not yet available in Hermes.

## ADR 3: The database is the final word on double-booking

**Context.** Checking availability and then inserting is a race: two customers can both see 14:30 as free.

**Decision.** `bookings` has an exclusion constraint:

```sql
constraint bookings_no_overlap exclude using gist (
  provider_id with =,
  tstzrange(start_at, buffer_end_at, '[)') with &&
) where (status in ('pending', 'confirmed'))
```

A `BEFORE INSERT/UPDATE` trigger derives `provider_id`, `end_at`, `buffer_end_at` and `price_cents` from the service (clients cannot submit their own) and rejects times outside the provider's working hours or inside a break. The app still validates with the engine first (`bookSlot`) for a friendly error, and maps Postgres `23P01` to a `slot_unavailable` domain error. The in-memory adapter enforces the same rule so demo mode behaves identically.

**Consequences.** Correct under concurrency, verified by an integration test that fires two inserts for the same slot and expects exactly one to win. Cancelling a booking frees the slot automatically because the constraint is partial.

**Rejected.**

- _`SELECT ... FOR UPDATE` then insert_: needs a lock row per provider and is easy to get wrong in every code path that writes bookings.
- _Unique index on `(provider_id, start_at)`_: catches identical starts only, not overlaps or buffers.
- _Application-level check only_: loses the race.

## ADR 4: Authorisation lives in Postgres, with server-side checks on top

**Context.** Three roles. Customers must never see each other's bookings; providers only manage their own listing.

**Decision.** Row level security on every table, with two `SECURITY DEFINER` helpers (`is_admin()`, `owns_provider(id)`) so policies can look across tables without recursion.

| Table               | anon        | customer              | provider                       | admin |
| ------------------- | ----------- | --------------------- | ------------------------------ | ----- |
| providers, services | active rows | active rows           | + own (incl. hidden), edit own | all   |
| availability_rules  | read        | read                  | edit own                       | all   |
| bookings            | none        | own; cancel only      | own provider's; change status  | all   |
| profiles            | none        | own; `full_name` only | + customers who booked them    | all   |

Column privileges stop anyone changing their own `role`; triggers stop providers reassigning their listing or rating, and stop customers doing anything to a booking except cancelling it. Customers learn when a provider is busy through `get_busy_intervals()`, which returns bare time ranges and nothing about who booked them.

The admin runs every query as the signed-in user via `@supabase/ssr`, so RLS applies there too. On top of that, each page and server action calls `requireSession()` and the pure rules in `apps/admin/src/server/authz.ts` (unit tested). That second layer is what protects demo mode, where there is no database.

**Consequences.** A bug in the admin cannot leak data across providers in Supabase mode. The integration suite signs in as each role and asserts on what comes back, including a role-escalation attempt.

**Rejected.**

- _Service-role key in the admin with checks in code_: one missed check exposes everything, and the key becomes a high-value secret.
- _Separate API server_: more to deploy and keep in sync, for rules Postgres can express directly.

## ADR 5: The concierge runs server-side and returns data, not prose

**Context.** "Haircut near me Saturday afternoon under $40" should end in bookable slots, not a paragraph the UI has to parse.

**Decision.** An Expo Router API route (`src/app/api/concierge+api.ts`) calls AI SDK `generateText` with two tools, `searchServices` and `getAvailability`, whose zod schemas and implementations live in `packages/shared/src/concierge.ts`. The route collects the tool results from the steps and returns `{ reply, results, interpretation, mode }`. The UI renders `results` as tappable slots; the model's text is only a caption. The model is told the current date in the marketplace timezone and never invents slots, because slots only come from tool output.

Demo mode, when `AI_GATEWAY_API_KEY` is unset, swaps in a `MockLanguageModelV4` that reads the conversation, calls the same tools in the same order and writes a reply from their results. The real tool loop runs either way. If the route is unreachable, the app falls back to the rule-based parser on-device.

Server-only modules live in `apps/mobile/src/server`. An ESLint `no-restricted-imports` rule stops UI code importing them or the `ai` package; the client bundle of the web export contains none of it.

**Consequences.** No API key in the app bundle. The feature works with zero setup and degrades rather than fails. A scripted mock model in the tests verifies that results are collected from whatever tools a real model chooses to call.

**Rejected.**

- _Calling the model from the app_: leaks the key and cannot be rate-limited.
- _Structured output (`generateObject`) instead of tools_: the model would have to guess availability rather than look it up.
- _Streaming_: nice for long answers; here the answer is a short caption plus data, so a single response is simpler. It is on the roadmap for multi-turn follow-ups.

## ADR 6: Demo data is one source of truth

**Context.** Reviewers should see the same providers whether they run demo mode or a seeded database.

**Decision.** Providers, services, rules and users are defined once in `demo-data.ts`. The catalogue section of `supabase/seed.sql` is generated from it (`npm run seed:generate -w @rn-booking/shared`), and a unit test fails if the SQL is stale. Bookings are generated relative to today in both places, through the engine in TypeScript and through the real trigger and constraint in SQL, so the dashboard always has a "today".

**Rejected.** _Hand-maintained duplicate fixtures_: they drift.

## Errors

Repositories translate driver errors into a single `DomainError` with a `code` (`not_found`, `slot_unavailable`, `conflict`, `forbidden`, `validation`, `unauthenticated`, `backend`). The UI switches on the code, for example to tell a customer that someone just took their slot. Admin server actions return a typed `ActionResult` instead of throwing, while `unstable_rethrow` lets redirects and `notFound()` pass through.
