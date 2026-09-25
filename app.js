/* Highlife v4 — Supabase-backed real accounts, friendships and circles */

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
const CHALLENGES = [
  "Start one conversation today that you would not have started otherwise.",
  "Message one person you have been meaning to reconnect with.",
  "Ask someone a follow-up question instead of ending at small talk.",
  "Introduce yourself to someone you have seen before but never spoken to.",
  "Invite someone to grab a coffee, lunch or a short walk.",
  "Speak to one person outside your usual group today.",
  "Ask someone what they are currently building, studying or working on."
];

const $ = id => document.getElementById(id);

const state = {
  authMode: "register",
  passwordRecovery: false,
  user: null,
  profile: null,
  route: "circle",
  selectedMonth: startOfMonth(new Date()),
  historyYear: new Date().getFullYear(),
  monthCache: new Map(),
  friends: [],
  incomingRequests: [],
  networkRows: [],
  animateDateKey: null,
  animateSlotIndex: null,
  lastObservedDay: keyForDate(new Date())
};

const cfg = window.HIGHLIFE_CONFIG || {};
const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !String(cfg.SUPABASE_URL).includes("YOUR_") &&
  !String(cfg.SUPABASE_PUBLISHABLE_KEY).includes("YOUR_");

const db = configured
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

function startOfMonth(date){ return new Date(date.getFullYear(),date.getMonth(),1); }
function addMonths(date,n){ return new Date(date.getFullYear(),date.getMonth()+n,1); }
function isSameMonth(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }
function isAfterMonth(a,b){ return startOfMonth(a).getTime()>startOfMonth(b).getTime(); }
function daysInMonth(date){ return new Date(date.getFullYear(),date.getMonth()+1,0).getDate(); }
function keyForDate(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function monthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function monthEndKey(date){ return keyForDate(new Date(date.getFullYear(),date.getMonth()+1,0)); }
function normalizeEmail(v){ return String(v||"").trim().toLowerCase(); }
function nameFromEmail(email){ return (email||"Highlife").split("@")[0].replace(/[._-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase()); }
function initials(name,email=""){
  const value=(name||nameFromEmail(email)).trim();
  const parts=value.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0]||"H")+(parts[1]?.[0]||"")).toUpperCase();
}
function escapeHTML(v){ const d=document.createElement("div");d.textContent=v??"";return d.innerHTML; }
function setMessage(el,text,type="error"){
  el.textContent=text||"";
  el.style.color=type==="success"?"#1f8068":type==="info"?"#627c74":"#a44848";
}
function currentMonthDate(){ return startOfMonth(new Date()); }

const authView=$("authView");
const appView=$("appView");
const authForm=$("authForm");
const authMessage=$("authMessage");
const authSubmit=$("authSubmit");
const displayNameWrap=$("displayNameWrap");
const displayNameInput=$("displayName");
const discoverableWrap=$("discoverableWrap");
const discoverableOptIn=$("discoverableOptIn");
const forgotPasswordBtn=$("forgotPasswordBtn");
const googleAuthBtn=$("googleAuthBtn");
const oauthArea=$("oauthArea");
const authTabs=[...document.querySelectorAll(".auth-tab")];

function showConfigState(){
  if(configured) return;
  $("configBanner").classList.remove("hidden");
  authSubmit.disabled=true;
  googleAuthBtn.disabled=true;
  setMessage(authMessage,"Connect Supabase first. The setup file is included in this download.","info");
}

function setAuthMode(mode){
  if(state.passwordRecovery) return;

  state.authMode=mode;
  $("authTabs").classList.remove("hidden");
  $("authModeSwitch").classList.remove("hidden");
  oauthArea.classList.remove("hidden");
  $("email").classList.remove("hidden");

  const emailLabel=document.querySelector('label[for="email"]');
  if(emailLabel) emailLabel.classList.remove("hidden");

  $("password").placeholder="At least 6 characters";

  authTabs.forEach(t=>{
    const active=t.dataset.tab===mode;
    t.classList.toggle("active",active);
    t.setAttribute("aria-selected",active ? "true" : "false");
  });

  const register=mode==="register";
  displayNameWrap.classList.toggle("hidden",!register);
  discoverableWrap.classList.toggle("hidden",!register);
  forgotPasswordBtn.classList.toggle("hidden",register);

  $("authHeading").textContent=register?"Create your account":"Welcome back";
  $("authSubheading").textContent=register
    ?"Your circle will be stored securely and follow you across devices."
    :"Log in with the email and password you used to create Highlife.";

  authSubmit.textContent=register?"Create my Highlife":"Log in";
  $("password").autocomplete=register?"new-password":"current-password";

  $("authModePrompt").textContent=register?"Already have an account?":"New to Highlife?";
  $("authModeSwitchBtn").textContent=register?"Log in":"Create account";

  setMessage(authMessage,"");
}

authTabs.forEach(t=>{
  t.addEventListener("click",()=>{
    if(!state.passwordRecovery) setAuthMode(t.dataset.tab);
  });
});

$("authModeSwitchBtn").addEventListener("click",()=>{
  if(state.passwordRecovery) return;
  setAuthMode(state.authMode==="register" ? "login" : "register");
});

$("togglePasswordBtn").addEventListener("click",()=>{
  const p=$("password");
  p.type=p.type==="password"?"text":"password";
  $("togglePasswordBtn").textContent=p.type==="password"?"Show":"Hide";
});

authForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!db) return;
  authSubmit.disabled=true;
  try{
    const email=normalizeEmail($("email").value);
    const password=$("password").value;

    if(state.passwordRecovery){
      if(password.length<6) throw new Error("Use at least 6 characters.");
      const {error}=await db.auth.updateUser({password});
      if(error) throw error;
      state.passwordRecovery=false;
      const {data:userData}=await db.auth.getUser();
      if(userData.user) await openApp(userData.user);
      return;
    }

    if(state.authMode==="register"){
      const displayName=displayNameInput.value.trim();
      if(displayName.length<2) throw new Error("Please add your name.");
      if(password.length<6) throw new Error("Use at least 6 characters.");
      const {data,error}=await db.auth.signUp({
        email,password,
        options:{
          emailRedirectTo: window.location.origin + window.location.pathname,
          data:{ display_name:displayName, discoverable:discoverableOptIn.checked }
        }
      });
      if(error) throw error;
      if(data.session){
        setMessage(authMessage,"Account created. Opening Highlife…","success");
      }else{
        setMessage(authMessage,"Check your inbox to confirm your email, then log in.","success");
      }
    }else{
      const {error}=await db.auth.signInWithPassword({email,password});
      if(error) throw error;
    }
  }catch(err){
    setMessage(authMessage,err.message||"Something went wrong.");
  }finally{
    authSubmit.disabled=false;
  }
});

googleAuthBtn.addEventListener("click",async()=>{
  if(!db) return;
  googleAuthBtn.disabled=true;
  const {error}=await db.auth.signInWithOAuth({
    provider:"google",
    options:{ redirectTo:window.location.origin + window.location.pathname }
  });
  if(error){
    setMessage(authMessage,error.message);
    googleAuthBtn.disabled=false;
  }
});

forgotPasswordBtn.addEventListener("click",async()=>{
  if(!db) return;
  const email=normalizeEmail($("email").value);
  if(!email){ setMessage(authMessage,"Enter your email first, then choose “Forgot password?”."); return; }
  forgotPasswordBtn.disabled=true;
  const {error}=await db.auth.resetPasswordForEmail(email,{
    redirectTo:window.location.origin + window.location.pathname
  });
  forgotPasswordBtn.disabled=false;
  if(error) setMessage(authMessage,error.message);
  else setMessage(authMessage,"Password reset email sent. Check your inbox.","success");
});

function enterPasswordRecovery(){
  state.passwordRecovery=true;
  $("authTabs").classList.add("hidden");
  $("authModeSwitch").classList.add("hidden");
  displayNameWrap.classList.add("hidden");
  discoverableWrap.classList.add("hidden");
  forgotPasswordBtn.classList.add("hidden");
  oauthArea.classList.add("hidden");
  $("authHeading").textContent="Choose a new password";
  $("authSubheading").textContent="Enter a new password for your Highlife account.";
  const emailLabel=document.querySelector('label[for="email"]');
  if(emailLabel) emailLabel.classList.add("hidden");
  $("email").classList.add("hidden");
  $("password").value="";
  $("password").placeholder="New password";
  authSubmit.textContent="Update password";
}

$("logoutBtn").addEventListener("click",async()=>{
  if(db) await db.auth.signOut();
});

async function getOwnProfile(){
  const {data,error}=await db.from("profiles")
    .select("id,email,display_name,discoverable,created_at")
    .eq("id",state.user.id)
    .single();
  if(error) throw error;
  return data;
}

async function openApp(user){
  state.user=user;
  state.selectedMonth=currentMonthDate();
  state.historyYear=new Date().getFullYear();
  state.monthCache.clear();
  state.profile=await getOwnProfile();

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  $("accountName").textContent=state.profile.display_name;
  $("accountEmail").textContent=state.profile.email;
  $("accountAvatar").textContent=initials(state.profile.display_name,state.profile.email);
  $("mobileAvatar").textContent=initials(state.profile.display_name,state.profile.email);
  $("discoverabilityToggle").checked=!!state.profile.discoverable;

  await maybeMigrateLegacyInteractions();
  navigate("circle");
  refreshFriendBadge();
}

function closeApp(){
  state.user=null;state.profile=null;state.monthCache.clear();state.friends=[];state.incomingRequests=[];state.networkRows=[];
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  if(!state.passwordRecovery) setAuthMode("login");
}

async function maybeMigrateLegacyInteractions(){
  const marker=`highlife_supabase_migrated_${state.user.id}`;
  if(localStorage.getItem(marker)) return;
  try{
    const legacy=JSON.parse(localStorage.getItem("circleup_data_v1")||"{}");
    const mine=legacy[state.profile.email];
    if(!mine || typeof mine!=="object"){ localStorage.setItem(marker,"none"); return; }

    const {count,error:countError}=await db.from("interactions")
      .select("id",{count:"exact",head:true})
      .eq("user_id",state.user.id);
    if(countError) throw countError;
    if((count||0)>0){ localStorage.setItem(marker,"skipped"); return; }

    const rows=[];
    for(const [dateKey,raw] of Object.entries(mine)){
      const arr=Array.isArray(raw)?raw:[raw];
      arr.slice(0,MAX_INTERACTIONS_PER_DAY).forEach(entry=>{
        if(!entry || typeof entry!=="object") return;
        rows.push({
          user_id:state.user.id,
          interaction_date:dateKey,
          category:["social","professional","new-person","event"].includes(entry.category)?entry.category:"social",
          note:String(entry.note||"").slice(0,160) || null,
          created_at:entry.createdAt || new Date(`${dateKey}T12:00:00`).toISOString()
        });
      });
    }
    if(rows.length){
      const {error}=await db.from("interactions").insert(rows);
      if(error) throw error;
    }
    localStorage.setItem(marker,"done");
  }catch(err){
    console.warn("Legacy migration skipped:",err);
  }
}

