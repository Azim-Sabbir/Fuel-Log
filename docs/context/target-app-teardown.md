# Target App Teardown — "Fuel Log: Mileage Tracker" (Motosung)

> Reference app the user pointed at. This is a **competitor/inspiration teardown**,
> not a spec for our build. Captured from the App Store listing + the 4 iPhone
> screenshots (saved in `./target-app-screenshots/`).
>
> Source: https://apps.apple.com/us/app/fuel-log-mileage-tracker/id6761144477
> _Captured: 2026-07-16_

## Listing facts

| Field | Value |
|-------|-------|
| Name | Fuel Log: Mileage Tracker |
| Subtitle | "Track fuel efficiency, log maintenance, and map your road trips in one beautiful, native app." |
| Developer | DENIS YEREMUK (© Motosung) |
| Price | **Free — no ads, no subscriptions, no IAP** |
| Category | Utilities (primary), Travel (secondary) |
| Platform | **Native Apple only** — iOS 18+, macOS 15+ (M1+), visionOS 2+ |
| Data | "Developer does not collect any data." On-device + iCloud sync only |
| Size | ~2.4 MB |
| First release | Apr 9, 2026 · Current v1.5 Jun 7, 2026 |
| Ratings | 5.0 (only 1 rating — brand new app) |
| Flavor | Solo indie dev. Icon = synthwave gas-pump/sunset. About page quotes "Jeremiah 29:11", "Made in California, by a Ukrainian", "No Subscription, Ever." |

## Feature set (from description)

- **Fuel & efficiency tracking** — log fill-ups in seconds; auto-calc MPG / L·100km / km·L and cost per unit over time
- **Maintenance logs & reminders** — oil changes, tire rotations, brake jobs, repairs; alerts when the next interval approaches
- **Trip tracking + interactive maps** — log road trips, categorize (Business / Personal / Vacation), render the journey on a map with fuel/service stops
- **Monthly recaps** — summaries of driving habits, distances, expenses, "fun driving facts"
- **Trip cost calculator** — estimate fuel cost from avg efficiency × route distance × gas price
- **iCloud sync** — automatic, background, across Apple devices
- **CSV import/export** — import from Fuelly, Road Trip, MileIQ, Fuelio; export to spreadsheet ("data never locked in")
- **EV & diesel support**
- **Receipt scanning (OCR)**
- **Siri + Apple Shortcuts**
- **App Lock** — Face ID / Touch ID / Optic ID
- **Tax report generation**
- Release notes mention a **charts screen** with timeframe filters (3m/6m/1y) and a stats summary card; a "Passport" feature was temporarily removed in v1.5

## What the screenshots actually show (UX)

**01 — Home (`01-home-map-fuel-service.png`)**
- Full-bleed Apple Map is the hero; fill-up locations shown as clustered **blue gas-pump pins** strung along the driven route (Vancouver → Costco Torrance → Chevron Carbon Hill, AL).
- Bottom sheet: **vehicle selector** ("Prius Prime 2.0 ⌄") + `＋` (add), map, and ⚙ buttons.
- Three headline stats: **56,248 miles · 54.6 MPG (US) · $4,238.40 total fuel cost**.
- Two primary CTAs: blue **Fuel** (pump icon) and orange **Service** (wrench icon).

**02 — Logs list (`02-logs-list-reminders.png`)**
- Reverse-chron **vertical timeline** of entries; each fill-up is a card:
  - Station + location ("ARCO (80 - Madison)", "Sinclair (Madison & Manzanita)", "Sam's Club (Santa Clarita)")
  - Date · odometer ("56,798 miles")
  - Right column: **cost** (bold, "$50.01") · **MPG** ("47.2 MPG") · **trip distance** ("429 mile trip")
  - Blue pump icon per row on the timeline rail (service entries would use the wrench glyph).

**03 — Trip detail (`03-trip-detail-cross-country.png`)**
- A named trip ("Cross Country") with back + **Edit**.
- Embedded map card of that trip's stops (expandable to fullscreen).
- Trip totals: **$433.33 total USD cost · 6,027 miles**.
- "TRIP LOGS" = the fill-ups belonging to this trip, same card format as the main list.

**04 — About (`04-about-private.png`)**
- Simple about page: app icon, scripture line, "No Subscription, Ever.", and action rows — **Email Developer · Rate and Review · Telegram Updates · Support Developer**.

## Data model implied by the UI

- **Vehicle**: name/nickname, fuel type (gas/diesel/EV), efficiency unit, multi-vehicle (selector + add).
- **Fuel entry**: date, odometer, station name, location (lat/lng for the map pin), cost, volume, → derived MPG and trip distance (delta odometer). Partial-fill flag likely.
- **Service entry**: date, odometer, type (oil/tires/brakes/…), cost, notes; drives reminders (interval by distance and/or time).
- **Trip**: name, category (Business/Personal/Vacation), a set of fuel/service stops, totals (cost, miles).
- **Reminder**: linked to a service type + interval.

## Takeaways for our product thinking (not decisions)

- The **map-first hero** with geotagged fill-ups is the signature differentiator vs. the spreadsheet-y competitors.
- **Odometer-delta fuel economy** is the core computed value (needs consecutive fill-ups; partial fills complicate it).
- Positioning: privacy-first, one-time-free, "beautiful native" — the opposite of freemium fleet tools.
- ⚠️ **Platform gap for us:** this is native SwiftUI leaning hard on iCloud sync, Apple Maps, Siri, Face ID, receipt OCR. Our scaffolded stack is a **Cloudflare Pages PWA** (like `office checkin manager`). Most *data* features port cleanly; the *platform* features (iCloud, native Maps SDK, Siri) would map to web equivalents (own auth + D1, web map tiles, Web Share/Shortcuts). **Open question logged in `intake.md`.**
