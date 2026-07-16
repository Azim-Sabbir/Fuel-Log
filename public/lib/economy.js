// Fuel-economy math for Fuel Log. Pure ES module: imported by the browser via an
// absolute path (`/lib/economy.js`) and unit-tested by Vitest via a relative path.
//
// Units are fixed for now: distance in km, volume in litres, cost in BDT.
//
// Economy uses the standard "full-to-full" method: economy is measured only
// between two full-tank fills. The distance is the odometer delta between the two
// full tanks; the fuel is every litre added *after* the first full tank up to and
// including the second (so intervening partial fills are accumulated, not each
// treated as its own — which would distort the numbers).

// Accepts both the camelCase `isFull` boolean and the DB `is_full` (0/1) shape.
// An entry with neither flag defaults to a full tank.
function isFullTank(e) {
  if (typeof e.isFull === "boolean") return e.isFull;
  if (e.is_full != null) return e.is_full === 1;
  return true;
}

/** cost / volume, or null when volume is zero/absent. */
export function pricePerLiter(entry) {
  if (!entry || !entry.volume) return null;
  return entry.cost / entry.volume;
}

/**
 * Augment each entry (oldest first, one vehicle) with:
 *   - tripDistance: odometer delta from the previous entry (null for the first)
 *   - kmPerL: full-to-full economy at this fill (null for partials and the
 *     baseline full that has no prior full to measure from)
 */
export function computeEntries(entries) {
  let prevOdometer = null;
  let lastFullOdometer = null;
  let litersSinceLastFull = 0; // litres added after the last full tank, excluding the current entry

  return entries.map((e) => {
    const tripDistance = prevOdometer === null ? null : e.odometer - prevOdometer;
    let kmPerL = null;

    if (isFullTank(e)) {
      if (lastFullOdometer !== null) {
        const segmentDistance = e.odometer - lastFullOdometer;
        const segmentLiters = litersSinceLastFull + e.volume;
        kmPerL = segmentLiters > 0 ? segmentDistance / segmentLiters : null;
      }
      lastFullOdometer = e.odometer;
      litersSinceLastFull = 0;
    } else if (lastFullOdometer !== null) {
      litersSinceLastFull += e.volume;
    }

    prevOdometer = e.odometer;
    return { ...e, tripDistance, kmPerL };
  });
}

/**
 * Roll a vehicle's fill history up into headline numbers. Average economy is the
 * total measured distance over total measured litres across full-to-full segments
 * (not a mean of per-segment ratios).
 */
export function summarize(entries) {
  if (entries.length === 0) {
    return {
      entries: 0,
      totalDistance: 0,
      totalLiters: 0,
      totalCost: 0,
      avgKmPerL: null,
      avgPricePerLiter: null,
    };
  }

  let totalLiters = 0;
  let totalCost = 0;
  let measuredDistance = 0;
  let measuredLiters = 0;

  let lastFullOdometer = null;
  let litersSinceLastFull = 0;

  for (const e of entries) {
    totalLiters += e.volume;
    totalCost += e.cost;

    if (isFullTank(e)) {
      if (lastFullOdometer !== null) {
        measuredDistance += e.odometer - lastFullOdometer;
        measuredLiters += litersSinceLastFull + e.volume;
      }
      lastFullOdometer = e.odometer;
      litersSinceLastFull = 0;
    } else if (lastFullOdometer !== null) {
      litersSinceLastFull += e.volume;
    }
  }

  const totalDistance = entries[entries.length - 1].odometer - entries[0].odometer;

  return {
    entries: entries.length,
    totalDistance,
    totalLiters,
    totalCost,
    avgKmPerL: measuredLiters > 0 ? measuredDistance / measuredLiters : null,
    avgPricePerLiter: totalLiters > 0 ? totalCost / totalLiters : null,
  };
}

/** Estimate fuel cost for a trip: distance / economy × price per litre. */
export function tripCostEstimate({ distance, kmPerL, pricePerL }) {
  if (!kmPerL || kmPerL <= 0) return null;
  return (distance / kmPerL) * pricePerL;
}
