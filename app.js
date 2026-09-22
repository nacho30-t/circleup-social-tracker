
const STORAGE_USERS = "circleup_users_v1";
const STORAGE_SESSION = "circleup_session_v1";
const STORAGE_DATA = "circleup_data_v1";

const state = {
  authMode: "register",
  email: null
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

const tracker = $("tracker");
const dayRing = $("dayRing");
const monthTitle = $("monthTitle");
const userEmail = $("userEmail");
const socialDaysBig = $("socialDaysBig");
const daysInMonthLabel = $("daysInMonthLabel");
const checkInBtn = $("checkInBtn");
const statSocialDays = $("statSocialDays");
const statStreak = $("statStreak");
const statNewPeople = $("statNewPeople");
const statProfessional = $("statProfessional");
const recentList = $("recentList");
const logoutBtn = $("logoutBtn");

const modal = $("checkInModal");
const checkInForm = $("checkInForm");
const note = $("note");
const charCount = $("charCount");

function getJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function setAuthMode(mode) {
  state.authMode = mode;
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === mode));
  authSubmit.textContent = mode === "register" ? "Create account" : "Log in";
  authMessage.textContent = "";
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.tab));
});

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

    // DEMO ONLY:
    // Passwords are stored locally in plain text so the prototype works without a backend.
    // Replace this block with Supabase/Firebase/Auth0 for a production version.
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

function keyForDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function entriesForCurrentMonth() {
  const now = new Date();
  const prefix = monthKey(now);
  const data = getUserData();

  return Object.entries(data)
    .filter(([dateKey]) => dateKey.startsWith(prefix))
    .map(([dateKey, entry]) => ({ dateKey, ...entry }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function renderDashboard() {
  const now = new Date();
  const totalDays = daysInMonth(now);
  const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  monthTitle.textContent = monthName;
  daysInMonthLabel.textContent = `of ${totalDays} this month`;

  renderRing(now, totalDays);
  renderStats(now);
  renderRecent();

  const data = getUserData();
  const todayKey = keyForDate(now);
  const completedToday = Boolean(data[todayKey]);

  checkInBtn.disabled = completedToday;
  checkInBtn.textContent = completedToday ? "Completed today ✓" : "Check in today";
}

function renderRing(now, totalDays) {
  dayRing.innerHTML = "";
  const data = getUserData();
  const today = now.getDate();

  const radiusPercent = window.innerWidth <= 600 ? 43.5 : 45;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const key = keyForDate(date);
    const angle = (day - 1) / totalDays * 360 - 90;
    const rad = angle * Math.PI / 180;
    const x = 50 + Math.cos(rad) * radiusPercent;
    const y = 50 + Math.sin(rad) * radiusPercent;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-btn";
    btn.textContent = day;
    btn.style.left = `${x}%`;
    btn.style.top = `${y}%`;

    const completed = Boolean(data[key]);
    if (completed) btn.classList.add("completed");
    if (day === today) btn.classList.add("today", "clickable");
    if (day > today) btn.classList.add("future");

    btn.title = completed
      ? `${key}: completed`
      : day === today
        ? "Today — click to check in"
        : day > today
          ? "Future day"
          : "No check-in recorded";

    const transform = `translate(-50%, -50%)`;
    btn.style.transform = transform;
    btn.style.setProperty("--day-transform", transform);

    if (day === today && !completed) {
      btn.addEventListener("click", openModal);
    }

    dayRing.appendChild(btn);
  }
}

function renderStats(now) {
  const entries = entriesForCurrentMonth();
  const data = getUserData();

  socialDaysBig.textContent = entries.length;
  statSocialDays.textContent = entries.length;

  const newPeople = entries.filter(entry => entry.category === "new-person").length;
  const professional = entries.filter(entry => entry.category === "professional").length;
  statNewPeople.textContent = newPeople;
  statProfessional.textContent = professional;

  let streak = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let cursor = new Date(today); ; cursor.setDate(cursor.getDate() - 1)) {
    if (cursor.getMonth() !== now.getMonth()) break;
    const key = keyForDate(cursor);
    if (data[key]) streak++;
    else break;
  }

  statStreak.textContent = streak;
}

function renderRecent() {
  const entries = entriesForCurrentMonth().slice().reverse().slice(0, 5);
  recentList.innerHTML = "";

  if (!entries.length) {
    recentList.innerHTML = `<div class="recent-empty">No check-ins yet. Your first social day will appear here.</div>`;
    return;
  }

  const iconMap = {
    social: "☕",
    professional: "💼",
    "new-person": "✨",
    event: "🎟"
  };

  const labelMap = {
    social: "Social",
    professional: "Professional",
    "new-person": "New person",
    event: "Event"
  };

  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "recent-item";

    const d = new Date(`${entry.dateKey}T12:00:00`);
    const shortDate = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

    row.innerHTML = `
      <div class="recent-icon">${iconMap[entry.category] || "●"}</div>
      <div class="recent-copy">
        <strong>${labelMap[entry.category] || entry.category}</strong>
        <span>${escapeHTML(entry.note || "Meaningful interaction logged")}</span>
      </div>
      <div class="recent-date">${shortDate}</div>
    `;
    recentList.appendChild(row);
  });
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function openModal() {
  const data = getUserData();
  const todayKey = keyForDate(new Date());
  if (data[todayKey]) return;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  note.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  checkInForm.reset();
  charCount.textContent = "0";
}

checkInBtn.addEventListener("click", openModal);

document.querySelectorAll("[data-close-modal]").forEach(el => {
  el.addEventListener("click", closeModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

note.addEventListener("input", () => {
  charCount.textContent = note.value.length;
});

checkInForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(checkInForm);
  const category = formData.get("category");
  const today = new Date();
  const todayKey = keyForDate(today);
  const data = getUserData();

  if (data[todayKey]) {
    closeModal();
    renderDashboard();
    return;
  }

  data[todayKey] = {
    category,
    note: note.value.trim(),
    createdAt: new Date().toISOString()
  };

  saveUserData(data);
  closeModal();
  renderDashboard();
});

window.addEventListener("resize", () => {
  if (!dashboardView.classList.contains("hidden")) {
    renderRing(new Date(), daysInMonth(new Date()));
  }
});

(function init() {
  const session = getJSON(STORAGE_SESSION, null);
  if (session?.email) {
    openDashboard(session.email);
  }
})();
