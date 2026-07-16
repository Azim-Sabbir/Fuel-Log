import { computeEntries, summarize, tripCostEstimate } from "/lib/economy.js";
import { fmtBDT, fmtKm, fmtKmPerL } from "/lib/format.js";
import { dhakaToday, presetRange } from "/lib/ranges.js";
import { reminderStatus } from "/lib/reminders.js";
import { tripSummary } from "/lib/trips.js";
import { filterByDateRange, monthlySpend } from "/lib/reports.js";
import { barGeometry, linePoints } from "/lib/chart.js";

const API = "/api";
const ACTIVE_VEHICLE = "fuellog.activeVehicle";

const state = {
  user: null,
  vehicles: [],
  activeVehicleId: null,
  entries: [],
  services: [],
  reminders: [],
  trips: [],
  reportsRange: "1yr",
};

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
}

// Upload a raw image File to /api/receipts. The shared api() wrapper forces a
// JSON content-type, so this posts via fetch directly with the file's MIME type.
// Returns the storage key on success, or null on failure.
async function uploadReceipt(file) {
  const res = await fetch(API + "/receipts", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) return null;
  const { key } = await res.json();
  return key;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add("hidden"), 3000);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

// ---------- views ----------

function showLogin() {
  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}
function showApp() {
  $("appView").classList.remove("hidden");
  $("loginView").classList.add("hidden");
}

// ---------- data ----------

async function loadVehicles() {
  const { vehicles } = await (await api("/vehicles")).json();
  state.vehicles = vehicles;

  const sel = $("vehicleSelect");
  sel.innerHTML = vehicles
    .map((v) => `<option value="${v.id}">${escapeHtml(v.name)}</option>`)
    .join("");

  const stored = Number(localStorage.getItem(ACTIVE_VEHICLE));
  state.activeVehicleId = vehicles.some((v) => v.id === stored)
    ? stored
    : vehicles[0]?.id ?? null;

  if (state.activeVehicleId) {
    sel.value = String(state.activeVehicleId);
    await loadVehicleData();
  } else {
    state.entries = [];
    state.services = [];
    state.reminders = [];
    renderNoVehicle();
  }
}

async function jsonOr(path, key) {
  const res = await api(path);
  if (!res.ok) return [];
  return (await res.json())[key] ?? [];
}

async function loadVehicleData() {
  const id = state.activeVehicleId;
  const [entries, services, reminders, trips] = await Promise.all([
    jsonOr(`/fuel?vehicleId=${id}`, "entries"),
    jsonOr(`/service?vehicleId=${id}`, "entries"),
    jsonOr(`/reminders?vehicleId=${id}`, "reminders"),
    jsonOr(`/trips?vehicleId=${id}`, "trips"),
  ]);
  state.entries = entries; // oldest-first
  state.services = services; // oldest-first
  state.reminders = reminders;
  state.trips = trips;
  render();
}

// Best-known current odometer: the highest reading across fuel + service, else the
// vehicle's starting odometer.
function currentOdometer() {
  const vehicle = state.vehicles.find((v) => v.id === state.activeVehicleId);
  const readings = [
    ...state.entries.map((e) => e.odometer),
    ...state.services.map((s) => s.odometer),
  ];
  if (readings.length) return Math.max(...readings);
  return vehicle?.initial_odometer ?? 0;
}

// ---------- render ----------

const SECTIONS = ["stats", "fuelSection", "tripSection", "reminderSection", "serviceSection"];
const REMINDER_LABEL = { ok: "OK", due_soon: "Due soon", overdue: "Overdue" };
const CATEGORY_LABEL = { personal: "Personal", business: "Business", vacation: "Vacation" };

function renderNoVehicle() {
  SECTIONS.forEach((id) => $(id).classList.add("hidden"));
  $("noVehicle").classList.remove("hidden");
}

function render() {
  $("noVehicle").classList.add("hidden");
  SECTIONS.forEach((id) => $(id).classList.remove("hidden"));

  const sum = summarize(state.entries);
  $("statDistance").textContent = fmtKm(sum.totalDistance);
  $("statEconomy").textContent = fmtKmPerL(sum.avgKmPerL);
  $("statCost").textContent = fmtBDT(sum.totalCost);

  const rows = computeEntries(state.entries).reverse(); // newest-first for display
  $("entryList").innerHTML = rows.map(renderRow).join("");
  $("emptyState").classList.toggle("hidden", rows.length > 0);

  renderTrips();
  renderReminders();
  renderService();
  populateTripSelectors();
}

