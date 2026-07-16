import { computeEntries, summarize } from "/lib/economy.js";
import { fmtBDT, fmtKm, fmtKmPerL } from "/lib/format.js";
import { dhakaToday } from "/lib/ranges.js";
import { reminderStatus } from "/lib/reminders.js";

const API = "/api";
const ACTIVE_VEHICLE = "fuellog.activeVehicle";

const state = {
  user: null,
  vehicles: [],
  activeVehicleId: null,
  entries: [],
  services: [],
  reminders: [],
};

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
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
  const [entries, services, reminders] = await Promise.all([
    jsonOr(`/fuel?vehicleId=${id}`, "entries"),
    jsonOr(`/service?vehicleId=${id}`, "entries"),
    jsonOr(`/reminders?vehicleId=${id}`, "reminders"),
  ]);
  state.entries = entries; // oldest-first
  state.services = services; // oldest-first
  state.reminders = reminders;
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

const SECTIONS = ["stats", "fuelSection", "reminderSection", "serviceSection"];
const REMINDER_LABEL = { ok: "OK", due_soon: "Due soon", overdue: "Overdue" };

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

  renderReminders();
  renderService();
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
      <div class="text-xs text-muted">${e.date} · ${fmtKm(e.odometer)}${e.is_full ? "" : " · partial"}</div>
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
  };
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
  };
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
