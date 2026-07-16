import { describe, it, expect } from "vitest";
import { buildGoogleAuthUrl, decodeIdToken, validateIdClaims } from "../lib/oauth";

// Helper: base64url-encode JSON like a JWT segment (UTF-8 safe, no Buffer).
function b64url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeJwt(payload: unknown): string {
  return [b64url({ alg: "RS256", typ: "JWT" }), b64url(payload), "sig"].join(".");
}

describe("buildGoogleAuthUrl", () => {
  it("builds the authorization URL with the required params", () => {
    const url = buildGoogleAuthUrl({
      clientId: "cid",
      redirectUri: "http://localhost:8788/api/auth/google/callback",
      state: "st8",
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8788/api/auth/google/callback"
    );
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe("st8");
  });
});

describe("decodeIdToken", () => {
  it("decodes the payload segment, preserving UTF-8", () => {
    const payload = {
      sub: "123",
      email: "a@b.com",
      name: "José",
      aud: "cid",
      iss: "https://accounts.google.com",
      exp: 2000000000,
    };
    expect(decodeIdToken(makeJwt(payload))).toEqual(payload);
  });
  it("throws on a malformed token", () => {
    expect(() => decodeIdToken("notajwt")).toThrow();
  });
});

describe("validateIdClaims", () => {
  const base = { aud: "cid", iss: "https://accounts.google.com", exp: 2000000000 };
  const now = 1000000000;

  it("accepts valid claims", () => {
    expect(() => validateIdClaims(base, { clientId: "cid", now })).not.toThrow();
    expect(() =>
      validateIdClaims({ ...base, iss: "accounts.google.com" }, { clientId: "cid", now })
    ).not.toThrow();
  });
  it("rejects a mismatched audience", () => {
    expect(() => validateIdClaims({ ...base, aud: "other" }, { clientId: "cid", now })).toThrow(
      /aud/
    );
  });
  it("rejects an untrusted issuer", () => {
    expect(() => validateIdClaims({ ...base, iss: "evil.com" }, { clientId: "cid", now })).toThrow(
      /iss/
    );
  });
  it("rejects an expired token", () => {
    expect(() => validateIdClaims({ ...base, exp: 500000000 }, { clientId: "cid", now })).toThrow(
      /expire/
    );
  });
});
