const SUPABASE_URL = "https://ijtvuoiszkdrcmathlhf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqdHZ1b2lzemtkcmNtYXRobGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU3NTIsImV4cCI6MjA5MjAwMTc1Mn0.phxMT0pYo0muJeXeSjX_bxnYcI2p-Tebm4AgterlhTQ";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deriveCategoryFromText(text) {
  const t = text.trim();
  const m = t.match(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i);
  if (m) return m[1].trim().toLowerCase().replace(/\s+/g, "-");
  const h = t.match(/#([a-z0-9][a-z0-9_-]{0,24})/i);
  if (h) return h[1].toLowerCase();
  return "general";
}

function stripCategoryPrefix(text) {
  return text.replace(/^([a-z0-9][a-z0-9 _-]{0,24})\s*:\s+/i, "").trim();
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatTimestampFull(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit"
  });
}

function setStatus(msg) {
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

function setLastPostNow() {
  localStorage.setItem(LAST_POST_KEY, String(Date.now()));
}

function setHasSubmitted() {
  localStorage.setItem(HAS_SUBMITTED_KEY, "true");
}

function hasSubmittedBefore() {
  return localStorage.getItem(HAS_SUBMITTED_KEY) === "true";
}

function startThrottleUI() {
  const tick = () => {
    const remaining = msUntilNextPost();
    if (remaining > 0) {
      submitBtn.disabled = true;
      setStatus(`Please wait ${Math.ceil(remaining / 1000)}s before posting again.`);
    } else {
      submitBtn.disabled = false;
      if (statusEl.textContent.startsWith("Please wait")) setStatus("");
    }
  };
  tick();
  setInterval(tick, 250);
}

async function fetchEntries() {
  const { data, error } = await supabase
    .from("entries")
    .select("id, text, chapter, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

function uniqueCategories(entries) {
  const set = new Set(entries.map(e => e.chapter).filter(Boolean));
  return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}

function computeNewIds(previousIdsSet, entries) {
  const newIds = new Set();
  for (const e of entries) {
    if (!previousIdsSet.has(e.id)) newIds.add(e.id);
  }
  return newIds;
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

function renderTerminal(category, items, newIdsSet) {
  const rows = items.slice(0, 60).map(e => rowHTML(e, newIdsSet.has(e.id))).join("") || `
    <div class="rowItem">
      <div class="ts">—</div>
      <div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div>
    </div>
  `;

  return `
    <section class="term">
      <div class="termHead">
        <div class="ch">${escapeHtml(category)}</div>
        <div class="count">${items.length}</div>
      </div>
      <div class="cols">
        <div>Time</div>
        <div>Action</div>
      </div>
      <div class="rows">${rows}</div>
    </section>
  `;
}

function renderMarket(entries) {
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

  const catsToShow = orderedCats.slice(0, 6);

  marketEl.innerHTML = catsToShow.map(c => {
    const items = byCat.get(c) || [];
    return renderTerminal(c, items, newIds);
  }).join("");

  lastSeenIds = new Set(entries.map(e => e.id));
}

function renderSingle(entries, category) {
  const newIds = computeNewIds(lastSeenIds, entries);
  const filtered = entries.filter(e => (e.chapter || "general") === category);

  singleEl.innerHTML = filtered.slice(0, 140).map(e => rowHTML(e, newIds.has(e.id))).join("") || `
    <div class="rowItem">
      <div class="ts">—</div>
      <div class="msg" style="color:rgba(255,255,255,0.55)">No entries yet.</div>
    </div>
  `;

  lastSeenIds = new Set(entries.map(e => e.id));
}

function renderTabs(entries) {
  const cats = uniqueCategories(entries);

  tabsEl.innerHTML = cats.map(c => `
    <button class="tab ${c === activeCategory ? "isActive" : ""}" data-cat="${escapeHtml(c)}" type="button">
      ${escapeHtml(c)}
    </button>
  `).join("");

  tabsEl.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      updateView(latestCache);
    });
  });
}

function updateView(entries) {
  renderTabs(entries);

  if (activeCategory === "all") {
    singleEl.classList.add("isHidden");
    marketEl.classList.remove("isHidden");
    renderMarket(entries);
  } else {
    marketEl.classList.add("isHidden");
    singleEl.classList.remove("isHidden");
    renderSingle(entries, activeCategory);
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const data = await fetchEntries();
      if (data.length && latestCache.length && data[0].id === latestCache[0].id) return;
      latestCache = data;
      updateView(latestCache);
    } catch(e) {
      console.error(e);
    }
  }, 4000);
}

async function showGlossary() {
  submitPanel.classList.add("isHidden");
  glossaryPanel.classList.remove("isHidden");

  latestCache = await fetchEntries();
  lastSeenIds = new Set(latestCache.map(e => e.id));
  updateView(latestCache);
  startPolling();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  if (!canPostNow()) {
    setStatus(`Please wait ${Math.ceil(msUntilNextPost() / 1000)}s before posting again.`);
    return;
  }

  const chapter = deriveCategoryFromText(text);
  chapterHidden.value = chapter;

  submitBtn.disabled = true;
  setStatus("Submitting…");

  const { error } = await supabase.from("entries").insert([{ text, chapter }]);

  if (error) {
    console.error(error);
    setStatus("Submit failed. Please try again.");
    submitBtn.disabled = false;
    return;
  }

  setLastPostNow();
  setHasSubmitted();
  input.value = "";
  setStatus("");

  await showGlossary();
});

startThrottleUI();

if (hasSubmittedBefore()) {
  showGlossary().catch((e) => {
    console.error(e);
    glossaryPanel.classList.add("isHidden");
    submitPanel.classList.remove("isHidden");
    setStatus("Could not load glossary. You can still submit an entry.");
  });
}