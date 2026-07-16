// Google OAuth 2.0 (Authorization Code flow) helpers. The token exchange itself is
// a fetch in the callback handler; these are the pure pieces around it.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TRUSTED_ISS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/** Build the URL to send the user to Google's consent screen. */
export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  [k: string]: unknown;
}

/** Decode (not verify) a JWT's payload segment. Safe to trust only when the JWT
 *  was received directly from Google's token endpoint over TLS. */
export function decodeIdToken(jwt: string): IdTokenClaims {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("invalid_jwt");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Assert the trust-critical claims. Throws with a specific reason if invalid.
 *  Only reads aud/iss/exp, so it accepts any object carrying them. */
export function validateIdClaims(
  claims: { aud?: string; iss?: string; exp?: number },
  opts: { clientId: string; now: number }
): void {
  if (!claims.iss || !TRUSTED_ISS.has(claims.iss)) throw new Error("bad_iss");
  if (claims.aud !== opts.clientId) throw new Error("bad_aud");
  if (typeof claims.exp !== "number" || claims.exp <= opts.now) throw new Error("token_expired");
}
