# Fuel Log — Implementation Plan

## Context

**Fuel Log** is a new personal **web PWA** for casual car owners to log fuel fill-ups
and see fuel economy, costs, maintenance, and trips over time. It is inspired by the
native iOS app "Fuel Log: Mileage Tracker" (teardown + competitor research in
`docs/context/`), rebuilt on the **proven Cloudflare Pages stack** already used by the
`office checkin manager` project (which we explored and mirrored when scaffolding).

The scaffold already exists and is green (typecheck + unit + workers-pool smoke tests
pass, committed to `github.com/Azim-Sabbir/Fuel-Log` on `main`). This plan covers
building the actual product on top of it.

**Decisions (from the user):**
- Platform: **web PWA** (not native). Audience: **casual owner**.
- Scope: **every feature of the target app** in the initial release, adapted for web.
- **No geolocation** → location is a plain text string; **all map screens dropped**,
  replaced by list + summary-stats layouts.
- **Receipts:** attach a photo, **no OCR** → adds **Cloudflare R2** object storage.
- **Siri/Shortcuts + App Lock:** skipped (Google login already gates access).
- **Auth:** Google login now; email/password + reset/verify is a later step.
- **Units:** static — **km/L**, currency **BDT**, **single fuel type** (no multi-fuel/EV yet).
- **Build order:** testable core slice first, then layer the rest.

**Intended outcome:** a logged-in user can manage vehicles, log fuel + service,
track trips, view reports/recaps, attach receipt photos, and import/export CSV — all
in a fast, offline-capable, installable web app.

---

## Architecture & stack

Reuse the `office checkin manager` conventions verbatim (catalog with exact paths in
the exploration notes; key ones referenced inline below):

- **Cloudflare Pages** serves static `public/` + **Pages Functions** at `functions/api/*`.
- **D1** (SQLite) for all relational data; **KV** (`SETTINGS`) for light per-user prefs;
  **R2** (`RECEIPTS`, new) for receipt images.
- **Vanilla-JS PWA** front end: single `public/index.html` shell, `public/app.js`,
  Tailwind via CDN with an inline `tailwind.config` token map, a small `public/styles.css`
  for things utilities can't express, `public/sw.js` (network-first, `/api` bypassed),
  `public/manifest.json`, icons via `scripts/gen-icons.mjs` (`sharp`).
- **Dual pure-logic modules**: browser-importable + Vitest-testable ESM in `public/lib/*.js`
  (imported by absolute path in the browser, relative path in tests) — this is where the
  fuel-economy math, date ranges, and chart geometry live.
- **Vitest** two-config harness: unit (Node, `vitest.config.ts`) + integration
  (workers pool, `vitest.workers.config.ts`) using the `?raw` migration import + `resetDb()`
  helper pattern (`test/int/helpers.ts`).
- **Backend conventions**: thin `onRequestGet/Post/Put` handlers → `lib/` pure functions
  + `lib/db.ts` helpers; `lib/http.ts` `json()`; errors as `json({error:"code"}, status)`;
  all SQL centralized in `lib/db.ts`; numbered `migrations/NNNN_*.sql` doubling as the
  test schema.

**Naming note:** the reference app calls check-in rows "sessions". Here we use
**`auth_sessions`** for login sessions to avoid collision with fuel data.

---

## Auth design (Google OAuth → D1 sessions)

Replaces the reference app's `X-Access-Key` passcode entirely. **Authorization Code flow**:

- **Endpoints** (new `functions/api/auth/`):
  - `GET /api/auth/google/start` — generate random `state`, set short-lived httpOnly
    `oauth_state` cookie, 302 to `https://accounts.google.com/o/oauth2/v2/auth`
    (`client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `state`).
  - `GET /api/auth/google/callback` — verify `state` == cookie; exchange `code` at
    `https://oauth2.googleapis.com/token` (POST `code`, `client_id`, `client_secret`,
    `redirect_uri`, `grant_type=authorization_code`); decode the returned **`id_token`**
    (trusted — comes directly from Google over TLS; still validate `aud`==client id,
    `iss`, `exp`); upsert user by `google_sub`; create an `auth_sessions` row; set
    httpOnly/Secure/SameSite=Lax `session` cookie; 302 to `/`.
  - `POST /api/auth/logout` — delete session row, clear cookie.
  - `GET /api/me` — current user or 401.
