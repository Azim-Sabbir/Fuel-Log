// Maintenance-reminder due logic. Pure ES module (browser + Vitest).
// A reminder can be distance-based (interval_km), time-based (interval_days), or
// both; the most-urgent dimension decides the status.

function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(
    s.getUTCDate()
  ).padStart(2, "0")}`;
}

function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// reminder: { interval_km, interval_days, last_done_odometer, last_done_date } (any may be null)
// current:  { odometer, date }
// thresholds: { km, days } — how close counts as "due soon"
// Returns { status: "ok" | "due_soon" | "overdue", remainingKm, remainingDays,
//           nextDueOdometer, nextDueDate } (remaining/next fields are null when
//           that dimension isn't configured).
export function reminderStatus(reminder, current, thresholds = { km: 500, days: 14 }) {
  let remainingKm = null;
  let nextDueOdometer = null;
  if (reminder.interval_km != null && reminder.last_done_odometer != null) {
    nextDueOdometer = reminder.last_done_odometer + reminder.interval_km;
    remainingKm = nextDueOdometer - current.odometer;
  }

  let remainingDays = null;
  let nextDueDate = null;
  if (reminder.interval_days != null && reminder.last_done_date != null) {
    nextDueDate = shiftDate(reminder.last_done_date, reminder.interval_days);
    remainingDays = daysBetween(current.date, nextDueDate);
  }

  const dims = [];
  if (remainingKm != null) dims.push({ remaining: remainingKm, threshold: thresholds.km });
  if (remainingDays != null) dims.push({ remaining: remainingDays, threshold: thresholds.days });

  let status = "ok";
  if (dims.some((d) => d.remaining < 0)) status = "overdue";
  else if (dims.some((d) => d.remaining <= d.threshold)) status = "due_soon";

  return { status, remainingKm, remainingDays, nextDueOdometer, nextDueDate };
}
