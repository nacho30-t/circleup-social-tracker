// Highlife static prototype.
// Existing tracker keys are intentionally preserved so previous local data remains available.
const STORAGE_USERS = "circleup_users_v1";
const STORAGE_SESSION = "circleup_session_v1";
const STORAGE_DATA = "circleup_data_v1";
const STORAGE_FRIENDS = "highlife_friends_v2";
const MAX_INTERACTIONS_PER_DAY = 4;

const CATEGORY_LABELS = {
  social: "Social",
  professional: "Professional",
  "new-person": "New person",
  event: "Event"
};
const CATEGORY_SHORT = { social:"S", professional:"P", "new-person":"N", event:"E" };
const CATEGORY_COLORS = {
  social:"#b8e98b",
  professional:"#9cccf4",
  "new-person":"#ffd76f",
  event:"#efa9d1"
};
const FRIEND_ACCENTS = ["#b8e98b","#ffd76f","#9cccf4","#efa9d1","#a8d8d0","#d7b6f3"];
const CHALLENGES = [
  "Start one conversation today that you would not have started otherwise.",
  "Message one person you have been meaning to reconnect with.",
  "Ask someone a follow-up question instead of ending at small talk.",
  "Introduce yourself to someone you have seen before but never spoken to.",
  "Invite someone to grab a coffee, lunch or a short walk.",
  "Speak to one person outside your usual group today.",
  "Ask someone what they are currently building, studying or working on."
];

const state = {
  authMode: "register",
  email: null,
  route: "circle",
  selectedMonth: startOfMonth(new Date()),
  historyYear: new Date().getFullYear(),
  animateDateKey: null,
  animateSlotIndex: null,
  lastObservedDay: null,
  selectedFriendEmail: null
};

const $ = id => document.getElementById(id);
const authView = $("authView");
const appView = $("appView");
const authForm = $("authForm");
const authSubmit = $("authSubmit");
const authMessage = $("authMessage");
const emailInput = $("email");
const passwordInput = $("password");
const authTabs = [...document.querySelectorAll(".auth-tab")];

