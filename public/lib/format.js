// Display formatters. Pure ES module (browser + Vitest). Units are fixed:
// distance km, volume litres, currency BDT (৳).

function group(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Bangladeshi taka, no decimals: 3000 → "৳3,000". */
export function fmtBDT(amount) {
  return "৳" + group(amount);
}

/** Distance in km: 56248 → "56,248 km". */
export function fmtKm(km) {
  return group(km) + " km";
}

/** Fuel economy: 6.666 → "6.7 km/L"; null → "—". */
export function fmtKmPerL(kmPerL) {
  if (kmPerL == null) return "—";
  return kmPerL.toFixed(1) + " km/L";
}

/** Volume in litres: 29.5 → "29.5 L" (trailing zeros trimmed). */
export function fmtLiters(liters) {
  return parseFloat(liters.toFixed(2)) + " L";
}
