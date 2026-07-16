import { updateServiceEntry, deleteServiceEntry } from "../../../lib/db";
import { json } from "../../../lib/http";
import { asNumber, asString, asTrimmedString, isDateStr } from "../../../lib/validate";
import type { Env, AuthData } from "../../../lib/env";

export const onRequestPut: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;

  let date: string | undefined;
  if (body.date !== undefined) {
    if (!isDateStr(body.date)) return json({ error: "invalid_date" }, 400);
    date = body.date;
  }

  const updated = await updateServiceEntry(ctx.env.DB, ctx.data.userId, id, {
    date,
    odometer: asNumber(body.odometer),
    type: asTrimmedString(body.type) ?? undefined,
    cost: asNumber(body.cost),
    location: asString(body.location),
    notes: asString(body.notes),
  });
  if (!updated) return json({ error: "not_found" }, 404);
  return json({ entry: updated });
};

export const onRequestDelete: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const n = await deleteServiceEntry(ctx.env.DB, ctx.data.userId, id);
  if (n === 0) return json({ error: "not_found" }, 404);
  return json({ deleted: n });
};