function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function setJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function normalizeEmail(value) { return value.trim().toLowerCase(); }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date, amount) { return new Date(date.getFullYear(), date.getMonth()+amount, 1); }
function isSameMonth(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }
function isAfterMonth(a,b) { return startOfMonth(a).getTime()>startOfMonth(b).getTime(); }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth()+1, 0).getDate(); }
function keyForDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function hashString(value) {
  let h = 2166136261;
  for (let i=0;i<value.length;i++) { h ^= value.charCodeAt(i); h = Math.imul(h,16777619); }
  return Math.abs(h >>> 0);
}
function seeded(seed, n) {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function escapeHTML(value) {
  const d = document.createElement("div");
  d.textContent = value ?? "";
  return d.innerHTML;
}
function nameFromEmail(email) {
  const raw = email.split("@")[0].replace(/[._-]+/g," ").trim();
  return raw.split(" ").filter(Boolean).map(x=>x[0]?.toUpperCase()+x.slice(1)).join(" ") || "Friend";
}
function initialsFromEmail(email) {
  const name = nameFromEmail(email);
  const parts = name.split(" ");
  return (parts[0]?.[0] || "H") + (parts[1]?.[0] || "");
}
function currentMonthDate() { return startOfMonth(new Date()); }

function setAuthMode(mode) {
  state.authMode = mode;
  authTabs.forEach(t=>t.classList.toggle("active",t.dataset.tab===mode));
  authSubmit.textContent = mode==="register" ? "Create account" : "Log in";
  authMessage.textContent = "";
}
authTabs.forEach(t=>t.addEventListener("click",()=>setAuthMode(t.dataset.tab)));

authForm.addEventListener("submit", e => {
  e.preventDefault();
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  if (!email || password.length < 6) {
    authMessage.textContent = "Please enter a valid email and a password with at least 6 characters.";
    return;
  }
  const users = getJSON(STORAGE_USERS,{});
  if (state.authMode==="register") {
    if (users[email]) {
      authMessage.textContent = "This account already exists. Try logging in.";
      return;
    }
    users[email] = { password, createdAt:new Date().toISOString() };
    setJSON(STORAGE_USERS,users);
  } else if (!users[email] || users[email].password!==password) {
    authMessage.textContent = "Incorrect email or password.";
    return;
  }
  setJSON(STORAGE_SESSION,{email});
  openApp(email);
});

$("logoutBtn").addEventListener("click",()=>{
  localStorage.removeItem(STORAGE_SESSION);
  state.email = null;
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  passwordInput.value = "";
});

function openApp(email) {
  state.email = email;
  state.route = "circle";
  state.selectedMonth = currentMonthDate();
  state.historyYear = new Date().getFullYear();
  state.lastObservedDay = keyForDate(new Date());
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  const name = nameFromEmail(email);
  $("accountEmail").textContent = email;
  $("accountName").textContent = name || "You";
  $("accountAvatar").textContent = initialsFromEmail(email);
  $("mobileAvatar").textContent = initialsFromEmail(email);
  renderFriendsBadge();
  navigate("circle");
}

function navigate(route) {
  state.route = route;
  document.querySelectorAll(".route-view").forEach(v=>v.classList.add("hidden"));
  $(`route-${route}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.route===route));
  closeMobileSidebar();
  if (route==="circle") renderCircle();
  if (route==="friends") renderFriends();
  if (route==="iceberg") renderIceberg();
  if (route==="history") renderHistory();
}
document.querySelectorAll("[data-route]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.route)));

function getAllUserData() { return getJSON(STORAGE_DATA,{}); }
function getUserData(email=state.email) { return getAllUserData()[email] || {}; }
function saveUserData(data,email=state.email) {
  const all = getAllUserData();
  all[email]=data;
  setJSON(STORAGE_DATA,all);
}
function normalizeDayEntries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw==="object") return [raw];
  return [];
}
function monthDaysWithEntries(date,email=state.email) {
  const prefix = monthKey(date);
  const data = getUserData(email);
  return Object.entries(data)
    .filter(([k])=>k.startsWith(prefix))
    .map(([dateKey,raw])=>({dateKey,entries:normalizeDayEntries(raw)}))
    .filter(x=>x.entries.length)
    .sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
}
function flatMonthEntries(date,email=state.email) {
  return monthDaysWithEntries(date,email).flatMap(day=>day.entries.map((entry,i)=>({...entry,dateKey:day.dateKey,slotIndex:i})));
}

function setSelectedMonth(date) {
  const target = startOfMonth(date);
  if (isAfterMonth(target,currentMonthDate())) return;
  state.selectedMonth = target;
  renderCircle();
}

$("prevMonthBtn").addEventListener("click",()=>setSelectedMonth(addMonths(state.selectedMonth,-1)));
$("nextMonthBtn").addEventListener("click",()=>setSelectedMonth(addMonths(state.selectedMonth,1)));
$("currentMonthBtn").addEventListener("click",()=>setSelectedMonth(currentMonthDate()));

function renderCircle() {
  const now = new Date();
  const selected = state.selectedMonth;
  const current = isSameMonth(selected,now);
  const totalDays = daysInMonth(selected);
  const entries = flatMonthEntries(selected);
  const days = monthDaysWithEntries(selected);
  $("monthTitle").textContent = selected.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  $("nextMonthBtn").disabled = current;
  $("currentMonthBtn").textContent = current ? "Current month" : "Back to current";
  $("dailyChallenge").textContent = CHALLENGES[(now.getDate()+now.getMonth())%CHALLENGES.length];
  renderCircleRing(selected,totalDays,now);
  renderCircleStats(selected,now);
  renderRecent(selected);

  if (current) {
    const todayEntries = normalizeDayEntries(getUserData()[keyForDate(now)]);
    const remaining = MAX_INTERACTIONS_PER_DAY - todayEntries.length;
    $("centerKicker").textContent = "TODAY";
    $("todayCount").textContent = todayEntries.length;
    $("todaySuffix").textContent = `/${MAX_INTERACTIONS_PER_DAY}`;
    $("monthInteractionLabel").textContent = `${entries.length} interaction${entries.length===1?"":"s"} this month`;
    $("checkInBtn").classList.remove("hidden");
    $("openCheckInHeader").classList.remove("hidden");
    $("checkInBtn").disabled = remaining<=0;
    $("openCheckInHeader").disabled = remaining<=0;
    $("checkInBtn").innerHTML = remaining<=0 ? "<span></span>Today's slots are full" : `<span></span>Add interaction`;
  } else {
    $("centerKicker").textContent = "MONTH TOTAL";
    $("todayCount").textContent = entries.length;
    $("todaySuffix").textContent = " highlights";
    $("monthInteractionLabel").textContent = `${days.length} social day${days.length===1?"":"s"}`;
    $("checkInBtn").classList.add("hidden");
    $("openCheckInHeader").classList.add("hidden");
  }
}

function renderCircleRing(selected,totalDays,now) {
  const ring = $("dayRing");
  ring.innerHTML = "";
  const data = getUserData();
  const current = isSameMonth(selected,now);
  const radius = window.innerWidth<=620 ? 42.5 : 44.2;

  for (let day=1; day<=totalDays; day++) {
    const date = new Date(selected.getFullYear(),selected.getMonth(),day);
    const key = keyForDate(date);
    const entries = normalizeDayEntries(data[key]);
    const angle = (day-1)/totalDays*360 - 90;
    const rad = angle*Math.PI/180;
    const x = 50 + Math.cos(rad)*radius;
    const y = 50 + Math.sin(rad)*radius;

    const item = document.createElement("button");
    item.type="button";
    item.className="day-item";
    item.style.left=`${x}%`;
    item.style.top=`${y}%`;
    item.style.transform="translate(-50%,-50%)";
    if (current && day===now.getDate()) item.classList.add("today","clickable");
    if (current && day>now.getDate()) item.classList.add("future");

    const num = document.createElement("span");
    num.className="day-number";
    num.textContent=day;
    item.appendChild(num);

    const slots=document.createElement("span");
    slots.className="interaction-slots";
    for (let i=0;i<MAX_INTERACTIONS_PER_DAY;i++) {
      const slot=document.createElement("span");
      slot.className="interaction-slot";
      const entry=entries[i];
      if (entry) {
        slot.classList.add("filled",`category-${entry.category||"social"}`);
        if (state.animateDateKey===key && state.animateSlotIndex===i) slot.classList.add("just-added");
      }
      slots.appendChild(slot);
    }
    item.appendChild(slots);
    if (current && day===now.getDate() && entries.length<MAX_INTERACTIONS_PER_DAY) item.addEventListener("click",openCheckIn);
    ring.appendChild(item);
  }
  state.animateDateKey=null;
  state.animateSlotIndex=null;
}

function renderCircleStats(selected,now) {
  const days = monthDaysWithEntries(selected);
  const entries = flatMonthEntries(selected);
  $("statInteractions").textContent = entries.length;
  $("statSocialDays").textContent = days.length;
  $("statNewPeople").textContent = entries.filter(e=>e.category==="new-person").length;
  $("statProfessional").textContent = entries.filter(e=>e.category==="professional").length;

  const data=getUserData();
  if (isSameMonth(selected,now)) {
    let streak=0;
    const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    while (cursor.getMonth()===now.getMonth() && cursor.getFullYear()===now.getFullYear()) {
      if (normalizeDayEntries(data[keyForDate(cursor)]).length) streak++;
      else break;
      cursor.setDate(cursor.getDate()-1);
    }
    $("streakLabel").textContent="Current social streak";
    $("statStreak").textContent=`${streak} day${streak===1?"":"s"}`;
  } else {
    const active=new Set(days.map(d=>Number(d.dateKey.slice(-2))));
    let best=0,run=0;
    for (let i=1;i<=daysInMonth(selected);i++) { if(active.has(i)){run++;best=Math.max(best,run)} else run=0; }
    $("streakLabel").textContent="Best streak";
    $("statStreak").textContent=`${best} day${best===1?"":"s"}`;
  }
}

function renderRecent(selected) {
  const list=$("recentList");
  const entries=flatMonthEntries(selected).sort((a,b)=>(b.createdAt||b.dateKey).localeCompare(a.createdAt||a.dateKey)).slice(0,6);
  list.innerHTML="";
  $("recentTitle").textContent=isSameMonth(selected,new Date())?"Latest interactions":`From ${selected.toLocaleDateString("en-GB",{month:"long"})}`;
  if (!entries.length) {
    list.innerHTML='<div class="recent-empty">No interactions recorded in this month yet.</div>';
    return;
  }
  entries.forEach(e=>{
    const row=document.createElement("div");
    row.className="recent-item";
    const d=new Date(`${e.dateKey}T12:00:00`);
    row.innerHTML=`
      <div class="recent-icon" style="--item-color:${CATEGORY_COLORS[e.category||"social"]}">${CATEGORY_SHORT[e.category||"social"]}</div>
      <div class="recent-copy"><b>${CATEGORY_LABELS[e.category||"social"]}</b><span>${escapeHTML(e.note||"Meaningful interaction")}</span></div>
      <div class="recent-date">${d.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>`;
    list.appendChild(row);
  });
}

const checkInModal=$("checkInModal");
$("checkInBtn").addEventListener("click",openCheckIn);
$("openCheckInHeader").addEventListener("click",openCheckIn);
function openCheckIn() {
  if (!isSameMonth(state.selectedMonth,new Date())) return;
  const entries=normalizeDayEntries(getUserData()[keyForDate(new Date())]);
  if (entries.length>=MAX_INTERACTIONS_PER_DAY) return;
  renderCapacity();
  checkInModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closeCheckIn() {
  checkInModal.classList.add("hidden");
  document.body.style.overflow="";
  $("checkInForm").reset();
  $("charCount").textContent="0";
}
document.querySelectorAll("[data-close-checkin]").forEach(x=>x.addEventListener("click",closeCheckIn));
$("interactionNote").addEventListener("input",e=>$("charCount").textContent=e.target.value.length);
function renderCapacity() {
  const entries=normalizeDayEntries(getUserData()[keyForDate(new Date())]);
  const box=$("todayCapacity");
  box.innerHTML=`<span class="capacity-label">${entries.length}/${MAX_INTERACTIONS_PER_DAY} interactions today</span><div class="capacity-lines"></div>`;
  const lines=box.querySelector(".capacity-lines");
  for(let i=0;i<MAX_INTERACTIONS_PER_DAY;i++){
    const s=document.createElement("span");
    s.className="capacity-line";
    if(entries[i]) s.classList.add("filled",`category-${entries[i].category||"social"}`);
    lines.appendChild(s);
  }
}
$("checkInForm").addEventListener("submit",e=>{
  e.preventDefault();
  const now=new Date();
  const key=keyForDate(now);
  const data=getUserData();
  const entries=normalizeDayEntries(data[key]);
  if(entries.length>=MAX_INTERACTIONS_PER_DAY){closeCheckIn();return}
  const fd=new FormData(e.currentTarget);
  const entry={category:fd.get("category"),note:$("interactionNote").value.trim(),createdAt:new Date().toISOString()};
  entries.push(entry);
  data[key]=entries;
  saveUserData(data);
  state.animateDateKey=key;
  state.animateSlotIndex=entries.length-1;
  closeCheckIn();
  renderCircle();
  const toast=$("interactionToast");
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
});

/* Friends */
function getFriendMap() { return getJSON(STORAGE_FRIENDS,{}); }
function getFriends(email=state.email) { return getFriendMap()[email] || []; }
function saveFriends(list,email=state.email) {
  const all=getFriendMap();
  all[email]=list;
  setJSON(STORAGE_FRIENDS,all);
}
function renderFriendsBadge() {
  const count=getFriends().length;
  $("friendCountBadge").textContent=count;
}
$("friendForm").addEventListener("submit",e=>{
  e.preventDefault();
  const friendEmail=normalizeEmail($("friendEmailInput").value);
  const msg=$("friendMessage");
  if(!friendEmail || friendEmail===state.email){msg.textContent="Enter a different valid email address.";return}
  const list=getFriends();
  if(list.some(f=>f.email===friendEmail)){msg.textContent="This person is already in your Highlife circle.";return}
  list.push({email:friendEmail,addedAt:new Date().toISOString()});
  saveFriends(list);
  $("friendEmailInput").value="";
  msg.style.color="#1f8068";
  msg.textContent=`${nameFromEmail(friendEmail)} added to your prototype circle.`;
  setTimeout(()=>{msg.textContent="";msg.style.color=""},2200);
  renderFriendsBadge();
  renderFriends();
});

function demoFriendProfile(email) {
  const seed=hashString(email);
  const now=new Date();
  const totalDays=daysInMonth(now);
  const elapsed=Math.max(1,now.getDate());
  const activeDays=[];
  for(let d=1;d<=elapsed;d++){
    const chance=.22 + seeded(seed,d)*.38;
    if(seeded(seed+11,d) < chance) activeDays.push(d);
  }
  if(!activeDays.length) activeDays.push(Math.max(1,Math.min(elapsed,(seed%elapsed)+1)));
  const interactions=activeDays.reduce((sum,d)=>sum+1+Math.floor(seeded(seed+17,d)*3),0);
  const secondDegree=2+(seed%5);
  const accent=FRIEND_ACCENTS[seed%FRIEND_ACCENTS.length];
  return {seed,name:nameFromEmail(email),initials:initialsFromEmail(email),activeDays,interactions,secondDegree,accent,totalDays};
}
function renderFriends() {
  const list=getFriends();
  $("connectedSummary").textContent=`${list.length} connected`;
  const grid=$("friendsGrid");
  grid.innerHTML="";
  if(!list.length){
    grid.innerHTML='<div class="empty-friends"><strong>No friends added yet.</strong>Add an email above and their circle will appear here.</div>';
    return;
  }
  list.forEach(friend=>{
    const p=demoFriendProfile(friend.email);
    const card=document.createElement("article");
    card.className="friend-card";
    card.style.setProperty("--friend-accent",p.accent);
    card.style.setProperty("--friend-soft",`${p.accent}38`);
    let bars="";
    for(let i=0;i<7;i++){
      const height=7+Math.round(seeded(p.seed+41,i)*26);
      const filled=seeded(p.seed+53,i)>.25;
      bars+=`<span class="${filled?"filled":""}" style="height:${height}px"></span>`;
    }
    card.innerHTML=`
      <div class="friend-card-top">
        <div class="avatar">${p.initials}</div>
        <div class="friend-card-copy"><b>${escapeHTML(p.name)}</b><span>${escapeHTML(friend.email)}</span></div>
      </div>
      <div class="friend-mini-progress">${bars}</div>
      <div class="friend-card-stats">
        <span><strong>${p.interactions}</strong>month highlights</span>
        <span><strong>${p.activeDays.length}</strong>social days</span>
        <span><strong>+${p.secondDegree}</strong>network links</span>
      </div>
      <div class="friend-card-actions">
        <button class="friend-view-btn" type="button">View circle</button>
        <button class="friend-remove-btn" type="button">Remove</button>
      </div>`;
    card.querySelector(".friend-view-btn").addEventListener("click",()=>openFriendCircle(friend.email));
    card.querySelector(".friend-remove-btn").addEventListener("click",()=>{
      saveFriends(getFriends().filter(f=>f.email!==friend.email));
      renderFriendsBadge();
      renderFriends();
    });
    grid.appendChild(card);
  });
}

const friendCircleModal=$("friendCircleModal");
function openFriendCircle(email){
  const p=demoFriendProfile(email);
  state.selectedFriendEmail=email;
  $("friendCircleAvatar").textContent=p.initials;
  $("friendCircleAvatar").style.background=`${p.accent}55`;
  $("friendCircleTitle").textContent=p.name;
  $("friendCircleEmail").textContent=email;
  $("friendCircleInteractions").textContent=p.interactions;
  $("friendCircleDays").textContent=p.activeDays.length;
  $("friendCircleGrowth").textContent=`${Math.round(new Date().getDate()/p.totalDays*100)}%`;
  $("friendMiniTotal").textContent=p.interactions;
  const ring=$("friendMiniRing");
  ring.innerHTML="";
  ring.style.setProperty("--friend-circle-color",p.accent);
  for(let d=1;d<=p.totalDays;d++){
    const a=(d-1)/p.totalDays*360-90;
    const r=a*Math.PI/180;
    const x=50+Math.cos(r)*46;
    const y=50+Math.sin(r)*46;
    const dot=document.createElement("span");
    dot.className="friend-mini-day";
    if(p.activeDays.includes(d)) dot.classList.add("active");
    dot.style.left=`${x}%`;dot.style.top=`${y}%`;
    ring.appendChild(dot);
  }
  friendCircleModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closeFriendCircle(){
  friendCircleModal.classList.add("hidden");
  document.body.style.overflow="";
}
document.querySelectorAll("[data-close-friend-circle]").forEach(x=>x.addEventListener("click",closeFriendCircle));

/* Iceberg */
function buildNetwork() {
  const friends=getFriends().map(f=>({...f,...demoFriendProfile(f.email)}));
  const seconds=[];
  friends.forEach((f,fi)=>{
    for(let i=0;i<f.secondDegree;i++){
      seconds.push({
        id:`${f.email}::${i}`,
        parentEmail:f.email,
        parentName:f.name,
        name:`${["Alex","Maya","Leo","Sofia","Nico","Emma","Luca","Clara","Sam","Marta"][(f.seed+i*7)%10]} ${String.fromCharCode(65+((f.seed+i)%26))}.`,
        initials:["A","M","L","S","N","E","L","C","S","M"][(f.seed+i*7)%10],
        strength:.25+seeded(f.seed+99,i)*.7
      });
    }
  });
  return {friends,seconds};
}
function icebergSizeLabel(reach) {
  if(reach===0) return "Start your iceberg";
  if(reach<6) return "Small network";
  if(reach<13) return "Growing network";
  if(reach<24) return "Expanding network";
  return "Wide network";
}
function renderIceberg() {
  const {friends,seconds}=buildNetwork();
  const reach=friends.length+seconds.length;
  $("networkReach").textContent=reach;
  $("directFriendCount").textContent=friends.length;
  $("secondDegreeCount").textContent=seconds.length;
  $("potentialIntroCount").textContent=Math.max(0,Math.round(seconds.length*.65));
  $("icebergGrowthLabel").textContent=icebergSizeLabel(reach);

  if(reach===0){
    $("networkInsightTitle").textContent="Start with one friend";
    $("networkInsightText").textContent="Add someone in Friends. Their circle becomes the first visible layer of your social iceberg.";
  } else if(reach<10){
    $("networkInsightTitle").textContent="Your hidden layer is forming";
    $("networkInsightText").textContent=`Your ${friends.length} direct connection${friends.length===1?"":"s"} already reveal${friends.length===1?"s":""} ${seconds.length} second-degree links.`;
  } else {
    $("networkInsightTitle").textContent="Your network has depth";
    $("networkInsightText").textContent="The iceberg is widening because each direct relationship brings its own surrounding network.";
  }

  const shape=$("icebergShape"),edges=$("networkEdges"),nodes=$("networkNodes");
  shape.innerHTML=""; edges.innerHTML=""; nodes.innerHTML="";
  const width=290+Math.min(260,reach*9);
  const depth=260+Math.min(160,reach*5);
  const cx=450;
  const topY=120;
  const surfaceY=186;
  const left=cx-width/2, right=cx+width/2;
  const bottomY=Math.min(580,surfaceY+depth);
  const tipWidth=Math.max(80,width*.22);
  const poly=document.createElementNS("http://www.w3.org/2000/svg","polygon");
  poly.setAttribute("points",`${cx-tipWidth/2},${surfaceY} ${cx},${topY} ${cx+tipWidth/2},${surfaceY} ${right},${bottomY} ${cx+width*.12},${bottomY-20} ${cx},${bottomY} ${cx-width*.12},${bottomY-12} ${left},${bottomY}`);
  poly.setAttribute("fill","url(#iceGrad)");
  poly.setAttribute("opacity",".88");
  poly.setAttribute("stroke","rgba(255,255,255,.75)");
  poly.setAttribute("stroke-width","3");
  poly.setAttribute("filter","url(#softShadow)");
  shape.appendChild(poly);

  const points={you:{x:cx,y:topY+15}};
  const friendPositions=[];
  const fCount=Math.max(1,friends.length);
  friends.forEach((f,i)=>{
    const spread=Math.min(280,90+friends.length*38);
    const x=cx-spread/2 + (fCount===1?spread/2:(i/(fCount-1))*spread);
    const y=surfaceY-16 + (i%2)*22;
    points[f.email]={x,y};
    friendPositions.push({email:f.email,x,y});
  });
  seconds.forEach((s,i)=>{
    const parent=points[s.parentEmail]||{x:cx,y:surfaceY};
    const parentIndex=friends.findIndex(f=>f.email===s.parentEmail);
    const siblings=seconds.filter(x=>x.parentEmail===s.parentEmail);
    const siblingIndex=siblings.findIndex(x=>x.id===s.id);
    const layer=1+(siblingIndex%3);
    const angleBase=(-50 + siblingIndex*(100/Math.max(1,siblings.length-1))) * Math.PI/180;
    const r=100+layer*42+parentIndex*7;
    const x=Math.max(left+35,Math.min(right-35,parent.x+Math.sin(angleBase)*r));
    const y=Math.max(surfaceY+55,Math.min(bottomY-32,surfaceY+70+layer*70+seeded(hashString(s.id),2)*45));
    points[s.id]={x,y};
  });

  function addLine(a,b,second=false){
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);
    line.setAttribute("class",`network-edge${second?" second":""}`);
    edges.appendChild(line);
  }
  friends.forEach(f=>addLine(points.you,points[f.email],false));
  seconds.forEach(s=>addLine(points[s.parentEmail],points[s.id],true));

  function addNode(point,type,label,detail){
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("class",`network-node ${type}`);
    g.setAttribute("transform",`translate(${point.x},${point.y})`);
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    const radius=type==="you"?28:type==="friend"?21:15;
    c.setAttribute("r",radius);
    const text=document.createElementNS("http://www.w3.org/2000/svg","text");
    text.textContent=label;
    g.appendChild(c);g.appendChild(text);
    g.addEventListener("click",()=>renderNodeDetail(detail));
    nodes.appendChild(g);
  }
  addNode(points.you,"you",initialsFromEmail(state.email),{
    initials:initialsFromEmail(state.email),title:"You",subtitle:"The top of your social iceberg.",body:`${friends.length} direct friends currently reveal ${seconds.length} second-degree connections.`
  });
  friends.forEach(f=>addNode(points[f.email],"friend",f.initials,{
    initials:f.initials,title:f.name,subtitle:"Direct Highlife friend",body:`Their prototype circle has ${f.interactions} highlights this month and reveals ${f.secondDegree} second-degree links.`
  }));
  seconds.forEach(s=>addNode(points[s.id],"second",s.initials,{
    initials:s.initials,title:s.name,subtitle:`Connected through ${s.parentName}`,body:"A second-degree connection: someone inside a friend's wider social circle."
  }));
  if(!friends.length) renderNodeDetail({initials:"H",title:"Your wider network",subtitle:"No connections yet",body:"Add a friend by email to start revealing the social iceberg beneath your direct circle."});
}
function renderNodeDetail(d){
  $("nodeDetail").innerHTML=`<div class="node-detail-avatar">${escapeHTML(d.initials)}</div><div><h3>${escapeHTML(d.title)}</h3><p><b>${escapeHTML(d.subtitle)}</b><br>${escapeHTML(d.body)}</p></div>`;
}

/* History */
$("prevYearBtn").addEventListener("click",()=>{state.historyYear--;renderHistory()});
$("nextYearBtn").addEventListener("click",()=>{
  if(state.historyYear<new Date().getFullYear()){state.historyYear++;renderHistory()}
});
function renderHistory() {
  const now=new Date();
  $("historyYear").textContent=state.historyYear;
  $("nextYearBtn").disabled=state.historyYear>=now.getFullYear();
  const grid=$("historyGrid");
  grid.innerHTML="";
  for(let m=0;m<12;m++){
    const date=new Date(state.historyYear,m,1);
    const future=date>startOfMonth(now);
    const entries=flatMonthEntries(date);
    const days=monthDaysWithEntries(date);
    const activeDaySet=new Set(days.map(d=>Number(d.dateKey.slice(-2))));
    const card=document.createElement("article");
    card.className="history-card";
    if(future) card.classList.add("future");
    if(isSameMonth(date,now)) card.classList.add("current");
    let mini="";
    for(let d=1;d<=Math.min(daysInMonth(date),28);d++) mini+=`<i class="${activeDaySet.has(d)?"active":""}"></i>`;
    card.innerHTML=`
      <h3>${date.toLocaleDateString("en-GB",{month:"long"})}</h3>
      <span>${isSameMonth(date,now)?"Current month":future?"Not reached yet":`${days.length} social days`}</span>
      <div class="month-mini-grid">${mini}</div>
      <div class="history-card-footer"><strong>${entries.length}</strong><small>highlights</small></div>`;
    if(!future) card.addEventListener("click",()=>{state.selectedMonth=date;navigate("circle")});
    grid.appendChild(card);
  }
}

/* Mobile */
const sidebar=document.querySelector(".sidebar");
function closeMobileSidebar(){sidebar.classList.remove("mobile-open");$("mobileScrim").classList.add("hidden")}
$("mobileMenuBtn").addEventListener("click",()=>{sidebar.classList.toggle("mobile-open");$("mobileScrim").classList.toggle("hidden")});
$("mobileScrim").addEventListener("click",closeMobileSidebar);

/* Date rollover */
function checkDateRollover(){
  if(!state.email)return;
  const today=keyForDate(new Date());
  if(state.lastObservedDay && today!==state.lastObservedDay){
    state.lastObservedDay=today;
    state.selectedMonth=currentMonthDate();
    if(state.route==="circle")renderCircle();
    if(state.route==="history")renderHistory();
    if(state.route==="friends")renderFriends();
    if(state.route==="iceberg")renderIceberg();
  }
}
setInterval(checkDateRollover,60000);
window.addEventListener("focus",checkDateRollover);
window.addEventListener("resize",()=>{if(state.email&&state.route==="circle")renderCircle()});
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  if(!checkInModal.classList.contains("hidden"))closeCheckIn();
  if(!friendCircleModal.classList.contains("hidden"))closeFriendCircle();
  closeMobileSidebar();
});

/* Init */
(function init(){
  const session=getJSON(STORAGE_SESSION,null);
  if(session?.email)openApp(session.email);
})();
