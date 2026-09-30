# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

## [0.1.0] - 2026-09-30

First release.

### Added

- Shared slot availability engine with working hours, breaks, date overrides, buffers, minimum notice and DST-safe timezone handling
- `BookingRepository` port with in-memory (demo) and Supabase adapters
- Supabase schema with row level security, an exclusion constraint against double-booking, a working-hours trigger, booking RPCs and a generated seed
- Expo app: browse and search providers, provider detail, date and slot picker, booking, my bookings with cancellation, email sign-in
- AI booking concierge: Expo Router API route using AI SDK tool calling, a deterministic demo model when no API key is set, and an on-device fallback
- Next.js admin: KPIs, revenue chart, bookings table with filters and status changes, provider and service management, weekly hours editor, admin and provider roles
- Tests: engine and repository unit tests with coverage thresholds, Supabase RLS integration tests, admin Playwright smoke tests, Maestro flows for the app
- GitHub Actions CI and Dependabot

[0.1.0]: https://github.com/OwaisMunawar/rn-booking/releases/tag/v0.1.0
