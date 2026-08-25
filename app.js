const DAILY_STORAGE_KEY = "driver-ledger-records-v1";
const EXPENSE_STORAGE_KEY = "driver-ledger-expenses-v1";
const SETTINGS_KEY = "driver-ledger-settings-v1";
const DAY_DRAFT_KEY = "driver-ledger-day-draft-v1";
const AUTH_STORAGE_KEY = "driver-ledger-supabase-session-v1";
const SUPABASE_URL = "https://pzntppeunrpxerbxjdma.supabase.co";
const SUPABASE_KEY = "sb_publishable__CY24ExhmFkJD-uqO5FEbg_YD4TFYO3";

const expenseCategories = {
  fuel: ["Fuel", "#176b5b"],
  insurance: ["Insurance", "#7b4bb2"],
  carPayment: ["Car payment or lease", "#9b3d2e"],
  oil: ["Oil change", "#a66800"],
  maintenance: ["Maintenance or repair", "#245e9c"],
  parkingTolls: ["Parking or tolls", "#587042"],
  etr407: ["ETR 407", "#7d6227"],
  parking: ["Parking", "#4f7b45"],
  phoneData: ["Phone and data", "#2f6f86"],
  cleaning: ["Cleaning", "#b05f2b"],
  washingCar: ["Washing car", "#9a6a2f"],
  other: ["Other", "#617084"],
};

const dayForm = document.querySelector("#dayForm");
const expenseForm = document.querySelector("#expenseForm");
const recordsTable = document.querySelector("#recordsTable");
const emptyState = document.querySelector("#emptyState");
const periodSelect = document.querySelector("#periodSelect");
const referenceDate = document.querySelector("#referenceDate");
const rangeStartDate = document.querySelector("#rangeStartDate");
const rangeEndDate = document.querySelector("#rangeEndDate");
const customRangeFields = document.querySelectorAll(".custom-range-field");
const currencyInput = document.querySelector("#currencyInput");
const searchInput = document.querySelector("#searchInput");
const exportButton = document.querySelector("#exportButton");
const clearButton = document.querySelector("#clearButton");
const seedDemoButton = document.querySelector("#seedDemoButton");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authStatus = document.querySelector("#authStatus");
const cloudStatus = document.querySelector("#cloudStatus");
const signUpButton = document.querySelector("#signUpButton");
const signOutButton = document.querySelector("#signOutButton");
const syncButton = document.querySelector("#syncButton");
const cancelDayEditButton = document.querySelector("#cancelDayEditButton");
const cancelExpenseEditButton = document.querySelector("#cancelExpenseEditButton");
const dayFormTitle = document.querySelector("#dayFormTitle");
const expenseFormTitle = document.querySelector("#expenseFormTitle");
const dailyKmHint = document.querySelector("#dailyKmHint");
const dailyGrossPreview = document.querySelector("#dailyGrossPreview");
const daySaveStatus = document.querySelector("#daySaveStatus");
const frequencyHelp = document.querySelector("#frequencyHelp");
const platformList = document.querySelector("#platformList");

const commonPlatforms = ["Uber", "Lyft"];

const categoryDefaults = {
  insurance: "monthly",
  carPayment: "monthly",
  phoneData: "monthly",
  oil: "one-time",
  maintenance: "one-time",
  parkingTolls: "one-time",
  etr407: "one-time",
  parking: "one-time",
  cleaning: "one-time",
  washingCar: "one-time",
  other: "one-time",
};

const storedDailyRecords = loadList(DAILY_STORAGE_KEY);
let dailyRecords = consolidateDailyRecords(storedDailyRecords.map(normalizeDailyRecord));
let expenses = [...legacyExpensesFromDailyRecords(storedDailyRecords), ...loadList(EXPENSE_STORAGE_KEY).map(normalizeExpense)];
let editingDayId = null;
let editingExpenseId = null;
let session = loadSession();

const moneyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    return saved?.access_token && saved?.user ? saved : null;
  } catch {
    return null;
  }
}

function getAuthParamsFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  return {
    accessToken: hash.get("access_token") || search.get("access_token"),
    refreshToken: hash.get("refresh_token") || search.get("refresh_token"),
    error: hash.get("error_description") || search.get("error_description") || hash.get("error") || search.get("error"),
  };
}

function saveSession(nextSession) {
  session = nextSession;
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  renderAuth();
}

function loadDayDraft() {
  try {
    return JSON.parse(localStorage.getItem(DAY_DRAFT_KEY));
  } catch {
    return null;
  }
}

function saveAll() {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(dailyRecords));
  localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
}

function cloudHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function cloudRequest(path, options = {}) {
  if (!session) throw new Error("Sign in first.");
  let response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: cloudHeaders(options.headers || {}),
  });
  if (response.status === 401 && session.refresh_token) {
    await refreshSession();
    response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: cloudHeaders(options.headers || {}),
    });
  }
  if (!response.ok) {
    const message = await response.text();
    if (message.includes("JWT expired") && !session.refresh_token) {
      saveSession(null);
      throw new Error("Login expired. Please sign in again.");
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function authRequest(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).finally(() => clearTimeout(timeout));
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_description || result.msg || result.message || "Authentication failed.");
  return result;
}

async function refreshSession() {
  if (!session?.refresh_token) throw new Error("Login expired. Please sign in again.");
  const result = await authRequest("/auth/v1/token?grant_type=refresh_token", {
    refresh_token: session.refresh_token,
  });
  saveSession(sessionFromAuthResult(result));
}

