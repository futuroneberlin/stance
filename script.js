// script.js - replace the file with this content
const SUPABASE_URL = "https://ijtvuoiszkdrcmathlhf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdHZ1b2lzemtkcmNtYXRobGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU3NTIsImV4cCI6MjA5MjAwMTc1Mn0.phxMT0pYo0muJeXeSjX_bxnYcI2p-Tebm4AgterlhTQ";

if (!window.supabase) {
  console.error("Supabase client library not loaded.");
}
let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const createClient = window.supabase?.createClient;
  if (typeof createClient !== "function") return null;
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (err) {
    console.error("Supabase client init failed.", err);
    return null;
  }
}
async function waitForSupabaseClient(timeoutMs = 1500) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const client = getSupabaseClient();
    if (client) return client;
    await new Promise(r => setTimeout(r, 50));
  }
  return null;
}

const THROTTLE_MS = 20_000;
const LAST_POST_KEY = "futurone:lastPostAt";
const HAS_SUBMITTED_KEY = "futurone:hasSubmitted";

const form = document.getElementById("stanceForm");
const input = document.getElementById("inputField");
const chapterHidden = document.getElementById("chapter");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");

const submitPanel = document.getElementById("submitPanel");
const glossaryPanel = document.getElementById("glossaryPanel");
const marketEl = document.getElementById("market");
const singleEl = document.getElementById("single");
const tabsEl = document.getElementById("tabs");

let pollTimer = null;
let latestCache = [];
let lastSeenIds = new Set();
let activeCategory = "all";

