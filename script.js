const SUPABASE_URL = "https://ijtvuoiszkdrcmathlhf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdHZ1b2lzemtkcmNtYXRobGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU3NTIsImV4cCI6MjA5MjAwMTc1Mn0.phxMT0pYo0muJeXeSjX_bxnYcI2p-Tebm4AgterlhTQ";

if (!window.supabase) {
  console.error("Supabase client library not loaded.");
}

const supabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);

const THROTTLE_MS = 20_000;
const LAST_POST_KEY = "futurone:lastPostAt";
const HAS_SUBMITTED_KEY = "futurone:hasSubmitted";
const MAX_VISIBLE_CATEGORIES = 24; // keep market scannable while still showing broad category coverage
const MAX_ENTRIES_MARKET_VIEW = 60;
const MAX_ENTRIES_SINGLE_VIEW = 180;
const MAX_CACHE_SIZE = 500;
const BOARD_STATUS_NEW_ENTRY_PREFIX = "New entry in";
const BOARD_STATUS_TIMEOUT_MS = 2400;

const form = document.getElementById("stanceForm");
const input = document.getElementById("inputField");
const chapterHidden = document.getElementById("chapter");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const charCounterEl = document.getElementById("charCounter");
const categoryPreviewEl = document.getElementById("categoryPreview");

const submitPanel = document.getElementById("submitPanel");
const glossaryPanel = document.getElementById("glossaryPanel");
const marketEl = document.getElementById("market");
const singleEl = document.getElementById("single");
const tabsEl = document.getElementById("tabs");
const boardStatusEl = document.getElementById("boardStatus");

let pollTimer = null;
let latestCache = [];
let lastSeenIds = new Set();
let activeCategory = "all";
let throttleInterval = null;
let realtimeSub = null;
const previousCounts = new Map();

function setStartMode(isStart) {
  document.body.classList.toggle("isStart", !!isStart);
  if (isStart) {
    submitPanel?.classList.remove("isHidden");
    glossaryPanel?.classList.add("isHidden");
  }
}

function showGlossaryPanel() {
  setStartMode(false);
  submitPanel?.classList.add("isHidden");
  glossaryPanel?.classList.remove("isHidden");
}