function sessionFromAuthResult(result) {
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: result.expires_at,
    user: result.user,
  };
}

async function loadUserFromToken(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || "Could not load confirmed user.");
  return result;
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      period: periodSelect.value,
      referenceDate: referenceDate.value,
      rangeStartDate: rangeStartDate.value,
      rangeEndDate: rangeEndDate.value,
      currency: currencyInput.value || "$",
    }),
  );
}

function saveDayDraft() {
  const draft = {
    date: dayForm.elements.date.value,
    hours: numeric(dayForm.elements.hours.value),
    odometerStart: numeric(dayForm.elements.odometerStart.value),
    odometerEnd: numeric(dayForm.elements.odometerEnd.value),
    fuel: numeric(dayForm.elements.fuel.value),
    notes: dayForm.elements.notes.value || "",
    platforms: readPlatformRows(),
  };
  localStorage.setItem(DAY_DRAFT_KEY, JSON.stringify(draft));
  daySaveStatus.textContent = draftHasUsefulData(draft) ? "Draft saved automatically." : "";
}

function clearDayDraft() {
  localStorage.removeItem(DAY_DRAFT_KEY);
}

function draftHasUsefulData(draft) {
  return Boolean(
    draft &&
      (draft.hours ||
        draft.odometerStart ||
        draft.odometerEnd ||
        draft.fuel ||
        draft.notes ||
        draft.platforms?.some((platform) => numeric(platform.amount) > 0 || numeric(platform.trips) > 0)),
  );
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currency(value) {
  return `${currencyInput.value || "$"}${moneyFormatter.format(value)}`;
}

function rate(value, suffix = "") {
  return `${currency(Number.isFinite(value) ? value : 0)}${suffix}`;
}

function dateFromISO(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function daysBetween(start, end) {
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

function getPeriodRange() {
  const reference = dateFromISO(referenceDate.value || todayISO());
  if (periodSelect.value === "day") return [reference, reference];
  if (periodSelect.value === "week") return [startOfWeek(reference), endOfWeek(reference)];
  if (periodSelect.value === "month") return [startOfMonth(reference), endOfMonth(reference)];
  if (periodSelect.value === "year") return [startOfYear(reference), endOfYear(reference)];
  if (periodSelect.value === "custom") {
    const first = dateFromISO(rangeStartDate.value || referenceDate.value || todayISO());
    const second = dateFromISO(rangeEndDate.value || rangeStartDate.value || referenceDate.value || todayISO());
    const start = first <= second ? first : second;
    const end = first <= second ? second : first;
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }
  return [new Date(0), new Date(8640000000000000)];
}

function normalizePlatforms(record) {
  if (Array.isArray(record.platforms)) {
    return record.platforms
      .map((platform) => ({
        name: String(platform.name || "").trim(),
        amount: numeric(platform.amount),
        trips: numeric(platform.trips),
      }))
      .filter((platform) => platform.name || platform.amount > 0 || platform.trips > 0);
  }

  const legacyPlatforms = [
    ["Uber", record.uberIncome],
    ["Lyft", record.lyftIncome],
    ["HOVR", record.hovrIncome],
    ["Hoop", record.hoopIncome || record.hopeIncome],
    ["Other", record.otherIncome],
  ]
    .map(([name, amount]) => ({ name, amount: numeric(amount), trips: 0 }))
    .filter((platform) => platform.amount > 0);

  if (legacyPlatforms.length) return legacyPlatforms;

  const legacyGross = numeric(record.gross);
  const legacyTrips = numeric(record.trips);
  return legacyGross > 0 || legacyTrips > 0 ? [{ name: "Uber", amount: legacyGross, trips: legacyTrips }] : [];
}

function platformTotal(platforms) {
  return platforms.reduce((sum, platform) => sum + numeric(platform.amount), 0);
}

function platformTripTotal(platforms) {
  return platforms.reduce((sum, platform) => sum + numeric(platform.trips), 0);
}

function platformSummary(platforms) {
  return platforms
    .filter((platform) => platform.name || numeric(platform.amount) > 0 || numeric(platform.trips) > 0)
    .map((platform) => `${platform.name || "App"}: ${currency(numeric(platform.amount))}, ${numeric(platform.trips)} trips`)
    .join(", ");
}

function normalizeDailyRecord(record) {
  const platforms = normalizePlatforms(record);
  const gross = platformTotal(platforms);
  return {
    id: record.id || makeId(),
    type: "day",
    date: record.date || todayISO(),
    gross,
    platforms,
    uberIncome: platforms.filter((platform) => platform.name.toLowerCase() === "uber").reduce((sum, platform) => sum + platform.amount, 0),
    lyftIncome: platforms.filter((platform) => platform.name.toLowerCase() === "lyft").reduce((sum, platform) => sum + platform.amount, 0),
    hovrIncome: platforms.filter((platform) => platform.name.toLowerCase() === "hovr").reduce((sum, platform) => sum + platform.amount, 0),
    hoopIncome: platforms.filter((platform) => ["hoop", "hope"].includes(platform.name.toLowerCase())).reduce((sum, platform) => sum + platform.amount, 0),
    hopeIncome: platforms.filter((platform) => ["hoop", "hope"].includes(platform.name.toLowerCase())).reduce((sum, platform) => sum + platform.amount, 0),
    otherIncome: platforms
      .filter((platform) => !["uber", "lyft", "hovr", "hoop", "hope"].includes(platform.name.toLowerCase()))
      .reduce((sum, platform) => sum + platform.amount, 0),
    trips: platformTripTotal(platforms),
    hours: numeric(record.hours),
    odometerStart: numeric(record.odometerStart),
    odometerEnd: numeric(record.odometerEnd),
    fuel: numeric(record.fuel),
    notes: record.notes || "",
  };
}

function mergePlatformRows(existingPlatforms, newPlatforms) {
  const byName = new Map(existingPlatforms.map((platform) => [platform.name.toLowerCase(), { ...platform }]));
  newPlatforms.forEach((platform) => {
    const key = platform.name.toLowerCase();
    if (!key) return;
    const current = byName.get(key) || { name: platform.name, amount: 0, trips: 0 };
    byName.set(key, {
      name: current.name || platform.name,
      amount: numeric(platform.amount) > 0 ? numeric(platform.amount) : numeric(current.amount),
      trips: numeric(platform.trips) > 0 ? numeric(platform.trips) : numeric(current.trips),
    });
  });
  return [...byName.values()].filter((platform) => numeric(platform.amount) > 0 || numeric(platform.trips) > 0);
}

function mergeDailyRecord(existingRecord, newRecord) {
  const notes = [existingRecord.notes, newRecord.notes]
    .map((note) => String(note || "").trim())
    .filter(Boolean);
  return normalizeDailyRecord({
    ...existingRecord,
    platforms: mergePlatformRows(existingRecord.platforms || [], newRecord.platforms || []),
    hours: numeric(newRecord.hours) > 0 ? newRecord.hours : existingRecord.hours,
    odometerStart: numeric(newRecord.odometerStart) > 0 ? newRecord.odometerStart : existingRecord.odometerStart,
    odometerEnd: numeric(newRecord.odometerEnd) > 0 ? newRecord.odometerEnd : existingRecord.odometerEnd,
    fuel: numeric(existingRecord.fuel) + numeric(newRecord.fuel),
    notes: [...new Set(notes)].join(" | "),
  });
}

function consolidateDailyRecords(records) {
  return records.reduce((mergedRecords, record) => {
    const existingIndex = mergedRecords.findIndex((item) => item.date === record.date);
    if (existingIndex === -1) return [...mergedRecords, record];
    return mergedRecords.map((item, index) => (index === existingIndex ? mergeDailyRecord(item, record) : item));
  }, []);
}

function normalizeExpense(expense) {
  if (expense.type === "expense") {
    return {
      id: expense.id || makeId(),
      type: "expense",
      date: expense.date || todayISO(),
      category: expense.category || "other",
      amount: numeric(expense.amount),
      frequency: expense.frequency || "one-time",
      notes: expense.notes || "",
    };
  }

  const converted = [];
  Object.keys(expenseCategories).forEach((category) => {
    if (category === "fuel") return;
    const amount = numeric(expense[category]);
    if (amount > 0) {
      converted.push({
        id: makeId(),
        type: "expense",
        date: expense.date || todayISO(),
        category,
        amount,
        frequency: "one-time",
        notes: expense.notes || "",
      });
    }
  });
  return converted[0] || {
    id: expense.id || makeId(),
    type: "expense",
    date: expense.date || todayISO(),
    category: "other",
    amount: 0,
    frequency: "one-time",
    notes: expense.notes || "",
  };
}

function dailyFromCloud(row) {
  return normalizeDailyRecord({
    id: row.id,
    date: row.work_date,
    hours: row.hours_worked,
    odometerStart: row.odometer_start,
    odometerEnd: row.odometer_end,
    fuel: row.fuel_cost,
    notes: row.notes,
    platforms: (row.platform_earnings || []).map((platform) => ({
      name: platform.platform_name,
      amount: platform.gross_income,
      trips: platform.trips,
    })),
  });
}

function expenseFromCloud(row) {
  return normalizeExpense({
    id: row.id,
    type: "expense",
    date: row.expense_date,
    category: row.category,
    amount: row.amount,
    frequency: row.frequency,
    notes: row.notes,
  });
}

function dailyToCloud(record) {
  return {
    id: record.id,
    user_id: session.user.id,
    work_date: record.date,
    hours_worked: record.hours,
    odometer_start: record.odometerStart,
    odometer_end: record.odometerEnd,
    fuel_cost: record.fuel,
    notes: record.notes || "",
  };
}

function expenseToCloud(expense) {
  return {
    id: expense.id,
    user_id: session.user.id,
    expense_date: expense.date,
    category: expense.category,
    amount: expense.amount,
    frequency: expense.frequency,
    notes: expense.notes || "",
  };
}

function legacyExpensesFromDailyRecords(records) {
  if (loadList(EXPENSE_STORAGE_KEY).length) return [];
  return records.flatMap((record) =>
    Object.keys(expenseCategories)
      .filter((category) => category !== "fuel" && numeric(record[category]) > 0)
      .map((category) =>
        normalizeExpense({
          type: "expense",
          date: record.date || todayISO(),
          category,
          amount: record[category],
          frequency: "one-time",
          notes: record.notes || "Moved from older daily entry",
        }),
      ),
  );
}

function businessKm(record) {
  return Math.max(0, numeric(record.odometerEnd) - numeric(record.odometerStart));
}

function recordInPeriod(record) {
  const [start, end] = getPeriodRange();
  const date = dateFromISO(record.date);
  return date >= start && date <= end;
}

function recurringExpenseAmount(expense) {
  const [start, end] = getPeriodRange();
  if (expense.frequency === "one-time") return recordInPeriod(expense) ? expense.amount : 0;
  if (periodSelect.value === "all") return expense.amount;

  const periodDays = daysBetween(start, end);
  const dailyAmount = expense.frequency === "yearly" ? expense.amount / 365 : expense.amount / 30.4375;
  return dailyAmount * periodDays;
}

function periodText() {
  const date = dateFromISO(referenceDate.value || todayISO());
  if (periodSelect.value === "day") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  if (periodSelect.value === "week") {
    const start = startOfWeek(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const end = endOfWeek(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${start} to ${end}`;
  }
  if (periodSelect.value === "month") {
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (periodSelect.value === "year") {
    return date.toLocaleDateString(undefined, { year: "numeric" });
  }
  if (periodSelect.value === "custom") {
    const [start, end] = getPeriodRange();
    const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endText = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${startText} to ${endText}`;
  }
  return "All saved records";
}

function selectedSummary() {
  const selectedDays = dailyRecords.filter(recordInPeriod);
  const summary = {
    gross: 0,
    dailyExpenses: 0,
    fixedExpenses: 0,
    km: 0,
    hours: 0,
    trips: 0,
    dayCount: selectedDays.length,
    platformBreakdown: {},
    expenseBreakdown: Object.fromEntries(Object.keys(expenseCategories).map((key) => [key, 0])),
  };

  selectedDays.forEach((record) => {
    const km = businessKm(record);
    summary.gross += numeric(record.gross);
    summary.dailyExpenses += numeric(record.fuel);
    summary.km += km;
    summary.hours += numeric(record.hours);
    summary.trips += numeric(record.trips);
    summary.expenseBreakdown.fuel += numeric(record.fuel);
    record.platforms.forEach((platform) => {
      const name = platform.name || "App";
      summary.platformBreakdown[name] = (summary.platformBreakdown[name] || 0) + numeric(platform.amount);
    });
  });

  expenses.forEach((expense) => {
    const amount = recurringExpenseAmount(expense);
    summary.fixedExpenses += amount;
    summary.expenseBreakdown[expense.category] += amount;
  });

  summary.expenses = summary.dailyExpenses + summary.fixedExpenses;
  summary.net = summary.gross - summary.expenses;
  return summary;
}

function setText(id, text) {
  document.querySelector(id).textContent = text;
}

function renderAuth() {
  const signedIn = Boolean(session?.user);
  authStatus.textContent = signedIn ? `Cloud sync: ${session.user.email}` : "Cloud sync: signed out";
  cloudStatus.textContent = signedIn
    ? "Records save to Supabase and can be loaded from another device."
    : "Records are saved in this browser until you sign in.";
  signOutButton.classList.toggle("hidden", !signedIn);
  syncButton.classList.toggle("hidden", !signedIn);
  authEmail.classList.toggle("hidden", signedIn);
  authPassword.classList.toggle("hidden", signedIn);
  authForm.querySelector("#signInButton").classList.toggle("hidden", signedIn);
  signUpButton.classList.toggle("hidden", signedIn);
}

function setCloudStatus(message, type = "info") {
  cloudStatus.textContent = message;
  cloudStatus.classList.toggle("active", type === "success" || type === "loading");
  cloudStatus.classList.toggle("error", type === "error");
}

function readAuthFields() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    throw new Error("Enter email and password first.");
  }
  return { email, password };
}

async function loadCloudData() {
  if (!session) return;
  setCloudStatus("Loading cloud records...", "loading");
  const [cloudDays, cloudExpenses] = await Promise.all([
    cloudRequest("/rest/v1/daily_entries?select=*,platform_earnings(*)&order=work_date.desc"),
    cloudRequest("/rest/v1/expenses?select=*&order=expense_date.desc"),
  ]);
  dailyRecords = consolidateDailyRecords(cloudDays.map(dailyFromCloud));
  expenses = cloudExpenses.map(expenseFromCloud);
  saveAll();
  render();
  setCloudStatus("Cloud records loaded.", "success");
}

async function saveDailyToCloud(record) {
  if (!session) return;
  await cloudRequest(`/rest/v1/daily_entries?id=eq.${encodeURIComponent(record.id)}`, { method: "DELETE" });
  await cloudRequest("/rest/v1/daily_entries", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(dailyToCloud(record)),
  });
  const platformRows = record.platforms.map((platform) => ({
    daily_entry_id: record.id,
    platform_name: platform.name,
    gross_income: platform.amount,
    trips: platform.trips,
  }));
  if (platformRows.length) {
    await cloudRequest("/rest/v1/platform_earnings", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(platformRows),
    });
  }
}

async function saveExpenseToCloud(expense) {
  if (!session) return;
  await cloudRequest(`/rest/v1/expenses?id=eq.${encodeURIComponent(expense.id)}`, { method: "DELETE" });
  await cloudRequest("/rest/v1/expenses", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(expenseToCloud(expense)),
  });
}

