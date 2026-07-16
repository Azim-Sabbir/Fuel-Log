import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

describe("smoke (workers pool)", () => {
  it("has D1, KV, and R2 bindings", () => {
    expect(env.DB).toBeDefined();
    expect(env.SETTINGS).toBeDefined();
    expect(env.RECEIPTS).toBeDefined();
    expect(env.APP_URL).toBe("http://localhost:8788");
  });
});
