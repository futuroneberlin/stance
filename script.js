// script.js - replace the file with this content
const SUPABASE_URL = "https://ijtvuoiszkdrcmathlhf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdHZ1b2lzemtkcmNtYXRobGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU3NTIsImV4cCI6MjA5MjAwMTc1Mn0.phxMT0pYo0muJeXeSjX_bxnYcI2p-Tebm4AgterlhTQ";

if (!window.supabase) {
  console.error("Supabase client library not loaded.");
} 

const supabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);

const THROTTLE_MS = 20_000;
const LAST_POST_KEY = "futurone:lastPostAt";
const HAS_SUBMITTED_KEY = "futurone:hasSubmitted";
const ENTRIES_CACHE_KEY = "futurone:entriesCache:v1";

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
let glossaryNotice = "";

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

function getSupabaseClientOrThrow(action = "Action"){
  if (supabase) return supabase;
  const isFileProtocol = window.location?.protocol === "file:";
  const hint = isFileProtocol
    ? "Open the app through a local server (http://localhost), not file://."
    : "Make sure the Supabase script is loaded before script.js.";
  throw new Error(`${action} failed: Supabase client is unavailable. ${hint}`);
}

function readCachedEntries(){
  try{
    const raw = localStorage.getItem(ENTRIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch(err){
    console.error("cache read failed", err);
    return [];
  }
}

function writeCachedEntries(entries){
  try{
    localStorage.setItem(ENTRIES_CACHE_KEY, JSON.stringify(entries || []));
  } catch(err){
    console.error("cache write failed", err);
  }
}

function setGlossaryNotice(msg = ""){
  glossaryNotice = msg || "";
}

function noticeHTML(){
  if (!glossaryNotice) return "";
  return `
    <section class="term">
      <div class="termHead">
        <div class="ch">${escapeHtml(glossaryNotice)}</div>
      </div>
    </section>
  `;
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
  const client = getSupabaseClientOrThrow("Load glossary");
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
  marketEl.innerHTML = noticeHTML() + catsToShow.map(c => {
    const items = byCat.get(c) || [];
    return renderTerminal(c, items, newIds);
  }).join("");
  lastSeenIds = new Set(entries.map(e => e.id));
}

function renderSingle(entries, category){
  const newIds = computeNewIds(lastSeenIds, entries);
  const filtered = (entries || []).filter(e => (e.chapter || "general") === category);
  const rows = filtered.slice(0,140).map(e => rowHTML(e, newIds.has(e.id))).join("") ||
    `<div class="rowItem"><div class="ts">—</div><div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div></div>`;
  singleEl.innerHTML = `${noticeHTML()}${rows}`;
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
      writeCachedEntries(latestCache);
      setGlossaryNotice("");
      updateView(latestCache);
    } catch(e){
      console.error("poll error", e);
      if (latestCache.length){
        setGlossaryNotice("Offline: showing cached entries. Retrying automatically…");
        updateView(latestCache);
      }
    }
  }, 4000);
}

/* show/hide glossary */
async function refreshGlossary(){
  try{
    latestCache = await fetchEntries();
    writeCachedEntries(latestCache);
    lastSeenIds = new Set(latestCache.map(e=>e.id));
    setGlossaryNotice("");
    updateView(latestCache);
    return true;
  } catch(err){
    console.error("refreshGlossary error", err);
    return false;
  }
}

async function showGlossary({ afterSubmit = false } = {}){
  showGlossaryPanel();
  if (!latestCache.length){
    latestCache = readCachedEntries();
    lastSeenIds = new Set(latestCache.map(e=>e.id));
  }
  if (latestCache.length){
    setGlossaryNotice("Showing cached entries while syncing…");
  } else {
    setGlossaryNotice(afterSubmit ? "Submitted. Loading glossary…" : "Loading glossary…");
  }
  updateView(latestCache);
  startPolling();

  const loaded = await refreshGlossary();
  if (!loaded){
    if (afterSubmit){
      setGlossaryNotice(
        latestCache.length
          ? "Submitted. Offline right now — showing cached entries."
          : "Submitted, but glossary is offline. New entries appear once connection returns."
      );
    } else {
      setGlossaryNotice(
        latestCache.length
          ? "Offline: showing cached entries. Retrying automatically…"
          : "Could not load glossary. Check your connection and try again."
      );
    }
    updateView(latestCache);
  }
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
    const client = getSupabaseClientOrThrow("Submit");
    const { error } = await client.from("entries").insert([{ text, chapter }]);
    if (error) throw error;
    setLastPostNow();
    setHasSubmitted();
    input.value = "";
    setStatus("Submitted. Opening glossary…");
    await showGlossary({ afterSubmit: true });
    setStatus("");
  } catch(err){
    console.error("submit failed", err);
    setStatus(err?.message || "Submit failed. Please try again.");
    submitBtn.disabled = false;
  } finally {
    sending = false;
  }
});

/* init */
startThrottleUI();
setStartMode(true);

if (hasSubmittedBefore()){
  showGlossary();
}
