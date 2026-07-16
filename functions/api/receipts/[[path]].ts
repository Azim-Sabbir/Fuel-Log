import { json } from "../../../lib/http";
import type { Env, AuthData } from "../../../lib/env";

// Stream a receipt image from R2. The key is `{userId}/{token}`, so we authorize
// by checking the first path segment matches the session user.
export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = ctx.params.path;
  const segments = Array.isArray(raw) ? raw : [raw];
  if (segments[0] !== String(ctx.data.userId)) return json({ error: "forbidden" }, 403);

  const obj = await ctx.env.RECEIPTS.get(segments.join("/"));
  if (!obj) return json({ error: "not_found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
};
