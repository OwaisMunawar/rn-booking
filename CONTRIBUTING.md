# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Setup

```bash
npm ci
npm run dev:admin    # or: npm run dev:mobile
```

Everything runs in demo mode without environment variables. For the Supabase-backed flow, see "Supabase setup" in the README.

## Before you open a pull request

```bash
npm run check              # format, lint, typecheck, unit tests, admin build
npm run test:integration   # needs `npm run db:start`
npm run test:e2e           # Playwright; set PW_CHANNEL=chrome to reuse a local Chrome
```

CI runs the same commands on every pull request.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org): `feat(mobile): ...`, `fix(shared): ...`, `test(supabase): ...`.
- **Where code goes.** Business rules belong in `packages/shared` with tests. Route files in `apps/mobile/src/app` and `apps/admin/src/app` stay thin and delegate to `src/features/*`.
- **Server-only code.** Mobile: `apps/mobile/src/server`, importable only from `src/app/api/**` (enforced by ESLint). Admin: `apps/admin/src/server`, guarded by `server-only` and ESLint.
- **Types.** Strict TypeScript, no `any`. Validate anything that crosses a boundary (forms, API bodies, URL params) with zod.
- **Database changes.** Add a new file under `supabase/migrations` (never edit an applied one), run `npm run db:reset` and `npm run db:types`, and extend the integration tests for any policy change.
- **Demo data.** Edit `packages/shared/src/demo-data.ts`, then run `npm run seed:generate -w @rn-booking/shared`.
- **Expo dependencies.** Add them with `npx expo install <package>` from `apps/mobile` so versions match the SDK.

## Reporting security issues

Please do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting on this repository instead.
