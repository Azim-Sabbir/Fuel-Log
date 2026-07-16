import { json } from "../../lib/http";
import type { Env, AuthData } from "../../lib/env";

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const u = ctx.data.user;
  return json({ id: u.id, email: u.email, name: u.name, picture: u.picture });
};
