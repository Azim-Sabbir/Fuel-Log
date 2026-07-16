import { parseCookies, hashToken, serializeCookie } from "../../../lib/auth";
import { deleteAuthSession } from "../../../lib/db";
import type { Env, AuthData } from "../../../lib/env";

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const token = parseCookies(ctx.request.headers.get("Cookie"))["session"];
  if (token) await deleteAuthSession(ctx.env.DB, await hashToken(token));

  const cleared = serializeCookie("session", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cleared },
  });
};
