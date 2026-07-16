import { generateToken } from "../../lib/auth";
import { json } from "../../lib/http";
import type { Env, AuthData } from "../../lib/env";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Upload a receipt image. Stored in R2 under `{userId}/{token}` so ownership is
// encoded in the key. Returns the key, which the caller stores on an entry.
export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const contentType = ctx.request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("image/")) return json({ error: "not_an_image" }, 400);

  const bytes = await ctx.request.arrayBuffer();
  if (bytes.byteLength === 0) return json({ error: "empty" }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: "too_large" }, 413);

  const key = `${ctx.data.userId}/${generateToken()}`;
  await ctx.env.RECEIPTS.put(key, bytes, { httpMetadata: { contentType } });
  return json({ key }, 201);
};
