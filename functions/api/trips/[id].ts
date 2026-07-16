import {
  getTrip,
  updateTrip,
  deleteTrip,
  listFuelEntriesByTrip,
  listServiceEntriesByTrip,
} from "../../../lib/db";
import { json } from "../../../lib/http";
import { asTrimmedString, isDateStr } from "../../../lib/validate";
import type { Env, AuthData } from "../../../lib/env";

const CATEGORIES = new Set(["business", "personal", "vacation"]);

export const onRequestGet: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const trip = await getTrip(ctx.env.DB, ctx.data.userId, id);
  if (!trip) return json({ error: "not_found" }, 404);

  const [fuelEntries, serviceEntries] = await Promise.all([
    listFuelEntriesByTrip(ctx.env.DB, ctx.data.userId, id),
    listServiceEntriesByTrip(ctx.env.DB, ctx.data.userId, id),
  ]);
  return json({ trip, fuelEntries, serviceEntries });
};

export const onRequestPut: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;

  let startDate: string | undefined;
  let endDate: string | undefined;
  if (body.startDate !== undefined) {
    if (!isDateStr(body.startDate)) return json({ error: "invalid_date" }, 400);
    startDate = body.startDate;
  }
  if (body.endDate !== undefined) {
    if (!isDateStr(body.endDate)) return json({ error: "invalid_date" }, 400);
    endDate = body.endDate;
  }
  const category =
    body.category !== undefined && CATEGORIES.has(String(body.category))
      ? String(body.category)
      : undefined;

  const updated = await updateTrip(ctx.env.DB, ctx.data.userId, id, {
    name: asTrimmedString(body.name) ?? undefined,
    category,
    startDate,
    endDate,
  });
  if (!updated) return json({ error: "not_found" }, 404);
  return json({ trip: updated });
};

export const onRequestDelete: PagesFunction<Env, "id", AuthData> = async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return json({ error: "bad_id" }, 400);

  const n = await deleteTrip(ctx.env.DB, ctx.data.userId, id);
  if (n === 0) return json({ error: "not_found" }, 404);
  return json({ deleted: n });
};
