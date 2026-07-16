import { updateReminder, deleteReminder } from "../../../lib/db";
import { json } from "../../../lib/http";
import { asNumber, asTrimmedString, isDateStr } from "../../../lib/validate";
import type { Env, AuthData } from "../../../lib/env";

export const onRequestPut: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;

  let lastDoneDate: string | undefined;
  if (body.lastDoneDate !== undefined) {
    if (!isDateStr(body.lastDoneDate)) return json({ error: "invalid_date" }, 400);
    lastDoneDate = body.lastDoneDate;
  }

  const updated = await updateReminder(ctx.env.DB, ctx.data.userId, id, {
    type: asTrimmedString(body.type) ?? undefined,
    intervalKm: asNumber(body.intervalKm),
    intervalDays: asNumber(body.intervalDays),
    lastDoneOdometer: asNumber(body.lastDoneOdometer),
    lastDoneDate,
  });
  if (!updated) return json({ error: "not_found" }, 404);
  return json({ reminder: updated });
};

export const onRequestDelete: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const n = await deleteReminder(ctx.env.DB, ctx.data.userId, id);
  if (n === 0) return json({ error: "not_found" }, 404);
  return json({ deleted: n });
};
