// Keep the original storage keys so existing demo data remains available after every highlife update.
const STORAGE_USERS = "circleup_users_v1";
const STORAGE_SESSION = "circleup_session_v1";
const STORAGE_DATA = "circleup_data_v1";
const MAX_INTERACTIONS_PER_DAY = 4;

const state = {
  authMode: "register",
  email: null,
  animateDateKey: null,
  animateSlotIndex: null,
  selectedMonth: startOfMonth(new Date()),
  followCurrentMonth: true,
  archiveYear: new Date().getFullYear(),
  lastObservedDay: null
};

const $ = (id) => document.getElementById(id);
const authView = $("authView");
const dashboardView = $("dashboardView");
const authForm = $("authForm");
const authSubmit = $("authSubmit");
const authMessage = $("authMessage");
const emailInput = $("email");
const passwordInput = $("password");
const tabs = document.querySelectorAll(".auth-tab");

const dayRing = $("dayRing");
const monthTitle = $("monthTitle");
const userEmail = $("userEmail");
const centerLabel = $("centerLabel");
const todayCount = $("todayCount");
const centerCountSuffix = $("centerCountSuffix");
const monthInteractionLabel = $("monthInteractionLabel");
const checkInBtn = $("checkInBtn");
const interactionToast = $("interactionToast");
const statInteractions = $("statInteractions");
const statSocialDays = $("statSocialDays");
const statStreak = $("statStreak");
const statStreakLabel = $("statStreakLabel");
const statNewPeople = $("statNewPeople");
const statProfessional = $("statProfessional");
const snapshotEyebrow = $("snapshotEyebrow");
const recentList = $("recentList");
const recentTitle = $("recentTitle");
const dailyChallenge = $("dailyChallenge");
const logoutBtn = $("logoutBtn");

const prevMonthBtn = $("prevMonthBtn");
const nextMonthBtn = $("nextMonthBtn");
const todayMonthBtn = $("todayMonthBtn");
const archiveBtn = $("archiveBtn");

const modal = $("checkInModal");
const checkInForm = $("checkInForm");
const note = $("note");
const charCount = $("charCount");
const todayCapacity = $("todayCapacity");

const archiveModal = $("archiveModal");
const archiveMonths = $("archiveMonths");
const archiveYearTitle = $("archiveYearTitle");
const prevYearBtn = $("prevYearBtn");
const nextYearBtn = $("nextYearBtn");
const archiveCurrentBtn = $("archiveCurrentBtn");

const CATEGORY_LABELS = {
  social: "Social",
  professional: "Professional",
  "new-person": "New person",
  event: "Event"
};

const CATEGORY_SHORT = {
  social: "S",
  professional: "P",
  "new-person": "N",
  event: "E"
};

const CATEGORY_COLORS = {
  social: "var(--social)",
  professional: "var(--professional)",
  "new-person": "var(--new-person)",
  event: "var(--event)"
};

const CHALLENGES = [
  "Start one conversation today that you would not have started otherwise.",
  "Introduce yourself to one person you have seen before but never spoken to.",
  "Send a message to someone you have been meaning to reconnect with.",
  "Ask one person a question about what they study, build or work on.",
  "Invite someone to grab a coffee, lunch or a short walk.",
  "At your next group setting, speak to someone outside your usual circle.",
  "Turn one small-talk moment into a real conversation by asking a follow-up question."
];

function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function setJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function normalizeEmail(value) { return value.trim().toLowerCase(); }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date, amount) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function isSameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function isAfterMonth(a, b) { return startOfMonth(a).getTime() > startOfMonth(b).getTime(); }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }

function setAuthMode(mode) {
  state.authMode = mode;
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === mode));
  authSubmit.textContent = mode === "register" ? "Create account" : "Log in";
  authMessage.textContent = "";
}

