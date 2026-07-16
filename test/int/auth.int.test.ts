import { describe, it, expect, beforeEach, vi } from "vitest";
import { env } from "cloudflare:test";
import { resetDb } from "./helpers";
import { onRequest as middleware } from "../../functions/api/_middleware";
import { onRequestGet as me } from "../../functions/api/me";
import { onRequestPost as logout } from "../../functions/api/auth/logout";
import { upsertUserByGoogleSub, createAuthSession, getUserBySessionHash } from "../../lib/db";
import { hashToken } from "../../lib/auth";

const NOW = new Date().toISOString();

async function seedSession(token: string, sub = "g1") {
  const u = await upsertUserByGoogleSub(env.DB, {
    googleSub: sub,
    email: `${sub}@b.com`,
    name: "A",
    picture: null,
    now: NOW,
  });
  await createAuthSession(env.DB, {
    userId: u.id,
    tokenHash: await hashToken(token),
    now: NOW,
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  return u;
}

function ctx(path: string, opts: { cookie?: string; data?: any } = {}) {
  const headers = new Headers();
  if (opts.cookie) headers.set("Cookie", opts.cookie);
  return {
    request: new Request("https://x" + path, { headers }),
    env,
    data: opts.data ?? {},
    next: vi.fn(async () => new Response("ok", { status: 200 })),
  } as any;
}

beforeEach(resetDb);

describe("_middleware (session auth)", () => {
  it("401 without a session cookie", async () => {
    const res = await middleware(ctx("/api/vehicles"));
    expect(res.status).toBe(401);
  });

  it("401 with an unknown session token", async () => {
    const res = await middleware(ctx("/api/vehicles", { cookie: "session=deadbeef" }));
    expect(res.status).toBe(401);
  });

  it("lets the OAuth start/callback endpoints through unauthenticated", async () => {
    const c = ctx("/api/auth/google/start");
    await middleware(c);
    expect(c.next).toHaveBeenCalled();
  });

  it("passes through and sets data.userId for a valid session", async () => {
    const u = await seedSession("tok-valid");
    const c = ctx("/api/vehicles", { cookie: "session=tok-valid" });
    await middleware(c);
    expect(c.next).toHaveBeenCalled();
    expect(c.data.userId).toBe(u.id);
    expect(c.data.user.email).toBe("g1@b.com");
  });
});

describe("GET /api/me", () => {
  it("returns a safe projection of the current user", async () => {
    const u = await seedSession("tok");
    const full = await getUserBySessionHash(env.DB, await hashToken("tok"), NOW);
    const res = await me(ctx("/api/me", { data: { userId: u.id, user: full } }));
    const body = (await res.json()) as any;
    expect(body).toEqual({ id: u.id, email: "g1@b.com", name: "A", picture: null });
    expect(body.password_hash).toBeUndefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    await seedSession("tok");
    const res = await logout(ctx("/api/auth/logout", { cookie: "session=tok" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await getUserBySessionHash(env.DB, await hashToken("tok"), NOW)).toBeNull();
  });
});