function navigate(route){
  state.route=route;
  document.querySelectorAll(".route-view").forEach(v=>v.classList.add("hidden"));
  $(`route-${route}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.route===route));
  closeMobileSidebar();
  if(route==="circle") renderCircle();
  if(route==="friends") renderFriends();
  if(route==="iceberg") renderIceberg();
  if(route==="history") renderHistory();
}
document.querySelectorAll("[data-route]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.route)));

async function loadOwnMonth(date,force=false){
  const key=monthKey(date);
  if(!force && state.monthCache.has(key)) return state.monthCache.get(key);
  const start=keyForDate(startOfMonth(date));
  const end=monthEndKey(date);
  const {data,error}=await db.from("interactions")
    .select("id,user_id,interaction_date,category,note,created_at")
    .eq("user_id",state.user.id)
    .gte("interaction_date",start)
    .lte("interaction_date",end)
    .order("interaction_date",{ascending:true})
    .order("created_at",{ascending:true});
  if(error) throw error;
  state.monthCache.set(key,data||[]);
  return data||[];
}
function groupByDay(rows){
  return rows.reduce((acc,row)=>{
    (acc[row.interaction_date] ||= []).push(row);
    return acc;
  },{});
}

async function renderCircle(){
  try{
    const now=new Date();
    const selected=state.selectedMonth;
    const current=isSameMonth(selected,now);
    const rows=await loadOwnMonth(selected);
    const grouped=groupByDay(rows);

    $("monthTitle").textContent=selected.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
    $("nextMonthBtn").disabled=current;
    $("currentMonthBtn").textContent=current?"Current month":"Back to current";
    $("dailyChallenge").textContent=CHALLENGES[(now.getDate()+now.getMonth())%CHALLENGES.length];

    renderCircleRing(selected,grouped,now);
    renderCircleStats(selected,rows,grouped,now);
    renderRecent(selected,rows);

    if(current){
      const todayRows=grouped[keyForDate(now)]||[];
      $("centerKicker").textContent="TODAY";
      $("todayCount").textContent=todayRows.length;
      $("todaySuffix").textContent=`/${MAX_INTERACTIONS_PER_DAY}`;
      $("monthInteractionLabel").textContent=`${rows.length} interaction${rows.length===1?"":"s"} this month`;
      $("checkInBtn").classList.remove("hidden");
      $("openCheckInHeader").classList.remove("hidden");
      const full=todayRows.length>=MAX_INTERACTIONS_PER_DAY;

      // Keep the manager accessible even when all four slots are full.
      $("checkInBtn").disabled=false;
      $("openCheckInHeader").disabled=false;
      $("checkInBtn").innerHTML=full?"<span></span>Manage today":"<span></span>Add interaction";
      $("openCheckInHeader").textContent=full?"Manage today's interactions":"+ Add interaction";

      // Make correction/deletion impossible to miss whenever today has data.
      $("editTodayBtn").classList.toggle("hidden", todayRows.length===0);
    }else{
      $("centerKicker").textContent="MONTH TOTAL";
      $("todayCount").textContent=rows.length;
      $("todaySuffix").textContent=" highlights";
      $("monthInteractionLabel").textContent=`${Object.keys(grouped).length} social day${Object.keys(grouped).length===1?"":"s"}`;
      $("checkInBtn").classList.add("hidden");
      $("openCheckInHeader").classList.add("hidden");
      $("editTodayBtn").classList.add("hidden");
    }
  }catch(err){ console.error(err); }
}

function renderCircleRing(selected,grouped,now){
  const ring=$("dayRing");ring.innerHTML="";
  const totalDays=daysInMonth(selected);
  const current=isSameMonth(selected,now);
  const radius=window.innerWidth<=620?42.5:44.2;
  for(let day=1;day<=totalDays;day++){
    const date=new Date(selected.getFullYear(),selected.getMonth(),day);
    const key=keyForDate(date);
    const entries=grouped[key]||[];
    const angle=(day-1)/totalDays*360-90, rad=angle*Math.PI/180;
    const item=document.createElement("button");
    item.type="button";item.className="day-item";
    item.style.left=`${50+Math.cos(rad)*radius}%`;
    item.style.top=`${50+Math.sin(rad)*radius}%`;
    item.style.transform="translate(-50%,-50%)";
    if(current && day===now.getDate()) item.classList.add("today","clickable");
    if(current && day>now.getDate()) item.classList.add("future");

    const num=document.createElement("span");num.className="day-number";num.textContent=day;item.appendChild(num);
    const slots=document.createElement("span");slots.className="interaction-slots";
    for(let i=0;i<MAX_INTERACTIONS_PER_DAY;i++){
      const slot=document.createElement("span");slot.className="interaction-slot";
      if(entries[i]){
        slot.classList.add("filled",`category-${entries[i].category}`);
        if(state.animateDateKey===key && state.animateSlotIndex===i) slot.classList.add("just-added");
      }
      slots.appendChild(slot);
    }
    item.appendChild(slots);
    if(current && day===now.getDate()) item.addEventListener("click",openCheckIn);
    ring.appendChild(item);
  }
  state.animateDateKey=null;state.animateSlotIndex=null;
}

function renderCircleStats(selected,rows,grouped,now){
  $("statInteractions").textContent=rows.length;
  $("statSocialDays").textContent=Object.keys(grouped).length;
  $("statNewPeople").textContent=rows.filter(x=>x.category==="new-person").length;
  $("statProfessional").textContent=rows.filter(x=>x.category==="professional").length;

  if(isSameMonth(selected,now)){
    let streak=0;
    const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    while(cursor.getMonth()===now.getMonth()){
      if((grouped[keyForDate(cursor)]||[]).length) streak++; else break;
      cursor.setDate(cursor.getDate()-1);
    }
    $("streakLabel").textContent="Current social streak";
    $("statStreak").textContent=`${streak} day${streak===1?"":"s"}`;
  }else{
    const active=new Set(Object.keys(grouped).map(k=>Number(k.slice(-2))));
    let best=0,run=0;
    for(let i=1;i<=daysInMonth(selected);i++){ if(active.has(i)){run++;best=Math.max(best,run)}else run=0; }
    $("streakLabel").textContent="Best streak";
    $("statStreak").textContent=`${best} day${best===1?"":"s"}`;
  }
}

function renderRecent(selected,rows){
  const list=$("recentList");list.innerHTML="";
  const now=new Date();
  const todayKey=keyForDate(now);

  $("recentTitle").textContent=isSameMonth(selected,now)?"Latest interactions":`From ${selected.toLocaleDateString("en-GB",{month:"long"})}`;
  const sorted=[...rows].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,6);

  if(!sorted.length){
    list.innerHTML='<div class="recent-empty">No interactions recorded in this month yet.</div>';
    return;
  }

  sorted.forEach(e=>{
    const row=document.createElement("div");
    const canDelete=isSameMonth(selected,now) && e.interaction_date===todayKey;
    row.className=`recent-item${canDelete?" has-delete":""}`;
    const d=new Date(`${e.interaction_date}T12:00:00`);

    row.innerHTML=`
      <div class="recent-icon" style="--item-color:${CATEGORY_COLORS[e.category]}">${CATEGORY_SHORT[e.category]}</div>
      <div class="recent-copy"><b>${CATEGORY_LABELS[e.category]}</b><span>${escapeHTML(e.note||"Meaningful interaction")}</span></div>
      <div class="recent-date">${d.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
      ${canDelete?'<button class="recent-delete-btn" type="button" title="Delete this interaction" aria-label="Delete this interaction">⌫</button>':""}`;

    if(canDelete){
      row.querySelector(".recent-delete-btn").addEventListener("click",()=>{
        deleteTodayInteraction(e.id,e);
      });
    }
    list.appendChild(row);
  });
}

$("prevMonthBtn").addEventListener("click",()=>{state.selectedMonth=addMonths(state.selectedMonth,-1);renderCircle();});
$("nextMonthBtn").addEventListener("click",()=>{const target=addMonths(state.selectedMonth,1);if(!isAfterMonth(target,currentMonthDate())){state.selectedMonth=target;renderCircle();}});
$("currentMonthBtn").addEventListener("click",()=>{state.selectedMonth=currentMonthDate();renderCircle();});

const checkInModal=$("checkInModal");
$("checkInBtn").addEventListener("click",openCheckIn);
$("openCheckInHeader").addEventListener("click",openCheckIn);
$("editTodayBtn").addEventListener("click",openCheckIn);
async function openCheckIn(){
  if(!isSameMonth(state.selectedMonth,new Date())) return;

  const rows=await loadOwnMonth(currentMonthDate());
  const todayRows=rows.filter(x=>x.interaction_date===keyForDate(new Date()));

  renderCapacity(todayRows);
  renderTodayInteractions(todayRows);
  updateCheckInFormAvailability(todayRows);

  checkInModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}

function closeCheckIn(){
  checkInModal.classList.add("hidden");
  document.body.style.overflow="";
  $("checkInForm").reset();
  $("charCount").textContent="0";
}

document.querySelectorAll("[data-close-checkin]").forEach(x=>x.addEventListener("click",closeCheckIn));
$("interactionNote").addEventListener("input",e=>$("charCount").textContent=e.target.value.length);

function renderCapacity(entries){
  const box=$("todayCapacity");
  box.innerHTML=`<span class="capacity-label">${entries.length}/${MAX_INTERACTIONS_PER_DAY} interactions today</span><div class="capacity-lines"></div>`;
  const lines=box.querySelector(".capacity-lines");

  for(let i=0;i<MAX_INTERACTIONS_PER_DAY;i++){
    const s=document.createElement("span");
    s.className="capacity-line";
    if(entries[i]) s.classList.add("filled",`category-${entries[i].category}`);
    lines.appendChild(s);
  }
}

function renderTodayInteractions(entries){
  const section=$("todayInteractionsSection");
  const list=$("todayInteractionsList");
  list.innerHTML="";

  if(!entries.length){
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  entries.forEach(entry=>{
    const row=document.createElement("div");
    row.className="today-interaction-row";
    row.style.setProperty("--interaction-color",CATEGORY_COLORS[entry.category]||CATEGORY_COLORS.social);
    row.innerHTML=`
      <span class="today-interaction-stroke"></span>
      <div class="today-interaction-copy">
        <b>${CATEGORY_LABELS[entry.category]||"Social"}</b>
        <span>${escapeHTML(entry.note||"No note added")}</span>
      </div>
      <button class="delete-interaction-btn" type="button" title="Remove interaction" aria-label="Remove interaction">Delete</button>`;

    const btn=row.querySelector(".delete-interaction-btn");
    btn.addEventListener("click",()=>deleteTodayInteraction(entry.id,entry,btn));
    list.appendChild(row);
  });
}

function updateCheckInFormAvailability(entries){
  const form=$("checkInForm");
  const previous=form.previousElementSibling;

  if(previous?.classList?.contains("manage-note")){
    previous.remove();
  }

  const full=entries.length>=MAX_INTERACTIONS_PER_DAY;
  form.classList.toggle("checkin-form-disabled",full);
  form.querySelectorAll("input,textarea,button").forEach(el=>{
    el.disabled=full;
  });

  if(full){
    const message=document.createElement("p");
    message.className="manage-note";
    message.textContent="All four slots are full. Remove one of today's highlights above if you want to replace it.";
    form.parentNode.insertBefore(message,form);
  }
}

async function deleteTodayInteraction(interactionId,interaction,button=null){
  if(!interactionId) return;

  const todayKey=keyForDate(new Date());
  if(interaction?.interaction_date && interaction.interaction_date!==todayKey){
    alert("Only today's interactions can be removed from this screen.");
    return;
  }

  const label=CATEGORY_LABELS[interaction?.category]||"interaction";
  if(!confirm(`Delete this ${label.toLowerCase()} interaction from today?`)) return;

  if(button) button.disabled=true;

  try{
    const {error}=await db.from("interactions")
      .delete()
      .eq("id",interactionId)
      .eq("user_id",state.user.id)
      .eq("interaction_date",todayKey);

    if(error) throw error;

    state.monthCache.delete(monthKey(currentMonthDate()));
    const rows=await loadOwnMonth(currentMonthDate(),true);
    const todayRows=rows.filter(x=>x.interaction_date===todayKey);

    await renderCircle();

    if(!checkInModal.classList.contains("hidden")){
      renderCapacity(todayRows);
      renderTodayInteractions(todayRows);
      updateCheckInFormAvailability(todayRows);
    }
  }catch(err){
    alert(err.message||"Could not delete this interaction.");
    if(button) button.disabled=false;
  }
}
$("checkInForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("saveInteractionBtn");btn.disabled=true;
  try{
    const now=new Date(), dateKey=keyForDate(now);
    const existing=(await loadOwnMonth(currentMonthDate())).filter(x=>x.interaction_date===dateKey);
    if(existing.length>=MAX_INTERACTIONS_PER_DAY) throw new Error("Today's four interaction slots are already full.");
    const fd=new FormData(e.currentTarget);
    const {error}=await db.from("interactions").insert({
      user_id:state.user.id,
      interaction_date:dateKey,
      category:fd.get("category"),
      note:$("interactionNote").value.trim().slice(0,160)||null
    });
    if(error) throw error;
    state.monthCache.delete(monthKey(currentMonthDate()));
    state.animateDateKey=dateKey;state.animateSlotIndex=existing.length;
    closeCheckIn();await renderCircle();
    const toast=$("interactionToast");toast.classList.remove("show");void toast.offsetWidth;toast.classList.add("show");
  }catch(err){ alert(err.message||"Could not save the interaction."); }
  finally{btn.disabled=false;}
});

/* FRIENDS — all data comes from the database */
async function refreshFriendBadge(){
  if(!db || !state.user) return;
  const {data,error}=await db.rpc("get_friends");
  if(!error){
    state.friends=data||[];
    $("friendCountBadge").textContent=state.friends.length;
  }
}

$("friendForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=normalizeEmail($("friendEmailInput").value);
  const msg=$("friendMessage");
  setMessage(msg,"");
  if(!email){setMessage(msg,"Enter an email address.");return;}
  const btn=e.currentTarget.querySelector("button[type=submit]");btn.disabled=true;
  const {data,error}=await db.rpc("send_friend_request",{target_email:email});
  btn.disabled=false;
  if(error){ setMessage(msg,error.message); return; }
  $("friendEmailInput").value="";
  const result=Array.isArray(data)?data[0]:data;
  setMessage(msg,result?.result_status==="accepted"
    ?`You and ${result.target_name} are now connected.`
    :`Request sent to ${result?.target_name||email}.`,"success");
  await renderFriends();
});

$("discoverabilityToggle").addEventListener("change",async e=>{
  const desired=e.target.checked;
  const {error}=await db.from("profiles").update({discoverable:desired}).eq("id",state.user.id);
  if(error){ e.target.checked=!desired; alert(error.message); return; }
  state.profile.discoverable=desired;
});

async function renderFriends(){
  const [friendsRes,requestsRes]=await Promise.all([
    db.rpc("get_friends"),
    db.rpc("get_incoming_friend_requests")
  ]);
  if(friendsRes.error) console.error(friendsRes.error);
  if(requestsRes.error) console.error(requestsRes.error);
  state.friends=friendsRes.data||[];
  state.incomingRequests=requestsRes.data||[];

  $("friendCountBadge").textContent=state.friends.length;
  $("connectedSummary").textContent=`${state.friends.length} connected`;
  $("discoverabilityToggle").checked=!!state.profile.discoverable;

  renderIncomingRequests();
  renderFriendCards();
}

function renderIncomingRequests(){
  const panel=$("friendRequestsPanel"),list=$("incomingRequestsList");
  if(!state.incomingRequests.length){panel.classList.add("hidden");list.innerHTML="";return;}
  panel.classList.remove("hidden");
  $("requestCountBadge").textContent=`${state.incomingRequests.length} pending`;
  list.innerHTML="";
  state.incomingRequests.forEach(req=>{
    const row=document.createElement("div");row.className="request-row";
    row.innerHTML=`
      <div class="avatar">${initials(req.display_name,req.email)}</div>
      <div class="request-person"><b>${escapeHTML(req.display_name)}</b><span>${escapeHTML(req.email)}</span></div>
      <div class="request-actions">
        <button class="request-accept" type="button">Accept</button>
        <button class="request-decline" type="button">Decline</button>
      </div>`;
    row.querySelector(".request-accept").addEventListener("click",()=>respondRequest(req.request_id,true));
    row.querySelector(".request-decline").addEventListener("click",()=>respondRequest(req.request_id,false));
    list.appendChild(row);
  });
}
async function respondRequest(id,accept){
  const {error}=await db.rpc("respond_friend_request",{request_id:id,accept_request:accept});
  if(error){alert(error.message);return;}
  await renderFriends();
}

function renderFriendCards(){
  const grid=$("friendsGrid");grid.innerHTML="";
  if(!state.friends.length){
    grid.innerHTML='<div class="db-empty"><b>No accepted friends yet.</b>Send a request above. The circle appears only after the other user accepts.</div>';
    return;
  }
  state.friends.forEach((f,index)=>{
    const accent=["#b8e98b","#ffd76f","#9cccf4","#efa9d1","#a8d8d0","#d7b6f3"][index%6];
    const card=document.createElement("article");card.className="friend-card";
    card.style.setProperty("--friend-accent",accent);card.style.setProperty("--friend-soft",`${accent}38`);
    const weekBars=Array.from({length:7},(_,i)=>{
      const filled=i<Math.min(7,Number(f.social_days||0));
      const h=7+((i*7+Number(f.month_interactions||0)*3)%25);
      return `<span class="${filled?"filled":""}" style="height:${h}px"></span>`;
    }).join("");
    card.innerHTML=`
      <div class="friend-card-top">
        <div class="avatar">${initials(f.display_name,f.email)}</div>
        <div class="friend-card-copy">
          <b>${escapeHTML(f.display_name)}</b>
          <span>${escapeHTML(f.email)}</span>
          <small class="friend-real-badge"><i></i>Accepted Highlife account</small>
        </div>
      </div>
      <div class="friend-mini-progress">${weekBars}</div>
      <div class="friend-card-stats">
        <span><strong>${f.month_interactions||0}</strong>month highlights</span>
        <span><strong>${f.social_days||0}</strong>social days</span>
        <span><strong>${f.second_degree_count||0}</strong>network links</span>
      </div>
      <div class="friend-card-actions">
        <button class="friend-view-btn" type="button">View real circle</button>
        <button class="friend-remove-btn" type="button">Remove</button>
      </div>`;
    card.querySelector(".friend-view-btn").addEventListener("click",()=>openFriendCircle(f));
    card.querySelector(".friend-remove-btn").addEventListener("click",()=>removeFriend(f,card));
    grid.appendChild(card);
  });
}

async function removeFriend(friend,card){
  if(!confirm(`Remove ${friend.display_name} from your Highlife friends?`)) return;
  card.classList.add("pending-removal");
  const {error}=await db.rpc("remove_friend",{friend_id:friend.friend_id});
  if(error){card.classList.remove("pending-removal");alert(error.message);return;}
  await renderFriends();
}

const friendCircleModal=$("friendCircleModal");
async function openFriendCircle(friend){
  const monthStart=keyForDate(currentMonthDate());
  const {data,error}=await db.rpc("get_friend_circle",{friend_id:friend.friend_id,month_start:monthStart});
  if(error){alert(error.message);return;}
  const rows=data||[];
  const activeDays=[...new Set(rows.map(x=>Number(String(x.interaction_date).slice(-2))))];
  $("friendCircleAvatar").textContent=initials(friend.display_name,friend.email);
  $("friendCircleTitle").textContent=friend.display_name;
  $("friendCircleEmail").textContent=friend.email;
  $("friendCircleInteractions").textContent=rows.length;
  $("friendCircleDays").textContent=activeDays.length;
  $("friendCircleGrowth").textContent=`${Math.round(new Date().getDate()/daysInMonth(new Date())*100)}%`;
  $("friendMiniTotal").textContent=rows.length;

  const ring=$("friendMiniRing");ring.innerHTML="";
  const total=daysInMonth(new Date());
  for(let d=1;d<=total;d++){
    const a=(d-1)/total*360-90,r=a*Math.PI/180;
    const dot=document.createElement("span");dot.className="friend-mini-day";
    if(activeDays.includes(d)) dot.classList.add("active");
    dot.style.left=`${50+Math.cos(r)*46}%`;dot.style.top=`${50+Math.sin(r)*46}%`;
    ring.appendChild(dot);
  }
  friendCircleModal.classList.remove("hidden");document.body.style.overflow="hidden";
}
function closeFriendCircle(){friendCircleModal.classList.add("hidden");document.body.style.overflow="";}
document.querySelectorAll("[data-close-friend-circle]").forEach(x=>x.addEventListener("click",closeFriendCircle));

/* ICEBERG — only accepted friendships and real second-degree edges */
async function renderIceberg(){
  const {data,error}=await db.rpc("get_network_graph");
  if(error){console.error(error);return;}
  state.networkRows=data||[];
  const direct=state.networkRows.filter(x=>Number(x.degree)===1);
  const second=state.networkRows.filter(x=>Number(x.degree)===2);
  const reach=direct.length+second.length;

  $("networkReach").textContent=reach;
  $("directFriendCount").textContent=direct.length;
  $("secondDegreeCount").textContent=second.length;
  $("potentialIntroCount").textContent=second.filter(x=>!x.is_private).length;
  $("icebergGrowthLabel").textContent=reach===0?"Start your iceberg":reach<6?"Small network":reach<13?"Growing network":reach<24?"Expanding network":"Wide network";

  if(reach===0){
    $("networkInsightTitle").textContent="Start with one real connection";
    $("networkInsightText").textContent="Once a friend accepts your request, their accepted relationships can begin to reveal the network beneath your circle.";
  }else if(second.some(x=>x.is_private)){
    $("networkInsightTitle").textContent="Some connections stay private";
    $("networkInsightText").textContent="Highlife counts private second-degree links without revealing the person's identity unless they opt in to network discovery.";
  }else{
    $("networkInsightTitle").textContent="Your network has depth";
    $("networkInsightText").textContent="Every node here comes from an accepted Highlife friendship. No connections are generated.";
  }

  drawIceberg(direct,second);
}

function drawIceberg(friends,seconds){
  const shape=$("icebergShape"),edges=$("networkEdges"),nodes=$("networkNodes");
  shape.innerHTML="";edges.innerHTML="";nodes.innerHTML="";
  const reach=friends.length+seconds.length,cx=450,topY=120,surfaceY=186;
  const width=290+Math.min(260,reach*9),depth=260+Math.min(160,reach*5);
  const left=cx-width/2,right=cx+width/2,bottomY=Math.min(580,surfaceY+depth),tipWidth=Math.max(80,width*.22);
  const poly=document.createElementNS("http://www.w3.org/2000/svg","polygon");
  poly.setAttribute("points",`${cx-tipWidth/2},${surfaceY} ${cx},${topY} ${cx+tipWidth/2},${surfaceY} ${right},${bottomY} ${cx+width*.12},${bottomY-20} ${cx},${bottomY} ${cx-width*.12},${bottomY-12} ${left},${bottomY}`);
  poly.setAttribute("fill","url(#iceGrad)");poly.setAttribute("opacity",".88");poly.setAttribute("stroke","rgba(255,255,255,.75)");poly.setAttribute("stroke-width","3");poly.setAttribute("filter","url(#softShadow)");shape.appendChild(poly);

  const points={you:{x:cx,y:topY+15}};
  const count=Math.max(1,friends.length);
  friends.forEach((f,i)=>{
    const spread=Math.min(300,100+friends.length*42);
    const x=cx-spread/2+(count===1?spread/2:(i/(count-1))*spread);
    const y=surfaceY-16+(i%2)*22;
    points[f.node_key]={x,y};
  });
  seconds.forEach((s,i)=>{
    const parent=points[s.via_friend_key]||{x:cx,y:surfaceY};
    const siblings=seconds.filter(x=>x.via_friend_key===s.via_friend_key);
    const si=siblings.findIndex(x=>x.node_key===s.node_key);
    const layer=1+(si%3), angle=(-55+si*(110/Math.max(1,siblings.length-1)))*Math.PI/180, r=105+layer*45;
    points[s.node_key]={
      x:Math.max(left+35,Math.min(right-35,parent.x+Math.sin(angle)*r)),
      y:Math.max(surfaceY+60,Math.min(bottomY-30,surfaceY+70+layer*72+(i%3)*11))
    };
  });

  const addLine=(a,b,second=false)=>{
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",a.x);line.setAttribute("y1",a.y);line.setAttribute("x2",b.x);line.setAttribute("y2",b.y);
    line.setAttribute("class",`network-edge${second?" second":""}`);edges.appendChild(line);
  };
  friends.forEach(f=>addLine(points.you,points[f.node_key]));
  seconds.forEach(s=>points[s.via_friend_key]&&addLine(points[s.via_friend_key],points[s.node_key],true));

  const addNode=(point,type,label,detail)=>{
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");g.setAttribute("class",`network-node ${type}`);g.setAttribute("transform",`translate(${point.x},${point.y})`);
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("r",type==="you"?28:type==="friend"?21:15);
    const text=document.createElementNS("http://www.w3.org/2000/svg","text");text.textContent=label;
    g.appendChild(c);g.appendChild(text);g.addEventListener("click",()=>renderNodeDetail(detail));nodes.appendChild(g);
  };
  addNode(points.you,"you",initials(state.profile.display_name,state.profile.email),{
    initials:initials(state.profile.display_name,state.profile.email),title:"You",subtitle:"Your direct circle",body:`${friends.length} accepted friends reveal ${seconds.length} second-degree connections.`
  });
  friends.forEach(f=>addNode(points[f.node_key],"friend",initials(f.display_name),{
    initials:initials(f.display_name),title:f.display_name,subtitle:"Accepted Highlife friend",body:"This connection exists because both Highlife users accepted the friendship."
  }));
  seconds.forEach(s=>addNode(points[s.node_key],"second",s.is_private?"•":initials(s.display_name),{
    initials:s.is_private?"•":initials(s.display_name),
    title:s.display_name,
    subtitle:`Connected through ${s.via_friend_name}`,
    body:s.is_private?"This person has not opted in to being identified to friends-of-friends.":"This person opted in to network discovery."
  }));
  if(!friends.length) renderNodeDetail({initials:"H",title:"Your wider network",subtitle:"No accepted friendships yet",body:"Add a real Highlife user and wait for them to accept. Nothing here will be generated."});
}
function renderNodeDetail(d){
  $("nodeDetail").innerHTML=`<div class="node-detail-avatar">${escapeHTML(d.initials)}</div><div><h3>${escapeHTML(d.title)}</h3><p><b>${escapeHTML(d.subtitle)}</b><br>${escapeHTML(d.body)}</p></div>`;
}

/* HISTORY */
$("prevYearBtn").addEventListener("click",()=>{state.historyYear--;renderHistory();});
$("nextYearBtn").addEventListener("click",()=>{if(state.historyYear<new Date().getFullYear()){state.historyYear++;renderHistory();}});
async function renderHistory(){
  const now=new Date(),year=state.historyYear;
  $("historyYear").textContent=year;$("nextYearBtn").disabled=year>=now.getFullYear();
  const start=`${year}-01-01`,end=`${year}-12-31`;
  const {data,error}=await db.from("interactions")
    .select("interaction_date,category")
    .eq("user_id",state.user.id)
    .gte("interaction_date",start).lte("interaction_date",end);
  if(error){console.error(error);return;}
  const rows=data||[],grid=$("historyGrid");grid.innerHTML="";
  for(let m=0;m<12;m++){
    const date=new Date(year,m,1),future=date>startOfMonth(now);
    const monthPrefix=monthKey(date),monthRows=rows.filter(x=>x.interaction_date.startsWith(monthPrefix));
    const activeDays=new Set(monthRows.map(x=>Number(x.interaction_date.slice(-2))));
    const card=document.createElement("article");card.className="history-card";
    if(future)card.classList.add("future");if(isSameMonth(date,now))card.classList.add("current");
    let mini="";for(let d=1;d<=Math.min(daysInMonth(date),28);d++)mini+=`<i class="${activeDays.has(d)?"active":""}"></i>`;
    card.innerHTML=`<h3>${date.toLocaleDateString("en-GB",{month:"long"})}</h3>
      <span>${isSameMonth(date,now)?"Current month":future?"Not reached yet":`${activeDays.size} social days`}</span>
      <div class="month-mini-grid">${mini}</div>
      <div class="history-card-footer"><strong>${monthRows.length}</strong><small>highlights</small></div>`;
    if(!future) card.addEventListener("click",()=>{state.selectedMonth=date;navigate("circle");});
    grid.appendChild(card);
  }
}

/* Mobile + lifecycle */
const sidebar=document.querySelector(".sidebar");
function closeMobileSidebar(){sidebar.classList.remove("mobile-open");$("mobileScrim").classList.add("hidden");}
$("mobileMenuBtn").addEventListener("click",()=>{sidebar.classList.toggle("mobile-open");$("mobileScrim").classList.toggle("hidden");});
$("mobileScrim").addEventListener("click",closeMobileSidebar);

function checkDateRollover(){
  if(!state.user)return;
  const today=keyForDate(new Date());
  if(today!==state.lastObservedDay){
    state.lastObservedDay=today;state.selectedMonth=currentMonthDate();state.monthCache.clear();
    if(state.route==="circle")renderCircle();
    if(state.route==="history")renderHistory();
    if(state.route==="friends")renderFriends();
    if(state.route==="iceberg")renderIceberg();
  }
}
setInterval(checkDateRollover,60000);
window.addEventListener("focus",checkDateRollover);
window.addEventListener("resize",()=>{if(state.user&&state.route==="circle")renderCircle();});
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  if(!checkInModal.classList.contains("hidden"))closeCheckIn();
  if(!friendCircleModal.classList.contains("hidden"))closeFriendCircle();
  closeMobileSidebar();
});

async function init(){
  showConfigState();
  setAuthMode("login");
  if(!db) return;

  db.auth.onAuthStateChange(async(event,session)=>{
    if(event==="PASSWORD_RECOVERY"){
      enterPasswordRecovery();
      authView.classList.remove("hidden");appView.classList.add("hidden");
      return;
    }
    if(session?.user && (!state.user || state.user.id!==session.user.id)){
      try{ await openApp(session.user); }catch(err){ console.error(err);setMessage(authMessage,err.message); }
    }
    if(event==="SIGNED_OUT") closeApp();
  });

  const {data}=await db.auth.getSession();
  if(data.session?.user && !state.passwordRecovery){
    try{ await openApp(data.session.user); }catch(err){ console.error(err);setMessage(authMessage,err.message); }
  }
}
init();