tabs.forEach(tab => tab.addEventListener("click", () => setAuthMode(tab.dataset.tab)));

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;

  if (!email || password.length < 6) {
    authMessage.textContent = "Please enter a valid email and a password with at least 6 characters.";
    return;
  }

  const users = getJSON(STORAGE_USERS, {});
  if (state.authMode === "register") {
    if (users[email]) {
      authMessage.textContent = "An account with this email already exists. Try logging in.";
      return;
    }
    // DEMO ONLY. Replace localStorage authentication with a real auth provider for a public production app.
    users[email] = { password, createdAt: new Date().toISOString() };
    setJSON(STORAGE_USERS, users);
    setJSON(STORAGE_SESSION, { email });
    openDashboard(email);
  } else {
    if (!users[email] || users[email].password !== password) {
      authMessage.textContent = "Incorrect email or password.";
      return;
    }
    setJSON(STORAGE_SESSION, { email });
    openDashboard(email);
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_SESSION);
  state.email = null;
  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");
  passwordInput.value = "";
});

function openDashboard(email) {
  state.email = email;
  state.selectedMonth = startOfMonth(new Date());
  state.followCurrentMonth = true;
  state.archiveYear = new Date().getFullYear();
  state.lastObservedDay = keyForDate(new Date());
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  userEmail.textContent = email;
  renderDashboard();
}

function getUserData() {
  const all = getJSON(STORAGE_DATA, {});
  return all[state.email] || {};
}

function saveUserData(data) {
  const all = getJSON(STORAGE_DATA, {});
  all[state.email] = data;
  setJSON(STORAGE_DATA, all);
}

function normalizeDayEntries(rawEntry) {
  if (!rawEntry) return [];
  if (Array.isArray(rawEntry)) return rawEntry;
  if (typeof rawEntry === "object") return [rawEntry];
  return [];
}

function keyForDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDaysWithEntries(date) {
  const prefix = monthKey(date);
  const data = getUserData();
  return Object.entries(data)
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .map(([dateKey, rawEntry]) => ({ dateKey, entries: normalizeDayEntries(rawEntry) }))
    .filter(day => day.entries.length > 0)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function flatMonthEntries(date) {
  return monthDaysWithEntries(date).flatMap(day =>
    day.entries.map((entry, index) => ({ ...entry, dateKey: day.dateKey, slotIndex: index }))
  );
}

function setSelectedMonth(date, followCurrent = false) {
  const current = startOfMonth(new Date());
  const target = startOfMonth(date);
  if (isAfterMonth(target, current)) return;
  state.selectedMonth = target;
  state.followCurrentMonth = followCurrent || isSameMonth(target, current);
  renderDashboard();
}

function renderDashboard() {
  const now = new Date();
  const selected = state.selectedMonth;
  const selectedIsCurrent = isSameMonth(selected, now);
  const totalDays = daysInMonth(selected);
  const monthName = selected.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedEntries = flatMonthEntries(selected);
  const selectedDays = monthDaysWithEntries(selected);

  monthTitle.textContent = monthName;
  dailyChallenge.textContent = CHALLENGES[now.getDate() % CHALLENGES.length];
  todayMonthBtn.textContent = selectedIsCurrent ? "Current month" : "Back to current";
  todayMonthBtn.classList.toggle("active", selectedIsCurrent);
  nextMonthBtn.disabled = selectedIsCurrent;
  snapshotEyebrow.textContent = selectedIsCurrent ? "MONTHLY SNAPSHOT" : `${selected.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()} SNAPSHOT`;
  recentTitle.textContent = selectedIsCurrent ? "Your latest interactions" : `Interactions from ${selected.toLocaleDateString("en-GB", { month: "long" })}`;

  renderRing(selected, totalDays, now);
  renderStats(selected, now);
  renderRecent(selected);

  if (selectedIsCurrent) {
    const todayEntries = normalizeDayEntries(getUserData()[keyForDate(now)]);
    const remaining = MAX_INTERACTIONS_PER_DAY - todayEntries.length;
    centerLabel.textContent = "TODAY";
    todayCount.textContent = todayEntries.length;
    centerCountSuffix.textContent = `/${MAX_INTERACTIONS_PER_DAY}`;
    monthInteractionLabel.textContent = `${selectedEntries.length} interaction${selectedEntries.length === 1 ? "" : "s"} this month`;
    checkInBtn.classList.remove("hidden");
    checkInBtn.disabled = remaining <= 0;
    checkInBtn.textContent = remaining <= 0 ? "Today's slots are full ✓" : `Add interaction (${remaining} left)`;
  } else {
    centerLabel.textContent = "MONTH TOTAL";
    todayCount.textContent = selectedEntries.length;
    centerCountSuffix.textContent = " highlights";
    monthInteractionLabel.textContent = `${selectedDays.length} social day${selectedDays.length === 1 ? "" : "s"}`;
    checkInBtn.classList.add("hidden");
  }
}

function renderRing(selected, totalDays, now) {
  dayRing.innerHTML = "";
  const data = getUserData();
  const selectedIsCurrent = isSameMonth(selected, now);
  const today = now.getDate();
  const radiusPercent = window.innerWidth <= 650 ? 42.4 : 44.1;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(selected.getFullYear(), selected.getMonth(), day);
    const key = keyForDate(date);
    const entries = normalizeDayEntries(data[key]);
    const angle = (day - 1) / totalDays * 360 - 90;
    const rad = angle * Math.PI / 180;
    const x = 50 + Math.cos(rad) * radiusPercent;
    const y = 50 + Math.sin(rad) * radiusPercent;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "day-item";
    item.style.left = `${x}%`;
    item.style.top = `${y}%`;
    item.style.transform = "translate(-50%, -50%)";
    item.setAttribute("aria-label", `${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, ${entries.length} interactions`);

    if (selectedIsCurrent && day === today) item.classList.add("today", "clickable");
    if (selectedIsCurrent && day > today) item.classList.add("future");
    if (!selectedIsCurrent) item.classList.add("past-month-day");
    if (entries.length >= MAX_INTERACTIONS_PER_DAY) item.classList.add("full");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    item.appendChild(number);

    const slots = document.createElement("span");
    slots.className = "interaction-slots";

    for (let slotIndex = 0; slotIndex < MAX_INTERACTIONS_PER_DAY; slotIndex++) {
      const slot = document.createElement("span");
      slot.className = "interaction-slot";
      const entry = entries[slotIndex];
      if (entry) {
        slot.classList.add("filled", `category-${entry.category || "social"}`);
        if (state.animateDateKey === key && state.animateSlotIndex === slotIndex) slot.classList.add("just-added");
      }
      slots.appendChild(slot);
    }

    item.appendChild(slots);
    if (selectedIsCurrent && day === today && entries.length < MAX_INTERACTIONS_PER_DAY) item.addEventListener("click", openModal);
    dayRing.appendChild(item);
  }

  state.animateDateKey = null;
  state.animateSlotIndex = null;
}

function renderStats(selected, now) {
  const days = monthDaysWithEntries(selected);
  const entries = flatMonthEntries(selected);
  const data = getUserData();
  const selectedIsCurrent = isSameMonth(selected, now);

  statInteractions.textContent = entries.length;
  statSocialDays.textContent = days.length;
  statNewPeople.textContent = entries.filter(entry => entry.category === "new-person").length;
  statProfessional.textContent = entries.filter(entry => entry.category === "professional").length;

  if (selectedIsCurrent) {
    let streak = 0;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let cursor = new Date(today); cursor.getMonth() === selected.getMonth() && cursor.getFullYear() === selected.getFullYear(); cursor.setDate(cursor.getDate() - 1)) {
      if (normalizeDayEntries(data[keyForDate(cursor)]).length > 0) streak++;
      else break;
    }
    statStreakLabel.textContent = "Current streak";
    statStreak.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
  } else {
    const activeDays = new Set(days.map(day => Number(day.dateKey.slice(-2))));
    let longest = 0;
    let running = 0;
    for (let day = 1; day <= daysInMonth(selected); day++) {
      if (activeDays.has(day)) {
        running++;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    }
    statStreakLabel.textContent = "Best streak";
    statStreak.textContent = `${longest} day${longest === 1 ? "" : "s"}`;
  }
}

