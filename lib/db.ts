// All SQL for Fuel Log lives here. Handlers call these helpers; they never write
// raw SQL. Every user-owned query is scoped by user_id so one user can never read
// or mutate another's rows.

export interface User {
  id: number;
  google_sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  password_hash: string | null;
  email_verified: number;
  created_at: string;
}

export interface Vehicle {
  id: number;
  user_id: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  initial_odometer: number;
  created_at: string;
  archived_at: string | null;
}

export interface FuelEntry {
  id: number;
  user_id: number;
  vehicle_id: number;
  date: string;
  odometer: number;
  volume: number;
  cost: number;
  is_full: number;
  location: string | null;
  notes: string | null;
  trip_id: number | null;
  receipt_key: string | null;
  created_at: string;
}

export interface ServiceEntry {
  id: number;
  user_id: number;
  vehicle_id: number;
  date: string;
  odometer: number;
  type: string;
  cost: number;
  location: string | null;
  notes: string | null;
  trip_id: number | null;
  receipt_key: string | null;
  created_at: string;
}

export interface Reminder {
  id: number;
  user_id: number;
  vehicle_id: number;
  type: string;
  interval_km: number | null;
  interval_days: number | null;
  last_done_odometer: number | null;
  last_done_date: string | null;
  created_at: string;
}

// ---------- users + sessions ----------

export async function upsertUserByGoogleSub(
  db: D1Database,
  u: { googleSub: string; email: string; name?: string | null; picture?: string | null; now: string }
): Promise<User> {
  const row = await db
    .prepare(
      `INSERT INTO users (google_sub, email, name, picture, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email, name = excluded.name, picture = excluded.picture
       RETURNING *`
    )
    .bind(u.googleSub, u.email, u.name ?? null, u.picture ?? null, u.now)
    .first<User>();
  return row!;
}

export async function createAuthSession(
  db: D1Database,
  s: { userId: number; tokenHash: string; now: string; expiresAt: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO auth_sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)`
    )
    .bind(s.userId, s.tokenHash, s.now, s.expiresAt)
    .run();
}

/** The user behind an unexpired session token hash, or null. */
export async function getUserBySessionHash(
  db: D1Database,
  tokenHash: string,
  now: string
): Promise<User | null> {
  return await db
    .prepare(
      `SELECT u.* FROM users u
       JOIN auth_sessions s ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(tokenHash, now)
    .first<User>();
}

export async function deleteAuthSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

// ---------- vehicles ----------