// Fuel + service entries assigned to a trip, reduced to { odometer, cost }.
function tripItems(tripId) {
  return [...state.entries, ...state.services]
    .filter((e) => e.trip_id === tripId)
    .map((e) => ({ odometer: e.odometer, cost: e.cost }));
}

function renderTrips() {
  $("tripEmpty").classList.toggle("hidden", state.trips.length > 0);
  $("tripList").innerHTML = state.trips
    .map((t) => {
      const sum = tripSummary(tripItems(t.id));
      return `<li class="rounded-xl bg-surface p-3 flex justify-between items-center gap-3 cursor-pointer" data-action="open-trip" data-id="${t.id}">
        <div class="min-w-0">
          <div class="font-semibold truncate">${escapeHtml(t.name)}</div>
          <div class="text-xs text-muted">${CATEGORY_LABEL[t.category] || t.category} · ${sum.count} entries</div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-bold tabular-nums">${fmtBDT(sum.totalCost)}</div>
          <div class="text-xs text-muted tabular-nums">${fmtKm(sum.distance)}</div>
        </div>
      </li>`;
    })
    .join("");
}

function populateTripSelectors() {
  const opts =
    '<option value="">— No trip —</option>' +
    state.trips.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  $("f_trip").innerHTML = opts;
  $("s_trip").innerHTML = opts;
}

// ---------- reports ----------

function showReports() {
  $("appView").classList.add("hidden");
  $("reportsView").classList.remove("hidden");
  renderReports();
}
function showHome() {
  $("reportsView").classList.add("hidden");
  $("appView").classList.remove("hidden");
}

function statTile(value, label) {
  return `<div class="rounded-xl bg-surface p-3 text-center">
    <div class="text-lg font-bold tabular-nums">${value}</div>
    <div class="text-xs text-muted">${label}</div>
  </div>`;
}

function renderReports() {
  const { from, to } = presetRange(state.reportsRange, new Date());
  const fuel = filterByDateRange(state.entries, from, to);
  const service = filterByDateRange(state.services, from, to);

  document
    .querySelectorAll("#reportsFilter .range-pill")
    .forEach((b) => b.classList.toggle("active", b.dataset.range === state.reportsRange));

  const sum = summarize(fuel);
  const serviceCost = service.reduce((s, e) => s + (e.cost || 0), 0);
  $("reportSummary").innerHTML =
    statTile(fmtKm(sum.totalDistance), "distance") +
    statTile(fmtBDT(sum.totalCost + serviceCost), "total spend") +
    statTile(fmtKmPerL(sum.avgKmPerL), "avg km/L") +
    statTile(String(fuel.length), "fill-ups");

  $("spendChart").innerHTML = renderSpendChart(monthlySpend(fuel, service));

  const eco = computeEntries(fuel)
    .map((e) => e.kmPerL)
    .filter((v) => v != null);
  $("economyChart").innerHTML = renderEconomyChart(eco);

  computeCalc();
}

function renderSpendChart(spend) {
  if (!spend.length) return '<p class="text-muted text-sm">No spending in this period.</p>';
  const W = 320;
  const H = 120;
  const bars = barGeometry(
    spend.map((s) => s.total),
    { width: W, height: H, gap: 6 }
  );
  const rects = bars
    .map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="#3b82f6"></rect>`)
    .join("");
  const labels = spend
    .map(
      (s, i) =>
        `<text x="${bars[i].x + bars[i].w / 2}" y="${H + 13}" font-size="9" fill="#98a2c8" text-anchor="middle">${s.month.slice(5)}</text>`
    )
    .join("");
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="w-full">${rects}${labels}</svg>`;
}

function renderEconomyChart(values) {
  if (values.length < 2) return '<p class="text-muted text-sm">Not enough fill-ups yet.</p>';
  const W = 320;
  const H = 100;
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full"><polyline points="${linePoints(values, {
    width: W,
    height: H,
  })}" fill="none" stroke="#22c55e" stroke-width="2" /></svg>`;
}

function computeCalc() {
  const distance = Number($("calc_distance").value);
  const price = Number($("calc_price").value);
  const { from, to } = presetRange(state.reportsRange, new Date());
  const kmPerL = summarize(filterByDateRange(state.entries, from, to)).avgKmPerL;

  if (!distance || !price) {
    $("calc_result").textContent = "—";
    $("calc_note").textContent = "";
    return;
  }
  if (!kmPerL) {
    $("calc_result").textContent = "—";
    $("calc_note").textContent = "log more fill-ups for an economy estimate";
    return;
  }
  $("calc_result").textContent = fmtBDT(tripCostEstimate({ distance, kmPerL, pricePerL: price }));
  $("calc_note").textContent = `at ${fmtKmPerL(kmPerL)}`;
}

