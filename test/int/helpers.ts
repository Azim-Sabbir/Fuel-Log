import { env } from "cloudflare:test";
// Vite raw imports keep the test schema in lockstep with the real migrations.
import schema0001 from "../../migrations/0001_init.sql?raw";
import schema0002 from "../../migrations/0002_service_reminders.sql?raw";
import schema0003 from "../../migrations/0003_trips.sql?raw";

// Child tables first so drops don't trip foreign keys.
const TABLES = [
  "fuel_entries",
  "service_entries",
  "reminders",
  "trips",
  "vehicles",
  "auth_sessions",
  "users",
];

/** Drop and recreate all tables from the migrations. Call in beforeEach. */
export async function resetDb() {
  for (const t of TABLES) {
    await env.DB.prepare(`DROP TABLE IF EXISTS ${t}`).run();
  }
  for (const schema of [schema0001, schema0002, schema0003]) {
    for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
      await env.DB.prepare(stmt).run();
    }
  }
}

/** Build a request context as the auth middleware would hand it to a handler
 *  (userId already resolved into ctx.data). */
export function authCtx(
  url: string,
  userId: number,
  opts: { method?: string; body?: unknown; params?: Record<string, string> } = {}
): any {
  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return {
    request: new Request("https://x" + url, init),
    env,
    data: { userId },
    params: opts.params ?? {},
  };
}
