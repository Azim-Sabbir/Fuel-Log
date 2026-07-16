// Trip roll-up. Pure ES module (browser + Vitest). `items` are the fuel + service
// entries assigned to a trip, each with { odometer, cost }.

export function tripSummary(items) {
  if (items.length === 0) return { count: 0, distance: 0, totalCost: 0 };
  const odos = items.map((i) => i.odometer);
  const distance = Math.max(...odos) - Math.min(...odos);
  const totalCost = items.reduce((sum, i) => sum + (i.cost || 0), 0);
  return { count: items.length, distance, totalCost };
}
