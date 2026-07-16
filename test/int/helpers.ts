import { env } from "cloudflare:test";
// Vite raw import keeps the test schema in lockstep with the real migration.
import schema from "../../migrations/0001_init.sql?raw";

const TABLES = ["fuel_entries", "vehicles", "auth_sessions", "users"];

/** Drop and recreate all tables from the migration. Call in beforeEach. */
export async function resetDb() {
  for (const t of TABLES) {
    await env.DB.prepare(`DROP TABLE IF EXISTS ${t}`).run();
  }
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
}
