import {
  parseCookies,
  serializeCookie,
  generateToken,
  hashToken,
  timingSafeEqual,
} from "../../../../lib/auth";
import { decodeIdToken, validateIdClaims } from "../../../../lib/oauth";
import { upsertUserByGoogleSub, createAuthSession } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import type { Env } from "../../../../lib/env";

const SESSION_TTL_DAYS = 30;
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookies(ctx.request.headers.get("Cookie"))["oauth_state"];

  // CSRF: the state echoed by Google must match the one we set at /start.
  if (!code || !state || !cookieState || !timingSafeEqual(state, cookieState)) {
    return json({ error: "invalid_oauth_state" }, 400);
  }

  const redirectUri = `${ctx.env.APP_URL}/api/auth/google/callback`;
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ctx.env.GOOGLE_CLIENT_ID,
      client_secret: ctx.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return json({ error: "token_exchange_failed" }, 502);

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return json({ error: "no_id_token" }, 502);

  // The id_token came directly from Google over TLS, so we decode (not verify the
  // signature) but still assert the trust-critical claims.
  let claims;
  try {
    claims = decodeIdToken(tokens.id_token);
    validateIdClaims(claims, {
      clientId: ctx.env.GOOGLE_CLIENT_ID,
      now: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    return json({ error: "invalid_id_token", detail: (e as Error).message }, 401);
  }

  const now = new Date();
  const user = await upsertUserByGoogleSub(ctx.env.DB, {
    googleSub: claims.sub,
    email: claims.email ?? "",
    name: claims.name ?? null,
    picture: claims.picture ?? null,
    now: now.toISOString(),
  });

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  await createAuthSession(ctx.env.DB, {
    userId: user.id,
    tokenHash: await hashToken(token),
    now: now.toISOString(),
    expiresAt,
  });

  const sessionCookie = serializeCookie("session", token, {
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  const clearState = serializeCookie("oauth_state", "", { path: "/", maxAge: 0 });

  const headers = new Headers({ Location: `${ctx.env.APP_URL}/` });
  headers.append("Set-Cookie", sessionCookie);
  headers.append("Set-Cookie", clearState);
  return new Response(null, { status: 302, headers });
};