/* UI helpers */
function setStartMode(isStart){
  document.body.classList.toggle("isStart", !!isStart);
  // keep only one visible
  if (isStart){
    submitPanel.classList.remove("isHidden");
    glossaryPanel.classList.add("isHidden");
  }
}
function showGlossaryPanel(){
  setStartMode(false);
  submitPanel.classList.add("isHidden");
  glossaryPanel.classList.remove("isHidden");
}
function showSubmitPanel(){
  setStartMode(true);
  glossaryPanel.classList.add("isHidden");
  submitPanel.classList.remove("isHidden");
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* category detection from user text */
function deriveCategoryFromText(text) {
  const t = (text || "").trim();
  const m = t.match(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i);
  if (m) return m[1].trim().toLowerCase().replace(/\s+/g, "-");
  const h = t.match(/#([a-z0-9][a-z0-9_-]{0,24})/i);
  if (h) return h[1].toLowerCase();
  return "general";
}
function stripCategoryPrefix(text = ""){
  return (text || "").replace(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i, "").trim();
}

/* time formatting */
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatTimestampFull(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

/* status / throttle */
function setStatus(msg){
  if (!statusEl) return;
  statusEl.textContent = msg || "";
}
let glossaryNoticeEl = null;
function setGlossaryNotice(msg){
  if (!glossaryNoticeEl){
    glossaryNoticeEl = document.getElementById("glossaryNotice");
  }
  if (!glossaryNoticeEl){
    glossaryNoticeEl = document.createElement("p");
    glossaryNoticeEl.id = "glossaryNotice";
    glossaryNoticeEl.className = "status";
    glossaryNoticeEl.style.margin = "10px 0 0";
    glossaryPanel.prepend(glossaryNoticeEl);
  }
  glossaryNoticeEl.textContent = msg || "";
  glossaryNoticeEl.classList.toggle("isHidden", !msg);
}
function canPostNow() {
  const last = Number(localStorage.getItem(LAST_POST_KEY) || "0");
  return (Date.now() - last) >= THROTTLE_MS;
}
function msUntilNextPost() {
  const last = Number(localStorage.getItem(LAST_POST_KEY) || "0");
  return Math.max(0, THROTTLE_MS - (Date.now() - last));
}
function setLastPostNow(){ localStorage.setItem(LAST_POST_KEY, String(Date.now())); }
function setHasSubmitted(){ localStorage.setItem(HAS_SUBMITTED_KEY, "true"); }
function hasSubmittedBefore(){ return localStorage.getItem(HAS_SUBMITTED_KEY) === "true"; }

function startThrottleUI(){
  const tick = () => {
    const rem = msUntilNextPost();
    if (rem > 0){
      submitBtn.disabled = true;
      setStatus(`Please wait ${Math.ceil(rem/1000)}s before posting again.`);
    } else {
      submitBtn.disabled = false;
      if (statusEl.textContent?.startsWith("Please wait")) setStatus("");
    }
  };
  tick();
  setInterval(tick, 300);
}

/* Supabase fetch */
async function fetchEntries(){
  const client = await waitForSupabaseClient();
  if (!client) throw new Error("Supabase client missing.");
  const { data, error } = await client
    .from("entries")
    .select("id, text, chapter, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

/* rendering */
function uniqueCategories(entries){
  const set = new Set(entries.map(e => e.chapter).filter(Boolean));
  return ["all", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
}
function computeNewIds(prevSet, entries){
  const out = new Set();
  for (const e of (entries||[])){
    if (!prevSet.has(e.id)) out.add(e.id);
  }
  return out;
}
function rowHTML(e, isNew){
  return `
    <div class="rowItem ${isNew ? "isNew" : ""}" data-id="${e.id}" title="${escapeHtml(formatTimestampFull(e.created_at))}">
      <div class="ts">${escapeHtml(formatTime(e.created_at))}</div>
      <div class="msg">${escapeHtml(stripCategoryPrefix(e.text))}</div>
    </div>
  `;
}
function groupByCategory(entries){
  const map = new Map();
  for (const e of entries){
    const c = e.chapter || "general";
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(e);
  }
  return map;
}

function renderTerminal(category, items, newIdsSet){
  const rows = (items.slice(0,60).map(e => rowHTML(e, newIdsSet.has(e.id))).join("") ||
    `<div class="rowItem"><div class="ts">—</div><div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div></div>`);
  return `
    <section class="term">
      <div class="termHead">
        <div class="ch">${escapeHtml(category)}</div>
        <div class="count">${items.length}</div>
      </div>
      <div class="cols"><div>Time</div><div>Action</div></div>
      <div class="rows">${rows}</div>
    </section>
  `;
}

function renderMarket(entries){
  const newIds = computeNewIds(lastSeenIds, entries);
  const byCat = groupByCategory(entries);
  const seen = new Set();
  const orderedCats = [];
  for (const e of entries){
    const c = e.chapter || "general";
    if (!seen.has(c)){ seen.add(c); orderedCats.push(c); }
  }
  const catsToShow = orderedCats.slice(0,6);
  marketEl.innerHTML = catsToShow.map(c => {
    const items = byCat.get(c) || [];
    return renderTerminal(c, items, newIds);
  }).join("");
  lastSeenIds = new Set(entries.map(e => e.id));
}

function renderSingle(entries, category){
  const newIds = computeNewIds(lastSeenIds, entries);
  const filtered = (entries || []).filter(e => (e.chapter || "general") === category);
  singleEl.innerHTML = filtered.slice(0,140).map(e => rowHTML(e, newIds.has(e.id))).join("") ||
    `<div class="rowItem"><div class="ts">—</div><div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div></div>`;
  lastSeenIds = new Set(entries.map(e => e.id));
}

function renderTabs(entries){
  const cats = uniqueCategories(entries);
  tabsEl.innerHTML = cats.map(c => `
    <button class="tab ${c===activeCategory ? "isActive":""}" data-cat="${escapeHtml(c)}" type="button">
      ${escapeHtml(c)}
    </button>
  `).join("");
  tabsEl.querySelectorAll(".tab").forEach(btn=>{
    btn.onclick = () => { activeCategory = btn.dataset.cat; updateView(latestCache); };
  });
}

function updateView(entries){
  try{
    renderTabs(entries);
    if (activeCategory === "all"){
      singleEl.classList.add("isHidden");
      marketEl.classList.remove("isHidden");
      renderMarket(entries);
    } else {
      marketEl.classList.add("isHidden");
      singleEl.classList.remove("isHidden");
      renderSingle(entries, activeCategory);
    }
  } catch(err){
    console.error("updateView failed:", err);
  }
}

/* polling */
function startPolling(){
  if (pollTimer) return;
  pollTimer = setInterval(async ()=>{
    try{
      const data = await fetchEntries();
      if (!data) return;
      if (data.length && latestCache.length && data[0].id === latestCache[0].id) return;
      latestCache = data;
      updateView(latestCache);
    } catch(e){
      console.error("poll error", e);
    }
  }, 4000);
}

/* show/hide glossary */
async function showGlossary(){
  showGlossaryPanel();
  try{
    latestCache = await fetchEntries();
    lastSeenIds = new Set(latestCache.map(e=>e.id));
    updateView(latestCache);
    setStatus("");
    setGlossaryNotice("");
  } catch(err){
    console.error("showGlossary error", err);
    if (latestCache.length) {
      updateView(latestCache);
      setGlossaryNotice("Could not refresh glossary. Showing cached entries.");
    } else {
      updateView([]);
      setGlossaryNotice("Could not load glossary yet. Retrying in background…");
    }
  }
  startPolling();
}

/* submit handler */
let sending = false;
form.addEventListener("submit", async (ev)=>{
  ev.preventDefault();
  if (sending) return;
  const text = (input.value || "").trim();
  if (!text) return;
  if (!canPostNow()){
    setStatus(`Please wait ${Math.ceil(msUntilNextPost()/1000)}s before posting again.`);
    return;
  }
  const chapter = deriveCategoryFromText(text);
  chapterHidden.value = chapter;
  submitBtn.disabled = true;
  sending = true;
  setStatus("Submitting…");
  try{
    const client = await waitForSupabaseClient(3000);
    if (!client) throw new Error("Supabase client not available (are you testing via file://?).");
    const { error } = await client.from("entries").insert([{ text, chapter }]);
    if (error) throw error;
    setLastPostNow();
    setHasSubmitted();
    input.value = "";
    setStatus("");
    await showGlossary();
  } catch(err){
    console.error("submit failed", err);
    setStatus("Submit failed. See console.");
    submitBtn.disabled = false;
  } finally {
    sending = false;
  }
});

/* init */
startThrottleUI();
setStartMode(true);

if (hasSubmittedBefore()){
  // try to open glossary automatically
  showGlossary().catch(e=>{
    console.error(e);
    showGlossaryPanel();
    setStatus("Could not load glossary yet. Retrying in background…");
  });
}
