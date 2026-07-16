import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { resetDb } from "./helpers";
import { onRequestGet as start } from "../../functions/api/auth/google/start";
import { onRequestGet as callback } from "../../functions/api/auth/google/callback";
import { getUserBySessionHash } from "../../lib/db";
import { hashToken } from "../../lib/auth";

// Matches GOOGLE_CLIENT_ID in vitest.workers.config.ts.
const CLIENT_ID = "test-client-id.apps.googleusercontent.com";

function b64url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeIdToken(payload: unknown): string {
  return [b64url({ alg: "RS256", typ: "JWT" }), b64url(payload), "sig"].join(".");
}

function ctx(path: string, opts: { cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.cookie) headers.set("Cookie", opts.cookie);
  return { request: new Request("https://x" + path, { headers }), env } as any;
}

// getSetCookie() exists in the Workers runtime but isn't in @cloudflare/workers-types.
function setCookies(res: Response): string[] {
  return (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
}

beforeEach(async () => {
  await resetDb();
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("GET /api/auth/google/start", () => {
  it("redirects to Google with a state that matches the oauth_state cookie", async () => {
    const res = await start(ctx("/api/auth/google/start"));
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location")!;
    expect(loc).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    const urlState = new URL(loc).searchParams.get("state");
    const setCookie = setCookies(res).find((c) => c.startsWith("oauth_state="))!;
    expect(setCookie).toContain(`oauth_state=${urlState}`);
    expect(setCookie).toContain("HttpOnly");
  });
});

describe("GET /api/auth/google/callback", () => {
  it("400 when the state does not match the cookie", async () => {
    const res = await callback(
      ctx("/api/auth/google/callback?code=abc&state=x", { cookie: "oauth_state=y" })
    );
    expect(res.status).toBe(400);
  });

  it("exchanges the code, upserts the user + session, sets cookie, redirects home", async () => {
    const idToken = makeIdToken({
      sub: "google-123",
      email: "user@gmail.com",
      name: "Test User",
      picture: "http://pic",
      aud: CLIENT_ID,
      iss: "https://accounts.google.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    fetchMock
      .get("https://oauth2.googleapis.com")
      .intercept({ path: "/token", method: "POST" })
      .reply(200, JSON.stringify({ id_token: idToken }), {
        headers: { "content-type": "application/json" },
      });

    const res = await callback(
      ctx("/api/auth/google/callback?code=abc&state=st8", { cookie: "oauth_state=st8" })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost:8788/");

    const sessionCookie = setCookies(res).find((c) => c.startsWith("session="))!;
    expect(sessionCookie).toContain("HttpOnly");
    const token = /session=([0-9a-f]+)/.exec(sessionCookie)![1];

    const user = await getUserBySessionHash(env.DB, await hashToken(token), new Date().toISOString());
    expect(user?.email).toBe("user@gmail.com");
    expect(user?.google_sub).toBe("google-123");
    expect(user?.name).toBe("Test User");
  });

  it("401 when the id_token audience is for a different client", async () => {
    const idToken = makeIdToken({
      sub: "x",
      email: "user@gmail.com",
      aud: "someone-else.apps.googleusercontent.com",
      iss: "https://accounts.google.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    fetchMock
      .get("https://oauth2.googleapis.com")
      .intercept({ path: "/token", method: "POST" })
      .reply(200, JSON.stringify({ id_token: idToken }), {
        headers: { "content-type": "application/json" },
      });

    const res = await callback(
      ctx("/api/auth/google/callback?code=abc&state=st8", { cookie: "oauth_state=st8" })
    );
    expect(res.status).toBe(401);
  });
});
