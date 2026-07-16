import { getVehicle, createFuelEntry } from "../../lib/db";
import { json } from "../../lib/http";
import { parseCSV } from "../../lib/csv";
import { isDateStr } from "../../lib/validate";
import type { Env, AuthData } from "../../lib/env";

export const onRequestPost: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = new URL(ctx.request.url).searchParams.get("vehicleId");
  if (raw === null || !/^\d+$/.test(raw)) return json({ error: "vehicleId_required" }, 400);
  const vehicleId = Number(raw);

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  const text = await ctx.request.text();
  const rows = parseCSV(text);

  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const odometer = Number(row.odometer);
    const volume = Number(row.volume);
    const cost = Number(row.cost);

    if (
      !isDateStr(row.date) ||
      !Number.isFinite(odometer) ||
      odometer < 0 ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      skipped++;
      continue;
    }

    const isFullRaw = (row.is_full ?? "").trim().toLowerCase();
    const isFull = !(isFullRaw === "0" || isFullRaw === "false" || isFullRaw === "");

    const location = row.location ? row.location : null;
    const notes = row.notes ? row.notes : null;

    await createFuelEntry(ctx.env.DB, ctx.data.userId, {
      vehicleId,
      date: row.date,
      odometer,
      volume,
      cost,
      isFull,
      location,
      notes,
      now,
    });
    imported++;
  }

  return json({ imported, skipped }, 200);
};
