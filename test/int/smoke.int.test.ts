import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

describe("smoke (workers pool)", () => {
  it("has D1 and KV bindings", () => {
    expect(env.DB).toBeDefined();
    expect(env.SETTINGS).toBeDefined();
    expect(env.ACCESS_KEY).toBe("test-access-key");
  });
});