- **Sessions**: opaque random token in the cookie; store only its **SHA-256 hash** in D1
  with `expires_at` (~30d). Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`)
  — no extra deps. Keep `timingSafeEqual` (`lib/auth.ts`) for hash compare.
- **Middleware** (`functions/api/_middleware.ts`, rewritten): allow `/api/auth/google/*`
  through; for all other `/api/*`, resolve the `session` cookie → `userId` into `ctx.data`,
  else `401`. **Every data query is scoped by `userId`; every mutation verifies ownership.**
- **Secrets** (in `.dev.vars` + `wrangler pages secret put`): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `APP_URL` (for building the redirect URI). Extend `lib/env.ts`.
- Schema is built to **accommodate email/password later** (`users.password_hash` nullable,
  `email_verified`), but that flow is out of scope for this plan.

---

## Data model (D1)

All timestamps ISO `TEXT`; dates `YYYY-MM-DD` `TEXT`; money `REAL` (BDT); distance `REAL` (km);
volume `REAL` (liters). Every user-owned table carries `user_id` and is indexed on it.

- **users** — `id`, `google_sub` UNIQUE, `email`, `name`, `picture`, `password_hash` (null),
  `email_verified`, `created_at`.
- **auth_sessions** — `id`, `user_id`, `token_hash` UNIQUE, `created_at`, `expires_at`.
- **vehicles** — `id`, `user_id`, `name`, `make`, `model`, `year`, `initial_odometer`,
  `created_at`, `archived_at` (null). Partial unique index for a per-user default vehicle if needed.
- **fuel_entries** — `id`, `user_id`, `vehicle_id`, `date`, `odometer`, `volume_liters`,
  `cost`, `location` (string), `is_partial` (0/1), `is_full_tank` (0/1), `trip_id` (null),
  `notes`, `receipt_key` (null, R2), `created_at`. **Derived at read time**: trip distance =
  odometer − previous odometer; km/L = distance ÷ liters (with partial-fill handling, below).
- **service_entries** — `id`, `user_id`, `vehicle_id`, `date`, `odometer`, `type`, `cost`,
  `location`, `notes`, `trip_id` (null), `receipt_key` (null), `created_at`.
- **reminders** — `id`, `user_id`, `vehicle_id`, `type`, `interval_km` (null),
  `interval_days` (null), `last_done_odometer` (null), `last_done_date` (null), `created_at`.
  Due state computed from current odometer/date vs interval.
- **trips** — `id`, `user_id`, `vehicle_id`, `name`, `category`
  (`business|personal|vacation`), `start_date`, `end_date`, `created_at`. Entries link via
  `fuel_entries.trip_id` / `service_entries.trip_id`; totals computed.
- Light per-user prefs (default vehicle, reminder "due-soon" threshold) in **KV** keyed
  `user:{id}:*`, using the GET-with-defaults + validated-PUT pattern from `settings.ts`.

**Fuel-economy math (pure, in `public/lib/economy.js`, unit-tested):** consecutive full-tank
fill-ups define a segment; km/L = segment distance ÷ sum of liters across the segment
(intervening **partial** fills accumulate volume rather than each computing economy — the
standard method so partials don't distort stats). Also cost/L, cost/km, totals, averages,
and the **trip-cost calculator** (distance ÷ avg km/L × price/L).

---

## Build phases (each phase: strict TDD, commit per task, keep suites green)

> Sequencing per user: **usable core slice first**, then layer. Every phase ends with
> `npm run typecheck` + `npm test` green and a runnable app.

### Phase 0 — Bindings & cloud setup (guided, user-run for cloud resources)
- Extend `wrangler.toml`: fill D1 `database_id`, KV `id`, add `[[r2_buckets]]` `RECEIPTS`.
  Extend `lib/env.ts` (`GOOGLE_CLIENT_ID/SECRET`, `APP_URL`, `RECEIPTS: R2Bucket`) and
  `vitest.workers.config.ts` bindings + `.dev.vars.example`.
- **Setup steps the user runs** (needs Cloudflare + Google auth — outward-facing):
  `wrangler d1 create fuel-log-db`, `wrangler kv namespace create SETTINGS`,
  `wrangler r2 bucket create fuel-log-receipts`; create a **Google OAuth 2.0 Web client**
  with redirect URIs `http://localhost:8788/api/auth/google/callback` (+ prod URL); put
  secrets in `.dev.vars`.

### Phase 1 — Auth + Vehicles + Fuel logging + basic stats  ← **TESTABLE CORE SLICE**
- Migration `0001_init.sql`: `users`, `auth_sessions`, `vehicles`, `fuel_entries`.
- Backend: OAuth flow + session middleware + `/api/me`; vehicles CRUD; fuel-entry CRUD;
  a `status/summary` endpoint (headline stats per vehicle). All in `lib/db.ts` + handlers.
- Pure logic: `public/lib/economy.js` (km/L, cost, partial-fill segments),
  `public/lib/ranges.js` (date ranges), formatting helpers.
- Front end: login screen (Google button, shown when `/api/me` → 401); home = vehicle
  switcher + headline stats (distance, km/L, total cost) + reverse-chron fuel timeline;
  add/edit fuel dialog; add/edit/switch vehicle. Reuse app-shell, `sw.js`, dialog patterns.
- **Milestone:** log in with Google → add a vehicle → log fill-ups → see km/L + spend.

### Phase 2 — Maintenance/service + reminders
- Migration `0002`: `service_entries`, `reminders`.
- Pure `public/lib/reminders.js` (due/overdue from interval_km + interval_days).
- Backend CRUD; front-end service list (wrench-marked timeline), service dialog,
  reminders UI with due-soon badges.

### Phase 3 — Trips + categories (list-based, no maps)
- Migration `0003`: `trips` + `trip_id` FKs on entries.
- Backend trips CRUD + computed totals (cost, distance); front-end trip list + detail
  (entries + totals, **no map**), assign/unassign entries to a trip.

### Phase 4 — Reports, charts, monthly recaps, trip-cost calculator
- Pure `public/lib/chart.js` (hand-rolled SVG geometry — dependency-free, like the
  reference's `weekBars`); charts screen with **timeframe filters (3m/6m/1y)** + stats
  summary card; monthly recap view; trip-cost calculator tool.

### Phase 5 — Receipt photos (R2), CSV import/export, expense/tax report
- R2 endpoints: authenticated upload (validate content-type + size) storing `receipt_key`;
  authenticated fetch that streams the object (bucket stays private). Attach/view photo on
  entries.
- CSV **export** (all entries, spreadsheet-friendly) and **import** (column-mapped, from
  Fuelio/Fuelly-style files); exportable **expense/tax summary** report.

### Phase 6 — PWA polish + design port
- `docs/design/` Stitch prompt doc (token table + per-screen prompts + component checklist,
  per the reference workflow) → port into inline `tailwind.config` + `styles.css`.
- `scripts/gen-icons.mjs` + manifest; settings screen (default vehicle, reminder threshold);
  about page; bump `sw.js` cache name; final full verification.

---

## Reuse map (don't rebuild these)

- **Handler/JSON/error pattern** → `functions/api/*.ts` + `lib/http.ts`.
- **Auth middleware skeleton** → `functions/api/_middleware.ts` (swap passcode → session).
- **KV settings GET-defaults + validated PUT** → `functions/api/settings.ts`.
- **Centralized SQL helpers + `RETURNING *` + `meta.changes`** → `lib/db.ts`.
- **Migration style** (numbered files, ISO text, status columns, partial unique indexes) →
  `migrations/*.sql`.
- **Test harness** (`?raw` import, `resetDb()`, workers-pool `env`/`fetchMock`, direct
  handler invocation with a hand-rolled `ctx`) → `test/int/helpers.ts` + existing tests.
- **Dual pure modules** (browser + Vitest) → `public/lib/*.js`.
- **PWA shell, Tailwind-CDN + inline tokens, `sw.js` network-first, dialogs, toast, FAB,
  event delegation** → `public/index.html`, `public/app.js`, `public/styles.css`, `public/sw.js`.
- **Stitch → Tailwind design workflow** → `docs/design/stitch-redesign-prompt.md` as template.

Follow the superpowers flow the reference used: **writing-plans → executing-plans with
strict TDD**, commit after each passing task, DRY/YAGNI, secrets never committed.

---

## Security notes

- Every D1 query scoped by `user_id`; every mutation verifies the row's owner == session user.
- Session cookie: httpOnly, Secure, SameSite=Lax, path=/; store only the token's SHA-256 hash.
- OAuth `state` CSRF cookie; validate `id_token` `aud`/`iss`/`exp`.
- R2 objects private; served only through the auth-checked fetch endpoint; validate upload
  size/type.

---

## Verification

- **Per phase:** `npm run typecheck` clean; `npm test` (unit + workers-pool int) green.
  New pure logic (economy, reminders, ranges, chart geometry) is unit-tested; handlers are
  integration-tested against D1/KV/R2 with `fetchMock` for the Google token exchange.
- **End-to-end (local):** `npm run dev` (`wrangler pages dev public`) with `.dev.vars`;
  register `http://localhost:8788/api/auth/google/callback` as an authorized redirect URI;
  drive the real flow — log in with Google, add a vehicle, log a fill-up, confirm km/L +
  BDT cost render, add a service + reminder, create a trip, view the charts/recap, attach a
  receipt photo, export then re-import CSV. Use the `/run` (and `/verify`) skill to launch
  and exercise the app.
- **Milestone gate:** end of Phase 1 must be a genuinely usable app (login → vehicle →
  fuel → stats) before layering Phases 2–6.

---

## Deferred (explicitly out of scope for this plan)

Email/password auth + reset/forget/verify; OCR on receipts; maps/geocoding; multi-fuel &
EV/diesel; configurable units/currency; Siri/Shortcuts; native app-lock. The schema leaves
room for the auth and units extensions without a rewrite.