function renderRecent(selected) {
  const entries = flatMonthEntries(selected)
    .slice()
    .sort((a, b) => (b.createdAt || b.dateKey).localeCompare(a.createdAt || a.dateKey))
    .slice(0, 6);

  recentList.innerHTML = "";
  if (!entries.length) {
    recentList.innerHTML = `<div class="recent-empty">No interactions recorded in this month yet.</div>`;
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "recent-item";
    const d = new Date(`${entry.dateKey}T12:00:00`);
    const shortDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const safeCategory = entry.category || "social";
    row.innerHTML = `
      <div class="recent-icon" style="--item-color:${CATEGORY_COLORS[safeCategory] || CATEGORY_COLORS.social}"><span>${CATEGORY_SHORT[safeCategory] || "S"}</span></div>
      <div class="recent-copy">
        <strong>${CATEGORY_LABELS[safeCategory] || safeCategory}</strong>
        <span>${escapeHTML(entry.note || "Meaningful interaction logged")}</span>
      </div>
      <div class="recent-date">${shortDate}</div>`;
    recentList.appendChild(row);
  });
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function renderCapacityPreview() {
  const todayEntries = normalizeDayEntries(getUserData()[keyForDate(new Date())]);
  todayCapacity.innerHTML = "";

  const label = document.createElement("span");
  label.className = "capacity-label";
  label.textContent = `${todayEntries.length}/${MAX_INTERACTIONS_PER_DAY} interactions today`;
  todayCapacity.appendChild(label);

  const lines = document.createElement("div");
  lines.className = "capacity-lines";
  for (let i = 0; i < MAX_INTERACTIONS_PER_DAY; i++) {
    const line = document.createElement("span");
    line.className = "capacity-line";
    if (todayEntries[i]) line.classList.add("filled", `category-${todayEntries[i].category || "social"}`);
    lines.appendChild(line);
  }
  todayCapacity.appendChild(lines);
}

function openModal() {
  if (!isSameMonth(state.selectedMonth, new Date())) return;
  const todayEntries = normalizeDayEntries(getUserData()[keyForDate(new Date())]);
  if (todayEntries.length >= MAX_INTERACTIONS_PER_DAY) return;
  renderCapacityPreview();
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => note.focus(), 40);
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  checkInForm.reset();
  charCount.textContent = "0";
}

function showInteractionToast(category) {
  interactionToast.textContent = `+1 ${CATEGORY_LABELS[category] || "interaction"} highlighted`;
  interactionToast.classList.remove("show");
  void interactionToast.offsetWidth;
  interactionToast.classList.add("show");
}