function renderReminders() {
  const odo = currentOdometer();
  const today = dhakaToday(new Date());
  $("reminderEmpty").classList.toggle("hidden", state.reminders.length > 0);
  $("reminderList").innerHTML = state.reminders
    .map((r) => {
      const st = reminderStatus(r, { odometer: odo, date: today });
      const detail = [];
      if (st.remainingKm != null)
        detail.push(st.remainingKm < 0 ? `${fmtKm(-st.remainingKm)} over` : `${fmtKm(st.remainingKm)} left`);
      if (st.remainingDays != null)
        detail.push(st.remainingDays < 0 ? `${-st.remainingDays}d over` : `${st.remainingDays}d left`);
      return `<li class="rounded-xl bg-surface p-3 flex justify-between items-center gap-3">
        <div class="min-w-0">
          <div class="font-semibold truncate">${escapeHtml(r.type)}</div>
          <div class="text-xs text-muted">${detail.join(" · ") || "no interval set"}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="badge ${st.status}">${REMINDER_LABEL[st.status]}</span>
          <button class="text-xs text-danger" data-action="del-reminder" data-id="${r.id}" aria-label="Delete reminder">✕</button>
        </div>
      </li>`;
    })
    .join("");
}

function renderService() {
  const rows = [...state.services].reverse(); // newest-first
  $("serviceEmpty").classList.toggle("hidden", rows.length > 0);
  $("serviceList").innerHTML = rows
    .map(
      (s) => `<li class="rounded-xl bg-surface p-3 flex justify-between items-start gap-3">
      <div class="min-w-0">
        <div class="font-semibold truncate">${escapeHtml(s.type)}</div>
        <div class="text-xs text-muted">${s.date} · ${fmtKm(s.odometer)}${
        s.location ? " · " + escapeHtml(s.location) : ""
      }${
        s.receipt_key
          ? ` · <a href="/api/receipts/${s.receipt_key}" target="_blank" rel="noopener">📎</a>`
          : ""
      }</div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-bold tabular-nums">${s.cost ? fmtBDT(s.cost) : "—"}</div>
        <button class="text-xs text-danger mt-1" data-action="del-service" data-id="${s.id}">Delete</button>
      </div>
    </li>`
    )
    .join("");
}

function renderRow(e) {
  const sub = [fmtKmPerL(e.kmPerL), e.tripDistance != null ? fmtKm(e.tripDistance) + " trip" : null]
    .filter(Boolean)
    .join(" · ");
  return `<li class="rounded-xl bg-surface p-3 flex justify-between items-start gap-3" data-id="${e.id}">
    <div class="min-w-0">
      <div class="font-semibold truncate">${escapeHtml(e.location || "Fill-up")}</div>
      <div class="text-xs text-muted">${e.date} · ${fmtKm(e.odometer)}${e.is_full ? "" : " · partial"}${
    e.receipt_key
      ? ` · <a href="/api/receipts/${e.receipt_key}" target="_blank" rel="noopener">📎</a>`
      : ""
  }</div>
    </div>
    <div class="text-right shrink-0">
      <div class="font-bold tabular-nums">${fmtBDT(e.cost)}</div>
      <div class="text-xs text-muted tabular-nums">${sub}</div>
      <button class="text-xs text-danger mt-1" data-action="delete" data-id="${e.id}">Delete</button>
    </div>
  </li>`;
}

// ---------- actions ----------

function openFuelDialog() {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  $("fuelForm").reset();
  $("f_date").value = dhakaToday(new Date());
  $("f_isFull").checked = true;
  $("fuelDialog").showModal();
}

async function submitFuel() {
  const body = {
    vehicleId: state.activeVehicleId,
    date: $("f_date").value,
    odometer: Number($("f_odometer").value),
    volume: Number($("f_volume").value),
    cost: Number($("f_cost").value),
    isFull: $("f_isFull").checked,
    location: $("f_location").value.trim() || undefined,
    tripId: $("f_trip").value ? Number($("f_trip").value) : undefined,
  };
  const file = $("f_receipt").files[0];
  if (file) {
    const key = await uploadReceipt(file);
    if (!key) {
      toast("Could not upload receipt");
      return;
    }
    body.receiptKey = key;
  }
  const res = await api("/fuel", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    toast("Could not save fill-up");
    return;
  }
  $("fuelDialog").close();
  await loadVehicleData();
  toast("Fill-up saved");
}

