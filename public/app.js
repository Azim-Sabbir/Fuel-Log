import { computeEntries, summarize } from "/lib/economy.js";
import { fmtBDT, fmtKm, fmtKmPerL } from "/lib/format.js";
import { dhakaToday } from "/lib/ranges.js";

const API = "/api";
const ACTIVE_VEHICLE = "fuellog.activeVehicle";

const state = { user: null, vehicles: [], activeVehicleId: null, entries: [] };

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
    await loadEntries();
  } else {
    state.entries = [];
    renderNoVehicle();
  }
}

async function loadEntries() {
  const res = await api(`/fuel?vehicleId=${state.activeVehicleId}`);
  if (!res.ok) {
    state.entries = [];
    render();
    return;
  }
  const { entries } = await res.json();
  state.entries = entries; // oldest-first
  render();
}

// ---------- render ----------

function renderNoVehicle() {
  $("statDistance").textContent = "—";
  $("statEconomy").textContent = "—";
  $("statCost").textContent = "—";
  $("entryList").innerHTML = "";
  $("emptyState").classList.add("hidden");
  $("noVehicle").classList.remove("hidden");
}

function render() {
  $("noVehicle").classList.add("hidden");

  const sum = summarize(state.entries);
  $("statDistance").textContent = fmtKm(sum.totalDistance);
  $("statEconomy").textContent = fmtKmPerL(sum.avgKmPerL);
  $("statCost").textContent = fmtBDT(sum.totalCost);

  const rows = computeEntries(state.entries).reverse(); // newest-first for display
  const list = $("entryList");
  if (rows.length === 0) {
    list.innerHTML = "";
    $("emptyState").classList.remove("hidden");
    return;
  }
  $("emptyState").classList.add("hidden");
  list.innerHTML = rows.map(renderRow).join("");
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
  await loadEntries();
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
  await loadEntries();
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
    loadEntries();
  });
  $("logoutBtn").addEventListener("click", logout);
  $("entryList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='delete']");
    if (btn) deleteEntry(Number(btn.dataset.id));
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