function openArchive() {
  state.archiveYear = state.selectedMonth.getFullYear();
  renderArchive();
  archiveModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeArchive() {
  archiveModal.classList.add("hidden");
  document.body.style.overflow = "";
}


function earliestRelevantYear() {
  const years = [new Date().getFullYear()];
  const data = getUserData();
  Object.keys(data).forEach(key => {
    const year = Number(key.slice(0, 4));
    if (Number.isFinite(year)) years.push(year);
  });
  const users = getJSON(STORAGE_USERS, {});
  const createdAt = users[state.email]?.createdAt;
  if (createdAt) {
    const createdYear = new Date(createdAt).getFullYear();
    if (Number.isFinite(createdYear)) years.push(createdYear);
  }
  return Math.min(...years);
}

function renderArchive() {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  archiveYearTitle.textContent = state.archiveYear;
  prevYearBtn.disabled = state.archiveYear <= earliestRelevantYear();
  nextYearBtn.disabled = state.archiveYear >= now.getFullYear();
  archiveMonths.innerHTML = "";

  for (let month = 0; month < 12; month++) {
    const date = new Date(state.archiveYear, month, 1);
    const future = isAfterMonth(date, currentMonth);
    const entries = flatMonthEntries(date);
    const days = monthDaysWithEntries(date);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "archive-month";
    if (isSameMonth(date, state.selectedMonth)) btn.classList.add("selected");
    if (isSameMonth(date, currentMonth)) btn.classList.add("current");
    if (future) btn.classList.add("future");
    btn.disabled = future;
    btn.innerHTML = `
      <span class="archive-month-name">${date.toLocaleDateString("en-GB", { month: "long" })}</span>
      <strong>${entries.length}</strong>
      <span class="archive-month-meta">${days.length} social day${days.length === 1 ? "" : "s"}</span>
      ${isSameMonth(date, currentMonth) ? '<i class="archive-current-dot">now</i>' : ''}`;
    if (!future) {
      btn.addEventListener("click", () => {
        setSelectedMonth(date, isSameMonth(date, currentMonth));
        closeArchive();
      });
    }
    archiveMonths.appendChild(btn);
  }
}

function syncWithRealDate() {
  const now = new Date();
  const todayKey = keyForDate(now);
  if (state.lastObservedDay === null) state.lastObservedDay = todayKey;
  if (todayKey === state.lastObservedDay) return;

  state.lastObservedDay = todayKey;
  if (state.followCurrentMonth) state.selectedMonth = startOfMonth(now);
  if (state.email) renderDashboard();
  if (!archiveModal.classList.contains("hidden")) {
    if (state.archiveYear > now.getFullYear()) state.archiveYear = now.getFullYear();
    renderArchive();
  }
}

prevMonthBtn.addEventListener("click", () => setSelectedMonth(addMonths(state.selectedMonth, -1), false));
nextMonthBtn.addEventListener("click", () => setSelectedMonth(addMonths(state.selectedMonth, 1), isSameMonth(addMonths(state.selectedMonth, 1), new Date())));
todayMonthBtn.addEventListener("click", () => setSelectedMonth(new Date(), true));
archiveBtn.addEventListener("click", openArchive);

prevYearBtn.addEventListener("click", () => {
  if (state.archiveYear > earliestRelevantYear()) { state.archiveYear--; renderArchive(); }
});
nextYearBtn.addEventListener("click", () => {
  if (state.archiveYear < new Date().getFullYear()) { state.archiveYear++; renderArchive(); }
});
archiveCurrentBtn.addEventListener("click", () => {
  setSelectedMonth(new Date(), true);
  closeArchive();
});
document.querySelectorAll("[data-close-archive]").forEach(el => el.addEventListener("click", closeArchive));

checkInBtn.addEventListener("click", openModal);
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!modal.classList.contains("hidden")) closeModal();
  else if (!archiveModal.classList.contains("hidden")) closeArchive();
});
note.addEventListener("input", () => { charCount.textContent = note.value.length; });

checkInForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(checkInForm);
  const category = formData.get("category");
  const today = new Date();
  const todayKey = keyForDate(today);
  const data = getUserData();
  const todayEntries = normalizeDayEntries(data[todayKey]);

  if (todayEntries.length >= MAX_INTERACTIONS_PER_DAY) {
    closeModal();
    renderDashboard();
    return;
  }

  todayEntries.push({ category, note: note.value.trim(), createdAt: new Date().toISOString() });
  data[todayKey] = todayEntries;
  saveUserData(data);
  state.selectedMonth = startOfMonth(today);
  state.followCurrentMonth = true;
  state.animateDateKey = todayKey;
  state.animateSlotIndex = todayEntries.length - 1;

  closeModal();
  renderDashboard();
  showInteractionToast(category);
});

window.addEventListener("resize", () => {
  if (!dashboardView.classList.contains("hidden")) renderRing(state.selectedMonth, daysInMonth(state.selectedMonth), new Date());
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncWithRealDate();
});

// If the page remains open overnight, the active day/month updates automatically without a refresh.
setInterval(syncWithRealDate, 30000);

(function init() {
  const session = getJSON(STORAGE_SESSION, null);
  state.lastObservedDay = keyForDate(new Date());
  if (session?.email) openDashboard(session.email);
})();
