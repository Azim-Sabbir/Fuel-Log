// Report aggregations. Pure ES module (browser + Vitest). Works off the entries
// already loaded for a vehicle; dates are "YYYY-MM-DD" strings.

/** Items whose date falls within [from, to] inclusive (lexicographic on ISO dates). */
export function filterByDateRange(items, from, to) {
  return items.filter((i) => i.date >= from && i.date <= to);
}

/** Fuel + service cost grouped by month → sorted [{ month, fuel, service, total }]. */
export function monthlySpend(fuelEntries, serviceEntries) {
  const byMonth = new Map(); // "YYYY-MM" -> { fuel, service }
  const add = (arr, key) => {
    for (const e of arr) {
      const m = e.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, { fuel: 0, service: 0 });
      byMonth.get(m)[key] += e.cost || 0;
    }
  };
  add(fuelEntries, "fuel");
  add(serviceEntries, "service");

  return [...byMonth.keys()].sort().map((month) => {
    const { fuel, service } = byMonth.get(month);
    return { month, fuel, service, total: fuel + service };
  });
}
