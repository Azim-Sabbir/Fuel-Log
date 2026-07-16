export interface Env {
  DB: D1Database;
  SETTINGS: KVNamespace;
  // Passcode that guards every /api/* call (compared in constant time).
  ACCESS_KEY: string;
}
