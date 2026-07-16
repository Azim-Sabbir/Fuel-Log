# Fuel Log — Context Intake

> **Status:** 🟡 Gathering context. Do **not** implement code until the user
> explicitly says context-gathering is complete.
>
> This is a living, editable document. Each source of context the user provides
> gets logged below with its source and date. Open questions and assumptions are
> tracked separately so they stay visible.

_Last updated: 2026-07-16_

---

## What we know so far

### Product / purpose
- A **vehicle fuel + expense logger**. Core loop: log fill-ups → see fuel economy
  (MPG / L·100km / km·L), cost/unit, and spend over time. Adjacent: maintenance
  logs + reminders, trip tracking, reports.
- Inspiration app ("Fuel Log: Mileage Tracker" by Motosung) differentiates with a
  **map-first UI** (geotagged fill-ups on an interactive map) and a privacy-first,
  no-subscription stance. See `target-app-teardown.md`.

### Users & roles
- _Not yet defined by user._ Category splits into **casual owners** (simple log +
  MPG) vs **business/rideshare/fleet** (trips, income, tax, GPS, multi-vehicle).
  → Open question #2.

### Core features (candidate set, from research — not committed)
- Fuel fill-up logging → auto fuel-economy + cost calculations
- Multi-vehicle support with a vehicle switcher
- Maintenance/service logs + reminders (distance- and time-based)
- Trip tracking, categories (Business/Personal/Vacation), map view of stops
- Reports / charts with timeframe filters; monthly recaps
- CSV import/export; tax report
- (Native-app extras seen in target: iCloud sync, Siri, receipt OCR, App Lock)

### Data model (entities — inferred, see teardown)
- Vehicle · Fuel entry · Service entry · Trip · Reminder. Details in
  `target-app-teardown.md` → "Data model implied by the UI".

### Integrations / external services
- _TBD._ Target app uses Apple-native (iCloud, Apple Maps, Siri). Ours would need
  web equivalents. → Open question #1.

### Non-functional (auth, perf, offline, platform)
- Scaffold assumes Cloudflare Pages PWA (D1 + KV) per `office checkin manager`.
  Target app is native iOS — **platform decision not yet confirmed.** → Open question #1.

---

## Context log

| # | Date | Source | Summary |
|---|------|--------|---------|
| 1 | 2026-07-16 | App Store listing + 4 iPhone screenshots for "Fuel Log: Mileage Tracker" (id 6761144477) | Full teardown of the inspiration app: features, UX per screen, inferred data model. → `target-app-teardown.md` + `target-app-screenshots/` |
| 2 | 2026-07-16 | Web research on similar apps (Fuelio, Drivvo, Simply Auto, My Car, Hurdlr) | Category map + feature matrix + monetization patterns. → `competitor-landscape.md` |

---

## Open questions

_Numbered so we can refer to them. These need the user's input, ideally before planning._

1. **Platform & stack.** The inspiration app is native iOS (iCloud/Siri/Apple Maps).
   Our scaffold is a **Cloudflare Pages PWA**. Are we building a web PWA (reusing the
   `office checkin manager` stack), or targeting native iOS, or something else?
2. **Audience.** Casual car owner (simple, beautiful log) vs business/rideshare/fleet
   (trips, income, tax, GPS, multi-driver)? This reshapes the whole feature set.
3. **"Map-first" or not.** Is the geotagged-fill-ups-on-a-map the signature feature we
   want too, or is a clean list/stats app enough for v1?
4. **Scope of v1.** Which of {fuel logging, maintenance+reminders, trips, reports,
   import/export} are in the first release vs later?
5. **Monetization / distribution.** Free/no-subs like the target, or something else?
   (Affects whether we need accounts, payments, etc.)
6. **Units & locale.** MPG(US) vs MPG(UK) vs L/100km vs km/L; currency; multi-fuel
   (diesel/EV/LPG/CNG/bi-fuel two-tank)? How international is v1?

---

## Assumptions

_Working assumptions, flagged so they can be corrected. Nothing committed to code._

- Tech stack tentatively mirrors `office checkin manager` (Cloudflare Pages + Pages
  Functions, D1, KV, vanilla PWA, Vitest). **Unconfirmed for Fuel Log — see Q1.**
- "Fuel Log" the product is inspired by, but not a clone of, the Motosung app; we'll
  define our own scope from the context the user is still providing.
