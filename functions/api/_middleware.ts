import { parseCookies, hashToken } from "../../lib/auth";
import { getUserBySessionHash } from "../../lib/db";
import { json } from "../../lib/http";
import type { Env, AuthData } from "../../lib/env";

// The only /api/* paths reachable without a session — the login round-trip.
const PUBLIC_PATHS = new Set([
  "/api/auth/google/start",
  "/api/auth/google/callback",
]);

export const onRequest: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return ctx.next();

  const token = parseCookies(ctx.request.headers.get("Cookie"))["session"];
  if (!token) return json({ error: "unauthorized" }, 401);

  const user = await getUserBySessionHash(
    ctx.env.DB,
    await hashToken(token),
    new Date().toISOString()
  );
  if (!user) return json({ error: "unauthorized" }, 401);

  ctx.data.userId = user.id;
  ctx.data.user = user;
  return ctx.next();
};
