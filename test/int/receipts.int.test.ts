import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { resetDb, authCtx } from "./helpers";
import { onRequestPost as upload } from "../../functions/api/receipts";
import { onRequestGet as serve } from "../../functions/api/receipts/[[path]]";
import { onRequestPost as createFuel } from "../../functions/api/fuel";
import { upsertUserByGoogleSub, createVehicle } from "../../lib/db";

const NOW = new Date().toISOString();
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]); // fake png bytes

beforeEach(resetDb);
async function makeUser(sub = "g1") {
  return upsertUserByGoogleSub(env.DB, { googleSub: sub, email: `${sub}@b.com`, now: NOW });
}

function uploadCtx(userId: number, body: BodyInit | null, contentType = "image/png"): any {
  return {
    request: new Request("https://x/api/receipts", {
      method: "POST",
      headers: contentType ? { "Content-Type": contentType } : {},
      body,
    }),
    env,
    data: { userId },
    params: {},
  };
}
function serveCtx(userId: number, segments: string[]): any {
  return {
    request: new Request("https://x/api/receipts/" + segments.join("/")),
    env,
    data: { userId },
    params: { path: segments },
  };
}

describe("POST /api/receipts", () => {
  it("stores an uploaded image in R2 under the user's prefix", async () => {
    const u = await makeUser();
    const res = await upload(uploadCtx(u.id, PNG));
    expect(res.status).toBe(201);
    const { key } = (await res.json()) as any;
    expect(key.startsWith(`${u.id}/`)).toBe(true);
    const obj = await env.RECEIPTS.get(key);
    expect(obj).not.toBeNull();
    expect(obj!.httpMetadata?.contentType).toBe("image/png");
  });

  it("400 for a non-image content type", async () => {
    const u = await makeUser();
    expect((await upload(uploadCtx(u.id, "hello", "text/plain"))).status).toBe(400);
  });
});

describe("GET /api/receipts/:key", () => {
  it("serves an owned object and blocks other users", async () => {
    const u = await makeUser("me");
    const other = await makeUser("other");
    const { key } = (await (await upload(uploadCtx(u.id, PNG))).json()) as any;
    const segments = key.split("/");

    const ok = await serve(serveCtx(u.id, segments));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);

    // Another user cannot read it (prefix mismatch).
    expect((await serve(serveCtx(other.id, segments))).status).toBe(403);
  });

  it("404 for a missing object", async () => {
    const u = await makeUser();
    expect((await serve(serveCtx(u.id, [String(u.id), "nope"]))).status).toBe(404);
  });
});

describe("fuel entry stores a receiptKey", () => {
  it("persists receipt_key from the create body", async () => {
    const u = await makeUser();
    const v = await createVehicle(env.DB, u.id, { name: "Car", now: NOW });
    const res = await createFuel(
      authCtx("/api/fuel", u.id, {
        method: "POST",
        body: {
          vehicleId: v.id,
          date: "2026-01-01",
          odometer: 1000,
          volume: 30,
          cost: 3000,
          receiptKey: `${u.id}/abc123`,
        },
      })
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).entry.receipt_key).toBe(`${u.id}/abc123`);
  });
});