async function submitVehicle() {
  const body = {
    name: $("v_name").value.trim(),
    make: $("v_make").value.trim() || undefined,
    model: $("v_model").value.trim() || undefined,
    year: $("v_year").value ? Number($("v_year").value) : undefined,
    initialOdometer: $("v_odometer").value ? Number($("v_odometer").value) : undefined,
  };
  if (!body.name) {
    toast("Name is required");
    return;
  }
  const res = await api("/vehicles", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    toast("Could not add vehicle");
    return;
  }
  const { vehicle } = await res.json();
  localStorage.setItem(ACTIVE_VEHICLE, String(vehicle.id));
  $("vehicleDialog").close();
  await loadVehicles();
  toast("Vehicle added");
}

async function deleteEntry(id) {
  const res = await api(`/fuel/${id}`, { method: "DELETE" });
  if (!res.ok) {
    toast("Could not delete");
    return;
  }
  await loadVehicleData();
}

function openServiceDialog() {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  $("serviceForm").reset();
  $("s_date").value = dhakaToday(new Date());
  $("serviceDialog").showModal();
}

async function submitService() {
  const body = {
    vehicleId: state.activeVehicleId,
    date: $("s_date").value,
    odometer: Number($("s_odometer").value),
    type: $("s_type").value.trim(),
    cost: $("s_cost").value ? Number($("s_cost").value) : 0,
    location: $("s_location").value.trim() || undefined,
    notes: $("s_notes").value.trim() || undefined,
    tripId: $("s_trip").value ? Number($("s_trip").value) : undefined,
  };
  const file = $("s_receipt").files[0];
  if (file) {
    const key = await uploadReceipt(file);
    if (!key) {
      toast("Could not upload receipt");
      return;
    }
    body.receiptKey = key;
  }
  const res = await api("/service", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    toast("Could not save service");
    return;
  }
  $("serviceDialog").close();
  await loadVehicleData();
  toast("Service saved");
}

function openReminderDialog() {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  $("reminderForm").reset();
  $("reminderDialog").showModal();
}

async function submitReminder() {
  const num = (id) => ($(id).value ? Number($(id).value) : undefined);
  const body = {
    vehicleId: state.activeVehicleId,
    type: $("r_type").value.trim(),
    intervalKm: num("r_intervalKm"),
    intervalDays: num("r_intervalDays"),
    lastDoneOdometer: num("r_lastOdo"),
    lastDoneDate: $("r_lastDate").value || undefined,
  };
  if (!body.type) {
    toast("Type is required");
    return;
  }
  const res = await api("/reminders", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    toast("Could not save reminder");
    return;
  }
  $("reminderDialog").close();
  await loadVehicleData();
  toast("Reminder added");
}

async function deleteService(id) {
  const res = await api(`/service/${id}`, { method: "DELETE" });
  if (res.ok) await loadVehicleData();
  else toast("Could not delete");
}

async function deleteReminder(id) {
  const res = await api(`/reminders/${id}`, { method: "DELETE" });
  if (res.ok) await loadVehicleData();
  else toast("Could not delete");
}

function openTripDialog() {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  $("tripForm").reset();
  $("tripDialog").showModal();
}

async function submitTrip() {
  const body = {
    vehicleId: state.activeVehicleId,
    name: $("t_name").value.trim(),
    category: $("t_category").value,
    startDate: $("t_start").value || undefined,
    endDate: $("t_end").value || undefined,
  };
  if (!body.name) {
    toast("Name is required");
    return;
  }
  const res = await api("/trips", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    toast("Could not save trip");
    return;
  }
  $("tripDialog").close();
  await loadVehicleData();
  toast("Trip added");
}

async function deleteTrip(id) {
  const res = await api(`/trips/${id}`, { method: "DELETE" });
  if (res.ok) {
    $("tripDetailDialog").close();
    await loadVehicleData();
  } else toast("Could not delete");
}

function openTripDetail(id) {
  const trip = state.trips.find((t) => t.id === id);
  if (!trip) return;
  const fuel = state.entries.filter((e) => e.trip_id === id);
  const service = state.services.filter((e) => e.trip_id === id);
  const sum = tripSummary(tripItems(id));

  const rows = (arr, label) =>
    arr
      .map(
        (e) => `<div class="flex justify-between text-sm py-1 border-t border-border">
        <span class="truncate">${escapeHtml(label(e))} <span class="text-muted">${e.date}</span></span>
        <span class="tabular-nums shrink-0">${fmtBDT(e.cost)}</span>
      </div>`
      )
      .join("");

  $("td_title").textContent = trip.name;
  $("td_body").innerHTML = `
    <div class="text-sm text-muted mb-1">${CATEGORY_LABEL[trip.category] || trip.category} · ${fmtKm(
    sum.distance
  )} · ${fmtBDT(sum.totalCost)}</div>
    ${fuel.length ? `<div class="text-xs uppercase text-muted mt-3">Fuel</div>${rows(fuel, (e) => e.location || "Fill-up")}` : ""}
    ${service.length ? `<div class="text-xs uppercase text-muted mt-3">Service</div>${rows(service, (e) => e.type)}` : ""}
    ${!fuel.length && !service.length ? '<div class="text-muted text-sm mt-2">No entries assigned yet. Pick this trip when logging fuel or service.</div>' : ""}
    <button id="td_delete" data-id="${id}" class="text-danger text-sm mt-4">Delete trip</button>
  `;
  $("tripDetailDialog").showModal();
}

