CREATE TABLE IF NOT EXISTS service_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  odometer REAL NOT NULL,
  type TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  location TEXT,
  notes TEXT,
  trip_id INTEGER,
  receipt_key TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS idx_service_vehicle ON service_entries(vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_service_user ON service_entries(user_id);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  interval_km REAL,
  interval_days INTEGER,
  last_done_odometer REAL,
  last_done_date TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
