# Competitor Landscape — Fuel / Mileage / Refuel Log Apps

> Survey of similar apps (keywords: fuel log, mileage tracker, refuel log, gas log,
> car maintenance). For product context only — no decisions here.
> _Captured: 2026-07-16. Sources at bottom._

## The category in one line

Two poles: **simple gas-log trackers** (log fill-ups → see MPG & cost) vs. **full
vehicle/fleet managers** (fuel + expenses + service + reminders + income + tax +
reports). Most monetize via a one-time unlock or freemium/subscription. The target
"Fuel Log" app stakes out a third position: **premium-native, map-first, free, no-subscription**.

## Feature matrix

| App | Core focus | Fuel types | Multi-vehicle | Maintenance/reminders | Trips/GPS | Reports/export | Money model | Notable |
|-----|-----------|-----------|--------------|----------------------|-----------|----------------|-------------|---------|
| **Fuel Log (target)** | Fuel + service + trips, map-first | Gas, diesel, EV | ✅ | ✅ reminders | ✅ trips + interactive map | CSV in/out, tax report | **Free, no subs** | Native iOS/Mac/vision, iCloud, Siri, OCR, App Lock |
| **Fuelio** | Simple gas log & costs | Gas, diesel, EV, LPG, CNG, ethanol, **bi-fuel/2 tanks** | ✅ | Premium (maintenance/insurance/reminders) | Gas-station locator w/ crowd prices | Dropbox/Google Drive backup, CSV | Freemium (premium since 2023) | CarPlay, widgets, 5M+ installs; partial fill-ups |
| **Drivvo** | Full vehicle finances / fleet | Gas, ethanol, CNG… | ✅ up to 100 (business) | ✅ customizable reminders | Routes; **income logging** (Uber/taxi) | Reports; imports from Fuelio/Fuel Log/aCar | Freemium/subscription | 60+ languages, 2M+ downloads, checklists |
| **Simply Auto** | Mileage + maintenance + expense, tax-oriented | Gas, diesel, EV | ✅ 4 free / unlimited paid | ✅ | **Auto GPS + Bluetooth trip tracking** (pro), business/personal split | Scheduled reports, web dashboard, CSV | Free / Gold $9.99 once / Platinum $9.99·yr | Best for tax/reimbursement; multi-driver sync |
| **My Car** | Simple expense/fuel tracker | Gas + **bi-fuel** | ✅ 3 free / up to 6 | Basic | Timeline view | Cloud (premium) | Free + monthly/yearly + business | "Clean, modest" UI |
| **Hurdlr** | **Tax mileage / self-employed** | n/a (mileage $) | — | — | **Auto mileage detection**, IRS-compliant deductions | Real-time tax estimates, bank auto-import (9,500+) | Free / $9.99·mo or $99.99·yr | For freelancers/rideshare; overkill for casual |

## Patterns worth noting

- **Fuel-economy math is the table-stakes engine:** odometer delta between consecutive
  fill-ups ÷ volume → MPG / L·100km / km·L; cost/distance and cost/unit trends. Partial
  fill-ups must be handled or they distort stats (Fuelio explicitly markets this).
- **Fuel-type breadth matters internationally:** gas/diesel/EV plus LPG/CNG/ethanol and
  **bi-fuel (two tanks)** show up repeatedly.
- **Reminders** are almost always distance- *and* time-based (e.g. every 5,000 mi or 6 mo).
- **Import/export (CSV)** is a standard switching-cost lever; apps import each other's formats.
- **Two audiences pull the feature set apart:** casual owners (simple log + MPG) vs.
  business/rideshare (trips, income, tax, GPS, multi-vehicle/fleet). Deciding which we
  serve shapes everything. → open question in `intake.md`.
- **Monetization spread:** one-time unlock (Simply Auto Gold), freemium+subscription
  (Fuelio, Drivvo, My Car), pure-free/no-subs (target Fuel Log). Ours: TBD.

## Sources

- [Fuelio — official site](https://www.fuel.io/) · [App Store](https://apps.apple.com/us/app/fuelio-gas-log-mileage/id1487753318) · [Google Play](https://play.google.com/store/apps/details?id=com.kajda.fuelio)
- [Simply Auto — official site](https://www.simplyauto.app/)
- [SlashGear — 5 best apps for tracking fuel economy & car expenses](https://www.slashgear.com/1925961/best-apps-tracking-fuel-economy-car-expenses/)
- [Best Car Maintenance Tracking Apps 2026 (carmaintenance.app)](https://carmaintenance.app/best-car-maintenance-tracking-apps/)
- [FuelLog alternatives — AlternativeTo](https://alternativeto.net/software/fuellog/)
- [Drivvo alternatives — SaaSHub](https://www.saashub.com/drivvo-alternatives)
