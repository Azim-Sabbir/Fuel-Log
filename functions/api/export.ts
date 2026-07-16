import { getVehicle, listFuelEntries } from "../../lib/db";
import { json } from "../../lib/http";
import { toCSV } from "../../lib/csv";
import type { Env, AuthData } from "../../lib/env";

const COLUMNS = ["date", "odometer", "volume", "cost", "is_full", "location", "notes"];

export const onRequestGet: PagesFunction<Env, string, AuthData> = async (ctx) => {
  const raw = new URL(ctx.request.url).searchParams.get("vehicleId");
  if (raw === null || !/^\d+$/.test(raw)) return json({ error: "vehicleId_required" }, 400);
  const vehicleId = Number(raw);

  const vehicle = await getVehicle(ctx.env.DB, ctx.data.userId, vehicleId);
  if (!vehicle) return json({ error: "vehicle_not_found" }, 404);

  const entries = await listFuelEntries(ctx.env.DB, ctx.data.userId, vehicleId);
  const csv = toCSV(entries as unknown as Record<string, unknown>[], COLUMNS);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fuel-log.csv"',
    },
  });
};