function showSubmitPanel() {
  setStartMode(true);
  glossaryPanel?.classList.add("isHidden");
  submitPanel?.classList.remove("isHidden");
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deriveCategoryFromText(text) {
  const t = (text || "").trim();
  const m = t.match(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i);
  if (m) return m[1].trim().toLowerCase().replace(/\s+/g, "-");
  const h = t.match(/#([a-z0-9][a-z0-9_-]{0,24})/i);
  if (h) return h[1].toLowerCase();
  return "general";
}

function stripCategoryPrefix(text = "") {
  return (text || "").replace(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i, "").trim();
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatTimestampFull(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
}

function setBoardStatus(msg) {
  if (!boardStatusEl) return;
  boardStatusEl.textContent = msg || "";
}

function canPostNow() {
  const last = Number(localStorage.getItem(LAST_POST_KEY) || "0");
  return (Date.now() - last) >= THROTTLE_MS;
}

function msUntilNextPost() {
  const last = Number(localStorage.getItem(LAST_POST_KEY) || "0");
  return Math.max(0, THROTTLE_MS - (Date.now() - last));
}

function setLastPostNow() {
  localStorage.setItem(LAST_POST_KEY, String(Date.now()));
}

function setHasSubmitted() {
  localStorage.setItem(HAS_SUBMITTED_KEY, "true");
}

function hasSubmittedBefore() {
  return localStorage.getItem(HAS_SUBMITTED_KEY) === "true";
}

function updateInputMeta() {
  if (!input) return;
  const value = input.value || "";
  const length = value.length;
  const max = Number(input.maxLength || 220);
  const category = deriveCategoryFromText(value);

  if (charCounterEl) {
    charCounterEl.textContent = `${length} / ${max}`;
    charCounterEl.classList.toggle("isWarn", length > max * 0.8 && length < max);
    charCounterEl.classList.toggle("isLimit", length >= max);
  }

  if (categoryPreviewEl) {
    categoryPreviewEl.innerHTML = `Category: <strong>${escapeHtml(category)}</strong>`;
  }
}

function startThrottleUI() {
  if (!submitBtn) return;
  const tick = () => {
    const rem = msUntilNextPost();
    if (rem > 0) {
      submitBtn.disabled = true;
      setStatus(`Please wait ${Math.ceil(rem / 1000)}s before posting again.`);
    } else {
      submitBtn.disabled = false;
      if (statusEl?.textContent?.startsWith("Please wait")) setStatus("");
    }
  };

  tick();
  if (throttleInterval) clearInterval(throttleInterval);
  throttleInterval = setInterval(tick, 300);
}

async function fetchEntries() {
  if (!supabase) throw new Error("Supabase client missing.");
  const { data, error } = await supabase
    .from("entries")
    .select("id, text, chapter, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

function uniqueCategories(entries) {
  const set = new Set(entries.map((e) => e.chapter).filter(Boolean));
  return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}

function computeNewIds(prevSet, entries) {
  const out = new Set();
  for (const e of entries || []) {
    if (!prevSet.has(e.id)) out.add(e.id);
  }
  return out;
}

function rowHTML(e, isNew) {
  return `
    <div class="rowItem ${isNew ? "isNew" : ""}" data-id="${e.id}" title="${escapeHtml(formatTimestampFull(e.created_at))}">
      <div class="ts">${escapeHtml(formatTime(e.created_at))}</div>
      <div class="msg">${escapeHtml(stripCategoryPrefix(e.text))}</div>
    </div>
  `;
}

function groupByCategory(entries) {
  const map = new Map();
  for (const e of entries) {
    const c = e.chapter || "general";
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(e);
  }
  return map;
}

function getEntryCategoryLabel(entry) {
  return (entry?.chapter || "general").toUpperCase();
}

function folderInsight(items) {
  const latest = items[0];
  if (!latest) return "No submissions yet.";
  return `Latest at ${escapeHtml(formatTime(latest.created_at))} · ${Math.min(items.length, MAX_ENTRIES_MARKET_VIEW)} shown`;
}

function renderTerminal(category, items, newIdsSet, isHot) {
  const rows =
    items
      .slice(0, MAX_ENTRIES_MARKET_VIEW)
      .map((e) => rowHTML(e, newIdsSet.has(e.id)))
      .join("") ||
    `<div class="rowItem"><div class="ts">—</div><div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div></div>`;

  return `
    <section class="term ${isHot ? "isHot" : ""}" data-category="${escapeHtml(category)}">
      <div class="termHead">
        <div class="ch">${escapeHtml(category)}</div>
        <div class="count">${items.length}</div>
      </div>
      <div class="insight">${folderInsight(items)}</div>
      <div class="cols"><div>Time</div><div>Action</div></div>
      <div class="rows">${rows}</div>
    </section>
  `;
}

function renderMarket(entries) {
  if (!marketEl) return;
  const newIds = computeNewIds(lastSeenIds, entries);
  const byCat = groupByCategory(entries);
  const seen = new Set();
  const orderedCats = [];

  for (const e of entries) {
    const c = e.chapter || "general";
    if (!seen.has(c)) {
      seen.add(c);
      orderedCats.push(c);
    }
  }

  const catsToShow = orderedCats.slice(0, MAX_VISIBLE_CATEGORIES);
  marketEl.innerHTML = catsToShow
    .map((c) => {
      const items = byCat.get(c) || [];
      const prev = previousCounts.get(c) || 0;
      const isHot = items.length > prev;
      previousCounts.set(c, items.length);
      return renderTerminal(c, items, newIds, isHot);
    })
    .join("");

  lastSeenIds = new Set(entries.map((e) => e.id));
}

function renderSingle(entries, category) {
  if (!singleEl) return;
  const newIds = computeNewIds(lastSeenIds, entries);
  const filtered = (entries || []).filter((e) => (e.chapter || "general") === category);
  singleEl.innerHTML = `
    <div class="rows">
      ${
        filtered
          .slice(0, MAX_ENTRIES_SINGLE_VIEW)
          .map((e) => rowHTML(e, newIds.has(e.id)))
          .join("") ||
        `<div class="rowItem"><div class="ts">—</div><div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div></div>`
      }
    </div>
  `;
  lastSeenIds = new Set(entries.map((e) => e.id));
}

function renderTabs(entries) {
  if (!tabsEl) return;
  const cats = uniqueCategories(entries);
  tabsEl.innerHTML = cats
    .map(
      (c) => `
    <button class="tab ${c === activeCategory ? "isActive" : ""}" data-cat="${escapeHtml(c)}" type="button">
      ${escapeHtml(c)}
    </button>
  `
    )
    .join("");

  tabsEl.querySelectorAll(".tab").forEach((btn) => {
    btn.onclick = () => {
      activeCategory = btn.dataset.cat || "all";
      updateView(latestCache);
    };
  });
}

function updateView(entries) {
  try {
    renderTabs(entries);
    if (activeCategory === "all") {
      singleEl?.classList.add("isHidden");
      marketEl?.classList.remove("isHidden");
      renderMarket(entries);
    } else {
      marketEl?.classList.add("isHidden");
      singleEl?.classList.remove("isHidden");
      renderSingle(entries, activeCategory);
    }
  } catch (err) {
    console.error("updateView failed:", err);
  }
}

function applyInsert(newRow) {
  if (!newRow || latestCache.some((e) => e.id === newRow.id)) return;
  latestCache = [newRow, ...latestCache].slice(0, MAX_CACHE_SIZE);
  setBoardStatus(`${BOARD_STATUS_NEW_ENTRY_PREFIX} ${getEntryCategoryLabel(newRow)}`);
  updateView(latestCache);
  setTimeout(() => {
    if (boardStatusEl?.textContent?.startsWith(BOARD_STATUS_NEW_ENTRY_PREFIX)) setBoardStatus("");
  }, BOARD_STATUS_TIMEOUT_MS);
}

function handleRealtimeInsert(payload) {
  applyInsert(payload?.new);
}

function startRealtime() {
  if (!supabase || realtimeSub) return;

  try {
    if (typeof supabase.channel === "function") {
      realtimeSub = supabase
        .channel("public:entries")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "entries" }, handleRealtimeInsert)
        .subscribe();
      return;
    }

    if (typeof supabase.from === "function") {
      const entriesRef = supabase.from("entries");
      if (typeof entriesRef.on === "function") {
        realtimeSub = entriesRef
        .on("INSERT", handleRealtimeInsert)
        .subscribe();
      }
    }
  } catch (err) {
    console.error("Realtime failed:", err);
  }
}

async function startPolling() {
  if (pollTimer) return;

  try {
    setBoardStatus("Loading living glossary…");
    latestCache = await fetchEntries();
    lastSeenIds = new Set(latestCache.map((e) => e.id));
    updateView(latestCache);
    setBoardStatus(latestCache.length ? "" : "No entries yet — be the first to post.");
  } catch (e) {
    console.error("Initial load failed", e);
    setBoardStatus("Could not load glossary. You can still submit.");
  }

  pollTimer = setInterval(async () => {
    try {
      const data = await fetchEntries();
      if (!data) return;
      if (data.length && latestCache.length && data[0].id === latestCache[0].id) return;
      latestCache = data;
      updateView(latestCache);
    } catch (e) {
      console.error("poll error", e);
    }
  }, 4000);
}

async function showGlossary() {
  try {
    showGlossaryPanel();
    await startPolling();
    startRealtime();
  } catch (err) {
    console.error("showGlossary error", err);
    setStatus("Could not load glossary. Try reloading.");
    showSubmitPanel();
  }
}

let sending = false;
form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (sending) return;

  const text = (input?.value || "").trim();
  if (!text) return;

  if (!canPostNow()) {
    setStatus(`Please wait ${Math.ceil(msUntilNextPost() / 1000)}s before posting again.`);
    return;
  }

  const chapter = deriveCategoryFromText(text);
  if (chapterHidden) chapterHidden.value = chapter;
  if (submitBtn) submitBtn.disabled = true;
  sending = true;
  setStatus("Submitting…");

  try {
    if (!supabase) throw new Error("Supabase client not available (are you testing via file://?).");
    // .select() is used to get the inserted row for immediate real-time-like UI feedback (supabase-js v2 CDN in index.html).
    const { error, data } = await supabase.from("entries").insert([{ text, chapter }]).select();
    if (error) throw error;

    if (Array.isArray(data) && data[0]) applyInsert(data[0]);
    setLastPostNow();
    setHasSubmitted();
    if (input) input.value = "";
    updateInputMeta();
    setStatus("");
    await showGlossary();
  } catch (err) {
    console.error("submit failed", err);
    setStatus("Submit failed. See console.");
    if (submitBtn) submitBtn.disabled = false;
  } finally {
    sending = false;
  }
});

input?.addEventListener("input", updateInputMeta);
input?.addEventListener("focus", () => categoryPreviewEl?.classList.add("isFocus"));
input?.addEventListener("blur", () => categoryPreviewEl?.classList.remove("isFocus"));

function init() {
  startThrottleUI();
  updateInputMeta();
  setStartMode(true);

  if (hasSubmittedBefore()) {
    showGlossary().catch((e) => {
      console.error(e);
      showSubmitPanel();
      setStatus("Could not load glossary. You can still submit an entry.");
    });
  }
}

init();

window.addEventListener("beforeunload", () => {
  if (pollTimer) clearInterval(pollTimer);
  if (throttleInterval) clearInterval(throttleInterval);
  try {
    if (realtimeSub && typeof realtimeSub.unsubscribe === "function") realtimeSub.unsubscribe();
  } catch (e) {
    console.error(e);
  }
});
