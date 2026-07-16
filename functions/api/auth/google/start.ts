import { generateToken, serializeCookie } from "../../../../lib/auth";
import { buildGoogleAuthUrl } from "../../../../lib/oauth";
import type { Env } from "../../../../lib/env";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const state = generateToken();
  const redirectUri = `${ctx.env.APP_URL}/api/auth/google/callback`;
  const url = buildGoogleAuthUrl({
    clientId: ctx.env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
  });

  // Short-lived CSRF cookie; compared against the `state` Google echoes back.
  const stateCookie = serializeCookie("oauth_state", state, {
    path: "/",
    maxAge: 600,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  return new Response(null, {
    status: 302,
    headers: { Location: url, "Set-Cookie": stateCookie },
  });
};
