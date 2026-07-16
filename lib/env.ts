export interface Env {
  DB: D1Database;
  SETTINGS: KVNamespace;
  // Object storage for receipt images (private; served via an auth-checked handler).
  RECEIPTS: R2Bucket;
  // Google OAuth 2.0 web-client credentials.
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Public base URL of the app (no trailing slash), used to build the OAuth
  // redirect URI, e.g. "http://localhost:8788" or "https://fuel-log.pages.dev".
  APP_URL: string;
}

import type { User } from "./db";

// Data attached to the request context by the auth middleware for protected routes.
// A type alias (not an interface) so it satisfies PagesFunction's
// `Data extends Record<string, unknown>` constraint.
export type AuthData = {
  userId: number;
  user: User;
};