async function deleteDailyFromCloud(id) {
  if (!session) return;
  await cloudRequest(`/rest/v1/daily_entries?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function deleteExpenseFromCloud(id) {
  if (!session) return;
  await cloudRequest(`/rest/v1/expenses?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function pushLocalDataToCloud() {
  if (!session) return;
  setCloudStatus("Syncing local records to cloud...", "loading");
  for (const record of dailyRecords) {
    await saveDailyToCloud(record);
  }
  for (const expense of expenses) {
    await saveExpenseToCloud(expense);
  }
  await loadCloudData();
  setCloudStatus("Sync complete.", "success");
}

async function handleAuthRedirect() {
  const params = getAuthParamsFromUrl();
  if (params.error) {
    setCloudStatus(params.error, "error");
    history.replaceState(null, "", window.location.pathname);
    return;
  }
  if (!params.accessToken) return;

  try {
    setCloudStatus("Confirming email...", "loading");
    const user = await loadUserFromToken(params.accessToken);
    saveSession({ access_token: params.accessToken, refresh_token: params.refreshToken, user });
    history.replaceState(null, "", window.location.pathname);
    await pushLocalDataToCloud();
    setCloudStatus("Email confirmed and signed in.", "success");
  } catch (error) {
    setCloudStatus(error.message, "error");
  }
}

function renderDashboard() {
  const summary = selectedSummary();
  const expenseShare = summary.gross ? (summary.expenses / summary.gross) * 100 : 0;

  setText("#netIncome", currency(summary.net));
  setText("#grossIncome", currency(summary.gross));
  setText("#totalExpenses", currency(summary.expenses));
  setText("#businessKm", `${summary.km.toFixed(1)} km`);
  setText("#costPerKm", `${rate(summary.km ? summary.expenses / summary.km : 0)} cost/km`);
  setText("#incomePerHour", rate(summary.hours ? summary.gross / summary.hours : 0));
  setText("#profitPerHour", rate(summary.hours ? summary.net / summary.hours : 0));
  setText("#profitPerKm", `${rate(summary.km ? summary.net / summary.km : 0)} profit/km`);
  setText("#hoursWorked", `${summary.hours.toFixed(1)} hours`);
  setText("#tripTotal", `${summary.trips}`);
  setText("#avgPerTrip", rate(summary.trips ? summary.gross / summary.trips : 0));
  setText("#entryCount", `${summary.dayCount} ${summary.dayCount === 1 ? "day" : "days"}`);
  setText("#expenseShare", `${expenseShare.toFixed(0)}% of gross`);
  setText("#periodLabel", periodText());

  renderExpenseBreakdown(summary);
  renderPlatformBreakdown(summary);
}

function renderPlatformBreakdown(summary) {
  const container = document.querySelector("#platformBreakdown");
  const rows = Object.entries(summary.platformBreakdown).sort((a, b) => b[1] - a[1]);
  const maxValue = Math.max(...rows.map(([, value]) => value), 1);
  container.innerHTML = rows.length
    ? rows
        .map(([label, value]) => {
          const width = Math.max(0, (value / maxValue) * 100);
          return `
            <div class="expense-row">
              <span>${escapeHtml(label)}</span>
              <strong>${currency(value)}</strong>
              <div class="bar" aria-hidden="true"><i style="--width: ${width}%; --bar-color: var(--blue)"></i></div>
            </div>
          `;
        })
        .join("")
    : `<p class="field-help">No app income in this period yet.</p>`;
}

function renderExpenseBreakdown(summary) {
  const container = document.querySelector("#expenseBreakdown");
  const categories = Object.entries(expenseCategories);
  const maxValue = Math.max(...categories.map(([key]) => summary.expenseBreakdown[key]), 1);
  container.innerHTML = categories
    .map(([key, [label, color]]) => {
      const value = summary.expenseBreakdown[key];
      const width = Math.max(0, (value / maxValue) * 100);
      return `
        <div class="expense-row">
          <span>${label}</span>
          <strong>${currency(value)}</strong>
          <div class="bar" aria-hidden="true"><i style="--width: ${width}%; --bar-color: ${color}"></i></div>
        </div>
      `;
    })
    .join("");
}

function tableRows() {
  const query = searchInput.value.trim().toLowerCase();
  const dayRows = dailyRecords.map((record) => {
    const expensesTotal = numeric(record.fuel);
    return {
      ...record,
      label: platformSummary(record.platforms) || "Day",
      gross: numeric(record.gross),
      expenses: expensesTotal,
      net: numeric(record.gross) - expensesTotal,
      km: businessKm(record),
      hours: numeric(record.hours),
      searchable: record.notes || "",
    };
  });
  const expenseRows = expenses.map((expense) => ({
    ...expense,
    label: `${expenseCategories[expense.category]?.[0] || "Expense"} (${expense.frequency})`,
    gross: 0,
    expenses: numeric(expense.amount),
    net: -numeric(expense.amount),
    km: 0,
    hours: 0,
    searchable: expense.notes || "",
  }));

  return [...dayRows, ...expenseRows]
    .filter((record) => !query || record.searchable.toLowerCase().includes(query) || record.label.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderTable() {
  const rows = tableRows();
  emptyState.classList.toggle("hidden", rows.length > 0);
  recordsTable.innerHTML = rows
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.date)}</td>
          <td>${escapeHtml(record.label)}</td>
          <td>${currency(record.gross)}</td>
          <td>${record.trips || 0}</td>
          <td>${currency(record.expenses)}</td>
          <td>${currency(record.net)}</td>
          <td>${record.hours.toFixed(1)}</td>
          <td>${record.km.toFixed(1)}</td>
          <td>
            <div class="row-actions">
              <button class="text-button" type="button" data-edit-${record.type}="${record.id}">Edit</button>
              <button class="text-button delete" type="button" data-delete-${record.type}="${record.id}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function render() {
  renderRangeControls();
  renderDashboard();
  renderTable();
  updateDailyGrossPreview();
  saveSettings();
}

function renderRangeControls() {
  const isCustom = periodSelect.value === "custom";
  customRangeFields.forEach((field) => field.classList.toggle("hidden", !isCustom));
  referenceDate.closest(".field").classList.toggle("hidden", periodSelect.value === "all" || isCustom);
}

function readDayForm() {
  const data = Object.fromEntries(new FormData(dayForm).entries());
  return normalizeDailyRecord({
    id: editingDayId || makeId(),
    ...data,
    platforms: readPlatformRows(),
  });
}

function readExpenseForm() {
  const data = Object.fromEntries(new FormData(expenseForm).entries());
  return normalizeExpense({
    id: editingExpenseId || makeId(),
    type: "expense",
    date: data.date,
    category: data.category,
    amount: data.amount,
    frequency: data.frequency,
    notes: data.notes,
  });
}

function fillDayForm(record) {
  dayForm.elements.date.value = record.date;
  renderPlatformRows(record.platforms);
  dayForm.elements.hours.value = record.hours || "";
  dayForm.elements.odometerStart.value = record.odometerStart || "";
  dayForm.elements.odometerEnd.value = record.odometerEnd || "";
  dayForm.elements.fuel.value = record.fuel || "";
  dayForm.elements.notes.value = record.notes || "";
  editingDayId = record.id;
  dayFormTitle.textContent = "Edit day";
  cancelDayEditButton.classList.remove("hidden");
  daySaveStatus.textContent = "";
  updateDailyGrossPreview();
  dayForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillExpenseForm(expense) {
  expenseForm.elements.date.value = expense.date;
  expenseForm.elements.category.value = expense.category;
  expenseForm.elements.amount.value = expense.amount || "";
  expenseForm.elements.frequency.value = expense.frequency;
  expenseForm.elements.notes.value = expense.notes || "";
  editingExpenseId = expense.id;
  expenseFormTitle.textContent = "Edit expense";
  cancelExpenseEditButton.classList.remove("hidden");
  updateExpenseFrequencyHelp();
  expenseForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetDayForm({ keepStatus = false } = {}) {
  dayForm.reset();
  dayForm.elements.date.value = todayISO();
  renderPlatformRows([]);
  editingDayId = null;
  dayFormTitle.textContent = "Add today";
  cancelDayEditButton.classList.add("hidden");
  if (!keepStatus) daySaveStatus.textContent = "";
  updateKmHint();
  updateDailyGrossPreview();
}

function restoreDayDraft() {
  const draft = loadDayDraft();
  if (!draftHasUsefulData(draft)) return false;
  if (draft.date && draft.date !== todayISO()) {
    clearDayDraft();
    return false;
  }

  dayForm.elements.date.value = draft.date || todayISO();
  dayForm.elements.hours.value = draft.hours || "";
  dayForm.elements.odometerStart.value = draft.odometerStart || "";
  dayForm.elements.odometerEnd.value = draft.odometerEnd || "";
  dayForm.elements.fuel.value = draft.fuel || "";
  dayForm.elements.notes.value = draft.notes || "";
  renderPlatformRows(draft.platforms || []);
  daySaveStatus.textContent = "Restored your unsaved draft. Click Save day to keep it in History.";
  updateKmHint();
  updateDailyGrossPreview();
  return true;
}

function resetExpenseForm() {
  expenseForm.reset();
  expenseForm.elements.date.value = todayISO();
  editingExpenseId = null;
  expenseFormTitle.textContent = "Add expense";
  cancelExpenseEditButton.classList.add("hidden");
  updateExpenseFrequencyHelp(true);
}

function updateKmHint() {
  const start = numeric(dayForm.elements.odometerStart.value);
  const end = numeric(dayForm.elements.odometerEnd.value);
  const km = Math.max(0, end - start);
  dailyKmHint.textContent = km > 0 ? `Business km for this day: ${km.toFixed(1)} km.` : "Business km is calculated from odometer start and end.";
}

function renderPlatformRows(platforms = []) {
  const byName = Object.fromEntries(platforms.map((platform) => [platform.name.toLowerCase(), platform]));
  platformList.querySelectorAll(".platform-row").forEach((row) => {
    const platform = byName[row.dataset.platform.toLowerCase()] || {};
    row.querySelector(".platform-amount").value = platform.amount || "";
    row.querySelector(".platform-trips").value = platform.trips || "";
  });
  updateDailyGrossPreview();
}

function readPlatformRows() {
  return [...platformList.querySelectorAll(".platform-row")]
    .map((row) => ({
      name: row.dataset.platform,
      amount: numeric(row.querySelector(".platform-amount").value),
      trips: numeric(row.querySelector(".platform-trips").value),
    }))
    .filter((platform) => platform.amount > 0 || platform.trips > 0);
}

function updateDailyGrossPreview() {
  const rows = readPlatformRows();
  const total = platformTotal(rows);
  const trips = platformTripTotal(rows);
  dailyGrossPreview.textContent = `${currency(total)} / ${trips} ${trips === 1 ? "trip" : "trips"}`;
}

function updateExpenseFrequencyHelp(applyDefault = false) {
  const category = expenseForm.elements.category.value;
  const selectedDefault = categoryDefaults[category] || "one-time";
  if (applyDefault && !editingExpenseId) {
    expenseForm.elements.frequency.value = selectedDefault;
  }

  if (expenseForm.elements.frequency.value === "monthly") {
    frequencyHelp.textContent = "Monthly costs are shared across each selected day, week, month, or year automatically.";
  } else if (expenseForm.elements.frequency.value === "yearly") {
    frequencyHelp.textContent = "Yearly costs are divided across the year automatically, so reports include the right portion.";
  } else {
    frequencyHelp.textContent = "One-time costs count only when the expense date is inside the selected report period.";
  }
}

function exportCsv() {
  const headers = [
    "date",
    "recordType",
    "category",
    "frequency",
    "platformIncomeDetails",
    "uberIncome",
    "lyftIncome",
    "hovrIncome",
    "hoopIncome",
    "otherIncome",
    "gross",
    "trips",
    "hours",
    "odometerStart",
    "odometerEnd",
    "businessKm",
    "expenseAmount",
    "netIncome",
    "notes",
  ];
  const rows = tableRows()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => {
      const values = {
        date: record.date,
        recordType: record.type,
        category: record.category || "daily driving",
        frequency: record.frequency || "",
        platformIncomeDetails: record.platforms ? platformSummary(record.platforms) : "",
        uberIncome: record.uberIncome || 0,
        lyftIncome: record.lyftIncome || 0,
        hovrIncome: record.hovrIncome || 0,
        hoopIncome: record.hoopIncome || record.hopeIncome || 0,
        otherIncome: record.otherIncome || 0,
        gross: record.gross,
        trips: record.trips || 0,
        hours: record.hours,
        odometerStart: record.odometerStart || "",
        odometerEnd: record.odometerEnd || "",
        businessKm: record.km,
        expenseAmount: record.expenses,
        netIncome: record.net,
        notes: record.notes || "",
      };
      return headers.map((key) => `"${String(values[key] ?? "").replaceAll('"', '""')}"`).join(",");
    });
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `driver-ledger-${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function seedDemoData() {
  const base = new Date();
  const demoDays = [
    [0, [["Uber", 148.5, 12], ["Lyft", 68, 7]], 7.5, 12844, 13016, 61.2, "Airport-heavy day"],
    [1, [["Uber", 96.25, 8], ["Lyft", 72, 6], ["HOVR", 20, 1]], 6.5, 13016, 13147, 42.8, "Short city trips"],
    [2, [["Uber", 184.8, 16], ["Toronto 1 Taxi", 60, 6]], 8, 13147, 13341, 70.5, "Busy evening"],
    [3, [["Uber", 132.1, 10]], 4.5, 13341, 13418, 35.2, "Part day"],
    [4, [["Uber", 210.7, 18], ["Lyft", 91, 8]], 9, 13418, 13652, 82.4, "Weekend demand"],
  ];

  dailyRecords = [
    ...dailyRecords,
    ...demoDays.map((item) => {
      const date = new Date(base);
      date.setDate(base.getDate() - item[0]);
      return normalizeDailyRecord({
        date: date.toISOString().slice(0, 10),
        platforms: item[1].map(([name, amount, trips]) => ({ name, amount, trips })),
        hours: item[2],
        odometerStart: item[3],
        odometerEnd: item[4],
        fuel: item[5],
        notes: item[6],
      });
    }),
  ];

  expenses = [
    ...expenses,
    normalizeExpense({
      type: "expense",
      date: todayISO(),
      category: "insurance",
      amount: 260,
      frequency: "monthly",
      notes: "Example monthly insurance",
    }),
    normalizeExpense({
      type: "expense",
      date: todayISO(),
      category: "phoneData",
      amount: 75,
      frequency: "monthly",
      notes: "Example phone plan",
    }),
  ];

  saveAll();
  render();
}

dayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = readDayForm();
  if (!record.gross && !record.trips && !record.hours && !record.fuel) {
    daySaveStatus.textContent = "Enter income, trips, hours, or fuel before saving.";
    return;
  }
  try {
    const sameDateRecord = !editingDayId ? dailyRecords.find((item) => item.date === record.date) : null;
    const savedRecord = sameDateRecord ? mergeDailyRecord(sameDateRecord, record) : record;
    dailyRecords = editingDayId
      ? dailyRecords.map((item) => (item.id === editingDayId ? record : item))
      : sameDateRecord
        ? dailyRecords.map((item) => (item.id === sameDateRecord.id ? savedRecord : item))
        : [...dailyRecords, savedRecord];
    saveAll();
    await saveDailyToCloud(savedRecord);
    clearDayDraft();
    resetDayForm({ keepStatus: true });
    daySaveStatus.textContent = `${sameDateRecord ? "Updated" : "Saved to"} History: ${savedRecord.date}, ${currency(savedRecord.gross)}, ${savedRecord.trips} ${savedRecord.trips === 1 ? "trip" : "trips"}.`;
    setCloudStatus(session ? "Saved to cloud." : "Saved in this browser.", "success");
    render();
  } catch (error) {
    daySaveStatus.textContent = "Cloud save failed. Your entry is still saved in this browser.";
    setCloudStatus(error.message, "error");
    saveAll();
    render();
  }
});

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const expense = readExpenseForm();
  try {
    expenses = editingExpenseId
      ? expenses.map((item) => (item.id === editingExpenseId ? expense : item))
      : [...expenses, expense];
    saveAll();
    await saveExpenseToCloud(expense);
    resetExpenseForm();
    setCloudStatus(session ? "Expense saved to cloud." : "Expense saved in this browser.", "success");
    render();
  } catch (error) {
    setCloudStatus(`Cloud save failed. ${error.message}`, "error");
    saveAll();
    render();
  }
});

recordsTable.addEventListener("click", async (event) => {
  const editDayId = event.target.dataset.editDay;
  const editExpenseId = event.target.dataset.editExpense;
  const deleteDayId = event.target.dataset.deleteDay;
  const deleteExpenseId = event.target.dataset.deleteExpense;

  if (editDayId) {
    const record = dailyRecords.find((item) => item.id === editDayId);
    if (record) fillDayForm(record);
  }
  if (editExpenseId) {
    const expense = expenses.find((item) => item.id === editExpenseId);
    if (expense) fillExpenseForm(expense);
  }
  if (deleteDayId) {
    const confirmed = window.confirm("Delete this daily entry from history?");
    if (!confirmed) return;
    dailyRecords = dailyRecords.filter((item) => item.id !== deleteDayId);
    saveAll();
    try {
      await deleteDailyFromCloud(deleteDayId);
      setCloudStatus(session ? "Deleted from cloud." : "Deleted from this browser.", "success");
    } catch (error) {
      setCloudStatus(`Cloud delete failed. ${error.message}`, "error");
    }
    render();
  }
  if (deleteExpenseId) {
    const confirmed = window.confirm("Delete this expense from history?");
    if (!confirmed) return;
    expenses = expenses.filter((item) => item.id !== deleteExpenseId);
    saveAll();
    try {
      await deleteExpenseFromCloud(deleteExpenseId);
      setCloudStatus(session ? "Deleted from cloud." : "Deleted from this browser.", "success");
    } catch (error) {
      setCloudStatus(`Cloud delete failed. ${error.message}`, "error");
    }
    render();
  }
});

[periodSelect, referenceDate, rangeStartDate, rangeEndDate, currencyInput, searchInput].forEach((input) => {
  input.addEventListener("input", render);
});

[dayForm.elements.odometerStart, dayForm.elements.odometerEnd].forEach((input) => {
  input.addEventListener("input", () => {
    updateKmHint();
    saveDayDraft();
  });
});

[dayForm.elements.date, dayForm.elements.hours, dayForm.elements.fuel, dayForm.elements.notes].forEach((input) => {
  input.addEventListener("input", saveDayDraft);
});

platformList.querySelectorAll(".platform-amount, .platform-trips").forEach((input) => {
  input.addEventListener("input", () => {
    updateDailyGrossPreview();
    saveDayDraft();
  });
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const credentials = readAuthFields();
    setCloudStatus("Signing in...", "loading");
    const result = await authRequest("/auth/v1/token?grant_type=password", credentials);
    saveSession(sessionFromAuthResult(result));
    authPassword.value = "";
    await loadCloudData();
    setCloudStatus("Signed in and cloud records loaded.", "success");
  } catch (error) {
    setCloudStatus(error.message, "error");
  }
});

signUpButton.addEventListener("click", async () => {
  try {
    const credentials = readAuthFields();
    setCloudStatus("Creating account...", "loading");
    const result = await authRequest("/auth/v1/signup", credentials);
    if (result.access_token && result.user) {
      saveSession(sessionFromAuthResult(result));
      authPassword.value = "";
      await pushLocalDataToCloud();
    } else {
      setCloudStatus("Account created. Check email if confirmation is required, then sign in.", "success");
    }
  } catch (error) {
    setCloudStatus(error.message, "error");
  }
});

signOutButton.addEventListener("click", () => {
  saveSession(null);
  setCloudStatus("Signed out. Records will save in this browser.", "success");
});

syncButton.addEventListener("click", async () => {
  try {
    await pushLocalDataToCloud();
  } catch (error) {
    setCloudStatus(error.message, "error");
  }
});

expenseForm.elements.category.addEventListener("input", () => updateExpenseFrequencyHelp(true));
expenseForm.elements.frequency.addEventListener("input", () => updateExpenseFrequencyHelp());

exportButton.addEventListener("click", exportCsv);
cancelDayEditButton.addEventListener("click", () => {
  clearDayDraft();
  resetDayForm();
});
cancelExpenseEditButton.addEventListener("click", resetExpenseForm);
seedDemoButton.addEventListener("click", seedDemoData);

clearButton.addEventListener("click", async () => {
  if (!dailyRecords.length && !expenses.length) return;
  const typed = window.prompt('This will delete all saved driver records and expenses. Export CSV first if you need a backup. Type DELETE to continue.');
  if (typed !== "DELETE") return;
  if (session) {
    try {
      await Promise.all([
        cloudRequest("/rest/v1/daily_entries?user_id=eq." + encodeURIComponent(session.user.id), { method: "DELETE" }),
        cloudRequest("/rest/v1/expenses?user_id=eq." + encodeURIComponent(session.user.id), { method: "DELETE" }),
      ]);
      setCloudStatus("All cloud records deleted.", "success");
    } catch (error) {
      setCloudStatus(`Cloud clear failed. ${error.message}`, "error");
      return;
    }
  }
  dailyRecords = [];
  expenses = [];
  saveAll();
  resetDayForm();
  resetExpenseForm();
  render();
});

const settings = loadSettings();
periodSelect.value = settings.period || "week";
referenceDate.value = todayISO();
rangeStartDate.value = settings.rangeStartDate || referenceDate.value || todayISO();
rangeEndDate.value = settings.rangeEndDate || referenceDate.value || todayISO();
currencyInput.value = settings.currency || "$";
resetDayForm();
resetExpenseForm();
restoreDayDraft();
saveAll();
renderAuth();
render();
handleAuthRedirect().then(() => {
  if (session) {
    loadCloudData().catch((error) => setCloudStatus(error.message, "error"));
  }
});
