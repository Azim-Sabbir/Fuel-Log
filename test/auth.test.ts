import { describe, it, expect } from "vitest";
import {
  timingSafeEqual,
  generateToken,
  hashToken,
  parseCookies,
  serializeCookie,
} from "../lib/auth";

describe("timingSafeEqual", () => {
  it("true for equal strings", () => expect(timingSafeEqual("abc123", "abc123")).toBe(true));
  it("false for different strings", () => expect(timingSafeEqual("abc123", "abc124")).toBe(false));
  it("false for different lengths", () => expect(timingSafeEqual("abc", "abcd")).toBe(false));
});

describe("generateToken", () => {
  it("returns 64 hex chars", () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is different each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("hashToken (SHA-256 hex)", () => {
  it("matches the known SHA-256 vector for 'abc'", async () => {
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
  it("is deterministic and differs for different input", async () => {
    expect(await hashToken("token-x")).toBe(await hashToken("token-x"));
    expect(await hashToken("token-x")).not.toBe(await hashToken("token-y"));
  });
});

describe("parseCookies", () => {
  it("parses a Cookie header into a map", () => {
    expect(parseCookies("session=abc; oauth_state=xyz")).toEqual({
      session: "abc",
      oauth_state: "xyz",
    });
  });
  it("returns {} for null/empty and ignores malformed pairs", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies("")).toEqual({});
    expect(parseCookies("nonsense")).toEqual({});
  });
});

describe("serializeCookie", () => {
  it("builds a secure session cookie string in canonical order", () => {
    expect(
      serializeCookie("session", "abc", {
        path: "/",
        maxAge: 2592000,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      })
    ).toBe("session=abc; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax");
  });
  it("builds a clearing cookie with Max-Age=0", () => {
    expect(serializeCookie("session", "", { path: "/", maxAge: 0 })).toBe(
      "session=; Path=/; Max-Age=0"
    );
  });
});