export async function createVehicle(
  db: D1Database,
  userId: number,
  v: {
    name: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    initialOdometer?: number;
    now: string;
  }
): Promise<Vehicle> {
  const row = await db
    .prepare(
      `INSERT INTO vehicles (user_id, name, make, model, year, initial_odometer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(userId, v.name, v.make ?? null, v.model ?? null, v.year ?? null, v.initialOdometer ?? 0, v.now)
    .first<Vehicle>();
  return row!;
}

export async function listVehicles(db: D1Database, userId: number): Promise<Vehicle[]> {
  const res = await db
    .prepare(`SELECT * FROM vehicles WHERE user_id = ? AND archived_at IS NULL ORDER BY id ASC`)
    .bind(userId)
    .all<Vehicle>();
  return res.results ?? [];
}

export async function getVehicle(
  db: D1Database,
  userId: number,
  id: number
): Promise<Vehicle | null> {
  return await db
    .prepare(`SELECT * FROM vehicles WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<Vehicle>();
}

/** Update provided fields (null = leave unchanged). Returns null if not owned. */
export async function updateVehicle(
  db: D1Database,
  userId: number,
  id: number,
  f: { name?: string; make?: string; model?: string; year?: number; initialOdometer?: number }
): Promise<Vehicle | null> {
  return await db
    .prepare(
      `UPDATE vehicles SET
         name = COALESCE(?, name),
         make = COALESCE(?, make),
         model = COALESCE(?, model),
         year = COALESCE(?, year),
         initial_odometer = COALESCE(?, initial_odometer)
       WHERE id = ? AND user_id = ? RETURNING *`
    )
    .bind(f.name ?? null, f.make ?? null, f.model ?? null, f.year ?? null, f.initialOdometer ?? null, id, userId)
    .first<Vehicle>();
}

/** Delete a vehicle and all its child records. Returns rows deleted (0 if not owned). */
export async function deleteVehicle(db: D1Database, userId: number, id: number): Promise<number> {
  for (const table of ["fuel_entries", "service_entries", "reminders"]) {
    await db.prepare(`DELETE FROM ${table} WHERE vehicle_id = ? AND user_id = ?`).bind(id, userId).run();
  }
  const res = await db
    .prepare(`DELETE FROM vehicles WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return res.meta.changes ?? 0;
}

// ---------- fuel entries ----------

export async function createFuelEntry(
  db: D1Database,
  userId: number,
  e: {
    vehicleId: number;
    date: string;
    odometer: number;
    volume: number;
    cost: number;
    isFull?: boolean;
    location?: string | null;
    notes?: string | null;
    now: string;
  }
): Promise<FuelEntry> {
  const row = await db
    .prepare(
      `INSERT INTO fuel_entries (user_id, vehicle_id, date, odometer, volume, cost, is_full, location, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      userId,
      e.vehicleId,
      e.date,
      e.odometer,
      e.volume,
      e.cost,
      e.isFull === false ? 0 : 1,
      e.location ?? null,
      e.notes ?? null,
      e.now
    )
    .first<FuelEntry>();
  return row!;
}

/** A vehicle's fuel entries oldest-first (the order the economy math expects). */
export async function listFuelEntries(
  db: D1Database,
  userId: number,
  vehicleId: number
): Promise<FuelEntry[]> {
  const res = await db
    .prepare(
      `SELECT * FROM fuel_entries WHERE user_id = ? AND vehicle_id = ?
       ORDER BY date ASC, odometer ASC, id ASC`
    )
    .bind(userId, vehicleId)
    .all<FuelEntry>();
  return res.results ?? [];
}

export async function getFuelEntry(
  db: D1Database,
  userId: number,
  id: number
): Promise<FuelEntry | null> {
  return await db
    .prepare(`SELECT * FROM fuel_entries WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<FuelEntry>();
}

export async function updateFuelEntry(
  db: D1Database,
  userId: number,
  id: number,
  f: {
    date?: string;
    odometer?: number;
    volume?: number;
    cost?: number;
    isFull?: boolean;
    location?: string;
    notes?: string;
  }
): Promise<FuelEntry | null> {
  return await db
    .prepare(
      `UPDATE fuel_entries SET
         date = COALESCE(?, date),
         odometer = COALESCE(?, odometer),
         volume = COALESCE(?, volume),
         cost = COALESCE(?, cost),
         is_full = COALESCE(?, is_full),
         location = COALESCE(?, location),
         notes = COALESCE(?, notes)
       WHERE id = ? AND user_id = ? RETURNING *`
    )
    .bind(
      f.date ?? null,
      f.odometer ?? null,
      f.volume ?? null,
      f.cost ?? null,
      f.isFull == null ? null : f.isFull ? 1 : 0,
      f.location ?? null,
      f.notes ?? null,
      id,
      userId
    )
    .first<FuelEntry>();
}

export async function deleteFuelEntry(db: D1Database, userId: number, id: number): Promise<number> {
  const res = await db
    .prepare(`DELETE FROM fuel_entries WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return res.meta.changes ?? 0;
}

// ---------- service entries ----------

export async function createServiceEntry(
  db: D1Database,
  userId: number,
  e: {
    vehicleId: number;
    date: string;
    odometer: number;
    type: string;
    cost?: number;
    location?: string | null;
    notes?: string | null;
    now: string;
  }
): Promise<ServiceEntry> {
  const row = await db
    .prepare(
      `INSERT INTO service_entries (user_id, vehicle_id, date, odometer, type, cost, location, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(userId, e.vehicleId, e.date, e.odometer, e.type, e.cost ?? 0, e.location ?? null, e.notes ?? null, e.now)
    .first<ServiceEntry>();
  return row!;
}

export async function listServiceEntries(
  db: D1Database,
  userId: number,
  vehicleId: number
): Promise<ServiceEntry[]> {
  const res = await db
    .prepare(
      `SELECT * FROM service_entries WHERE user_id = ? AND vehicle_id = ?
       ORDER BY date ASC, odometer ASC, id ASC`
    )
    .bind(userId, vehicleId)
    .all<ServiceEntry>();
  return res.results ?? [];
}

export async function getServiceEntry(
  db: D1Database,
  userId: number,
  id: number
): Promise<ServiceEntry | null> {
  return await db
    .prepare(`SELECT * FROM service_entries WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<ServiceEntry>();
}

export async function updateServiceEntry(
  db: D1Database,
  userId: number,
  id: number,
  f: { date?: string; odometer?: number; type?: string; cost?: number; location?: string; notes?: string }
): Promise<ServiceEntry | null> {
  return await db
    .prepare(
      `UPDATE service_entries SET
         date = COALESCE(?, date),
         odometer = COALESCE(?, odometer),
         type = COALESCE(?, type),
         cost = COALESCE(?, cost),
         location = COALESCE(?, location),
         notes = COALESCE(?, notes)
       WHERE id = ? AND user_id = ? RETURNING *`
    )
    .bind(f.date ?? null, f.odometer ?? null, f.type ?? null, f.cost ?? null, f.location ?? null, f.notes ?? null, id, userId)
    .first<ServiceEntry>();
}

export async function deleteServiceEntry(
  db: D1Database,
  userId: number,
  id: number
): Promise<number> {
  const res = await db
    .prepare(`DELETE FROM service_entries WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return res.meta.changes ?? 0;
}

// ---------- reminders ----------

export async function createReminder(
  db: D1Database,
  userId: number,
  r: {
    vehicleId: number;
    type: string;
    intervalKm?: number | null;
    intervalDays?: number | null;
    lastDoneOdometer?: number | null;
    lastDoneDate?: string | null;
    now: string;
  }
): Promise<Reminder> {
  const row = await db
    .prepare(
      `INSERT INTO reminders (user_id, vehicle_id, type, interval_km, interval_days, last_done_odometer, last_done_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      userId,
      r.vehicleId,
      r.type,
      r.intervalKm ?? null,
      r.intervalDays ?? null,
      r.lastDoneOdometer ?? null,
      r.lastDoneDate ?? null,
      r.now
    )
    .first<Reminder>();
  return row!;
}

export async function listReminders(
  db: D1Database,
  userId: number,
  vehicleId: number
): Promise<Reminder[]> {
  const res = await db
    .prepare(`SELECT * FROM reminders WHERE user_id = ? AND vehicle_id = ? ORDER BY id ASC`)
    .bind(userId, vehicleId)
    .all<Reminder>();
  return res.results ?? [];
}

export async function getReminder(
  db: D1Database,
  userId: number,
  id: number
): Promise<Reminder | null> {
  return await db
    .prepare(`SELECT * FROM reminders WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<Reminder>();
}

export async function updateReminder(
  db: D1Database,
  userId: number,
  id: number,
  f: {
    type?: string;
    intervalKm?: number;
    intervalDays?: number;
    lastDoneOdometer?: number;
    lastDoneDate?: string;
  }
): Promise<Reminder | null> {
  return await db
    .prepare(
      `UPDATE reminders SET
         type = COALESCE(?, type),
         interval_km = COALESCE(?, interval_km),
         interval_days = COALESCE(?, interval_days),
         last_done_odometer = COALESCE(?, last_done_odometer),
         last_done_date = COALESCE(?, last_done_date)
       WHERE id = ? AND user_id = ? RETURNING *`
    )
    .bind(
      f.type ?? null,
      f.intervalKm ?? null,
      f.intervalDays ?? null,
      f.lastDoneOdometer ?? null,
      f.lastDoneDate ?? null,
      id,
      userId
    )
    .first<Reminder>();
}

export async function deleteReminder(db: D1Database, userId: number, id: number): Promise<number> {
  const res = await db.prepare(`DELETE FROM reminders WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  return res.meta.changes ?? 0;
}
