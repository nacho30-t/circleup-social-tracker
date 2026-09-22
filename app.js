// Keep the original storage keys so existing CircleUp demo data remains available after rebranding to highlife.
const STORAGE_USERS = "circleup_users_v1";
const STORAGE_SESSION = "circleup_session_v1";
const STORAGE_DATA = "circleup_data_v1";
const MAX_INTERACTIONS_PER_DAY = 4;

const state = {
  authMode: "register",
  email: null,
  animateDateKey: null,
  animateSlotIndex: null
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
const todayCount = $("todayCount");
const monthInteractionLabel = $("monthInteractionLabel");
const checkInBtn = $("checkInBtn");
const interactionToast = $("interactionToast");
const statInteractions = $("statInteractions");
const statSocialDays = $("statSocialDays");
const statStreak = $("statStreak");
const statNewPeople = $("statNewPeople");
const statProfessional = $("statProfessional");
const recentList = $("recentList");
const dailyChallenge = $("dailyChallenge");
const logoutBtn = $("logoutBtn");

const modal = $("checkInModal");
const checkInForm = $("checkInForm");
const note = $("note");
const charCount = $("charCount");
const todayCapacity = $("todayCapacity");

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
    // DEMO ONLY. Use a real authentication service before using this publicly for real accounts.
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

function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }

function currentMonthDaysWithEntries() {
  const now = new Date();
  const prefix = monthKey(now);
  const data = getUserData();
  return Object.entries(data)
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .map(([dateKey, rawEntry]) => ({ dateKey, entries: normalizeDayEntries(rawEntry) }))
    .filter(day => day.entries.length > 0)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function flatCurrentMonthEntries() {
  return currentMonthDaysWithEntries().flatMap(day =>
    day.entries.map((entry, index) => ({ ...entry, dateKey: day.dateKey, slotIndex: index }))
  );
}

function renderDashboard() {
  const now = new Date();
  const totalDays = daysInMonth(now);
  const monthName = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  monthTitle.textContent = monthName;
  dailyChallenge.textContent = CHALLENGES[now.getDate() % CHALLENGES.length];

  renderRing(now, totalDays);
  renderStats(now);
  renderRecent();

  const todayEntries = normalizeDayEntries(getUserData()[keyForDate(now)]);
  const remaining = MAX_INTERACTIONS_PER_DAY - todayEntries.length;
  todayCount.textContent = todayEntries.length;
  monthInteractionLabel.textContent = `${flatCurrentMonthEntries().length} interaction${flatCurrentMonthEntries().length === 1 ? "" : "s"} this month`;
  checkInBtn.disabled = remaining <= 0;
  checkInBtn.textContent = remaining <= 0 ? "Today's slots are full ✓" : `Add interaction (${remaining} left)`;
}

function renderRing(now, totalDays) {
  dayRing.innerHTML = "";
  const data = getUserData();
  const today = now.getDate();
  const radiusPercent = window.innerWidth <= 650 ? 42.4 : 44.1;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
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
    item.setAttribute("aria-label", `Day ${day}, ${entries.length} interactions`);

    if (day === today) item.classList.add("today", "clickable");
    if (day > today) item.classList.add("future");
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
    if (day === today && entries.length < MAX_INTERACTIONS_PER_DAY) item.addEventListener("click", openModal);
    dayRing.appendChild(item);
  }

  state.animateDateKey = null;
  state.animateSlotIndex = null;
}

function renderStats(now) {
  const days = currentMonthDaysWithEntries();
  const entries = flatCurrentMonthEntries();
  const data = getUserData();

  statInteractions.textContent = entries.length;
  statSocialDays.textContent = days.length;
  statNewPeople.textContent = entries.filter(entry => entry.category === "new-person").length;
  statProfessional.textContent = entries.filter(entry => entry.category === "professional").length;

  let streak = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let cursor = new Date(today); ; cursor.setDate(cursor.getDate() - 1)) {
    if (cursor.getMonth() !== now.getMonth()) break;
    if (normalizeDayEntries(data[keyForDate(cursor)]).length > 0) streak++;
    else break;
  }
  statStreak.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
}

function renderRecent() {
  const entries = flatCurrentMonthEntries()
    .slice()
    .sort((a, b) => (b.createdAt || b.dateKey).localeCompare(a.createdAt || a.dateKey))
    .slice(0, 6);

  recentList.innerHTML = "";
  if (!entries.length) {
    recentList.innerHTML = `<div class="recent-empty">No interactions yet. Your first highlighted moment will appear here.</div>`;
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

checkInBtn.addEventListener("click", openModal);
document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });
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
  state.animateDateKey = todayKey;
  state.animateSlotIndex = todayEntries.length - 1;

  closeModal();
  renderDashboard();
  showInteractionToast(category);
});

window.addEventListener("resize", () => {
  if (!dashboardView.classList.contains("hidden")) renderRing(new Date(), daysInMonth(new Date()));
});

(function init() {
  const session = getJSON(STORAGE_SESSION, null);
  if (session?.email) openDashboard(session.email);
})();