function exportCsv() {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  window.location.href = `${API}/export?vehicleId=${state.activeVehicleId}`;
}

async function importCsv(file) {
  if (!state.activeVehicleId) {
    toast("Add a vehicle first");
    return;
  }
  const text = await file.text();
  const res = await fetch(`${API}/import?vehicleId=${state.activeVehicleId}`, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: text,
  });
  if (!res.ok) {
    toast("Could not import CSV");
    return;
  }
  const { imported, skipped } = await res.json();
  await loadVehicleData();
  toast(`Imported ${imported}, skipped ${skipped}`);
}

async function logout() {
  await api("/auth/logout", { method: "POST" });
  location.reload();
}

// ---------- wiring ----------

function wire() {
  $("addFuelBtn").addEventListener("click", openFuelDialog);
  $("fuelSave").addEventListener("click", (e) => {
    if (!$("fuelForm").reportValidity()) return;
    e.preventDefault();
    submitFuel();
  });
  $("addVehicleBtn").addEventListener("click", () => {
    $("vehicleForm").reset();
    $("vehicleDialog").showModal();
  });
  $("vehicleSave").addEventListener("click", (e) => {
    if (!$("vehicleForm").reportValidity()) return;
    e.preventDefault();
    submitVehicle();
  });
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close())
  );
  $("vehicleSelect").addEventListener("change", (e) => {
    state.activeVehicleId = Number(e.target.value);
    localStorage.setItem(ACTIVE_VEHICLE, String(state.activeVehicleId));
    loadVehicleData();
  });
  $("addServiceBtn").addEventListener("click", openServiceDialog);
  $("serviceSave").addEventListener("click", (e) => {
    if (!$("serviceForm").reportValidity()) return;
    e.preventDefault();
    submitService();
  });
  $("addReminderBtn").addEventListener("click", openReminderDialog);
  $("reminderSave").addEventListener("click", (e) => {
    if (!$("reminderForm").reportValidity()) return;
    e.preventDefault();
    submitReminder();
  });
  $("addTripBtn").addEventListener("click", openTripDialog);
  $("tripSave").addEventListener("click", (e) => {
    if (!$("tripForm").reportValidity()) return;
    e.preventDefault();
    submitTrip();
  });
  $("logoutBtn").addEventListener("click", logout);
  $("entryList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='delete']");
    if (btn) deleteEntry(Number(btn.dataset.id));
  });
  $("serviceList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='del-service']");
    if (btn) deleteService(Number(btn.dataset.id));
  });
  $("reminderList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='del-reminder']");
    if (btn) deleteReminder(Number(btn.dataset.id));
  });
  $("tripList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='open-trip']");
    if (btn) openTripDetail(Number(btn.dataset.id));
  });
  $("tripDetailDialog").addEventListener("click", (e) => {
    const btn = e.target.closest("#td_delete");
    if (btn) deleteTrip(Number(btn.dataset.id));
  });
  $("reportsBtn").addEventListener("click", showReports);
  $("reportsBack").addEventListener("click", showHome);
  $("reportsFilter").addEventListener("click", (e) => {
    const btn = e.target.closest(".range-pill");
    if (!btn) return;
    state.reportsRange = btn.dataset.range;
    renderReports();
  });
  $("calc_distance").addEventListener("input", computeCalc);
  $("calc_price").addEventListener("input", computeCalc);
  $("exportBtn").addEventListener("click", exportCsv);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importCsv(file);
    e.target.value = "";
  });
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

// ---------- init ----------

async function init() {
  const meRes = await api("/me");
  if (meRes.status === 401) {
    showLogin();
    return;
  }
  if (!meRes.ok) {
    showLogin();
    return;
  }
  state.user = await meRes.json();
  showApp();
  wire();
  await loadVehicles();
  registerSW();
}

init();
