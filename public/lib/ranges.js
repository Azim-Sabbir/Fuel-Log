// Date-range presets for the history/report filters. Pure ES module (browser +
// Vitest). Dates are Dhaka (UTC+6) calendar strings "YYYY-MM-DD".

const DHAKA_OFFSET_MIN = 6 * 60;

/** UTC instant → Dhaka calendar date "YYYY-MM-DD". */
export function dhakaToday(date) {
  const s = new Date(date.getTime() + DHAKA_OFFSET_MIN * 60_000);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, "0");
  const d = String(s.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Move a "YYYY-MM-DD" string by whole months, clamping the day to month length. */
export function shiftMonths(dateStr, deltaMonths) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetMonthIndex = m - 1 + deltaMonths;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12; // 0-11
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

/** Named preset → { from, to } window ending today (Dhaka). */
export function presetRange(preset, now = new Date()) {
  const to = dhakaToday(now);
  switch (preset) {
    case "3mo":
      return { from: shiftMonths(to, -3), to };
    case "6mo":
      return { from: shiftMonths(to, -6), to };
    case "1yr":
      return { from: shiftMonths(to, -12), to };
    case "all":
      return { from: "1900-01-01", to };
    case "month":
    default:
      return { from: to.slice(0, 8) + "01", to };
  }
}
