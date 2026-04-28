// script.js (artlive) — clean beginner version
// - local glossary entries in localStorage
// - live worldwide updates via /api/crawl
// - refresh every 7 hours
// - chart + network graph (D3)

const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;
const MAX_CATEGORIES = 7;

document.addEventListener("DOMContentLoaded", () => {
  const stanceForm = document.getElementById("stanceForm");
  const submitPanel = document.getElementById("submitPanel");
  const glossaryPanel = document.getElementById("glossaryPanel");
  const inputField = document.getElementById("inputField");
  const categorySelect = document.getElementById("categorySelect");
  const newCategoryInput = document.getElementById("newCategoryInput");
  const statusEl = document.getElementById("status");
  const market = document.getElementById("market");

  const liveStatus = document.getElementById("liveStatus");
  const lastRefreshed = document.getElementById("lastRefreshed");
  const networkContainer = document.getElementById("networkContainer");

  // -------- DATA HELPERS --------

  function getStoredEntries() {
    return JSON.parse(localStorage.getItem("artEntries") || "{}");
  }

  function getCategories() {
    return Object.keys(getStoredEntries());
  }

  // Migrate old entries that lack a numeric `ts` field
  function migrateEntries() {
    const artEntries = getStoredEntries();
    let changed = false;
    for (const cat of Object.keys(artEntries)) {
      if (!Array.isArray(artEntries[cat])) continue;
      for (let i = 0; i < artEntries[cat].length; i++) {
        if (typeof artEntries[cat][i].ts === "undefined") {
          artEntries[cat][i].ts = 0; // old entries sort to bottom
          changed = true;
        }
      }
    }
    if (changed) localStorage.setItem("artEntries", JSON.stringify(artEntries));
  }

  function saveEntry(text, category) {
    const artEntries = getStoredEntries();
    if (!artEntries[category]) artEntries[category] = [];
    const now = new Date();
    artEntries[category].push({
      text,
      timestamp: now.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      ts: now.getTime(),
    });
    localStorage.setItem("artEntries", JSON.stringify(artEntries));
  }

  // -------- CATEGORY DROPDOWN --------

  function populateCategoryDropdown() {
    if (!categorySelect) return;
    const categories = getCategories();
    const prevValue = categorySelect.value;

    categorySelect.innerHTML = "";

    if (categories.length === 0) {
      // No categories yet — only option is to create one
      const opt = document.createElement("option");
      opt.value = "__new__";
      opt.textContent = "+ New category…";
      categorySelect.appendChild(opt);
    } else {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = "Select a category…";
      categorySelect.appendChild(placeholder);

      categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        if (cat === prevValue) opt.selected = true;
        categorySelect.appendChild(opt);
      });

      if (categories.length < MAX_CATEGORIES) {
        const newOpt = document.createElement("option");
        newOpt.value = "__new__";
        newOpt.textContent = "+ New category…";
        categorySelect.appendChild(newOpt);
      }
    }

    // Show/hide the new-category text input based on current selection
    toggleNewCategoryInput();
  }

  function toggleNewCategoryInput() {
    if (!categorySelect || !newCategoryInput) return;
    if (categorySelect.value === "__new__") {
      newCategoryInput.classList.remove("isHidden");
    } else {
      newCategoryInput.classList.add("isHidden");
      newCategoryInput.value = "";
    }
  }

  categorySelect?.addEventListener("change", () => {
    toggleNewCategoryInput();
    if (categorySelect.value === "__new__") {
      newCategoryInput?.focus();
    }
  });

  // -------- SCREENS --------

  function showGlossary() {
    if (submitPanel) submitPanel.classList.add("isHidden");
    if (glossaryPanel) glossaryPanel.classList.remove("isHidden");
  }

  // -------- ACCORDION ARCHIVE --------

  function displayGlossary() {
    if (!market) return;

    migrateEntries();
    const artEntries = getStoredEntries();
    const allCategories = Object.keys(artEntries);

    market.innerHTML = "";

    if (allCategories.length === 0) {
      market.innerHTML = `<p class="emptyState">No entries yet — submit your first one above.</p>`;
      return;
    }

    // Sort categories by most-recent entry timestamp (newest category first)
    allCategories.sort((a, b) => {
      const latestA = Math.max(...artEntries[a].map((e) => e.ts || 0));
      const latestB = Math.max(...artEntries[b].map((e) => e.ts || 0));
      return latestB - latestA;
    });

    const accordion = document.createElement("div");
    accordion.className = "accordion";

    allCategories.forEach((category, catIndex) => {
      const entryList = [...artEntries[category]].sort(
        (a, b) => (b.ts || 0) - (a.ts || 0)
      );
      // After sort, index 0 is always the most recent entry

      const item = document.createElement("div");
      item.className = "accordionItem";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "accordionHead";
      head.setAttribute("aria-expanded", catIndex === 0 ? "true" : "false");
      head.innerHTML = `
        <span class="catName">${escapeHtml(category)}</span>
        <span class="catMeta">
          <span class="catCount">${entryList.length} ${entryList.length === 1 ? "entry" : "entries"}</span>
          <span class="chevron" aria-hidden="true">${catIndex === 0 ? "▼" : "▶"}</span>
        </span>
      `;

      const body = document.createElement("div");
      body.className = "accordionBody";
      if (catIndex !== 0) body.setAttribute("hidden", "");

      entryList.forEach((entry, i) => {
        const row = document.createElement("div");
        row.className = "entryItem";
        if (i === 0) row.classList.add("isNew");
        row.innerHTML = `
          <div class="entryDate">${escapeHtml(entry.timestamp)}</div>
          <div class="entryText">${escapeHtml(entry.text)}</div>
        `;
        body.appendChild(row);
      });

      head.addEventListener("click", () => {
        const isOpen = head.getAttribute("aria-expanded") === "true";
        if (isOpen) {
          body.setAttribute("hidden", "");
          head.setAttribute("aria-expanded", "false");
          head.querySelector(".chevron").textContent = "▶";
          item.classList.remove("isOpen");
        } else {
          body.removeAttribute("hidden");
          head.setAttribute("aria-expanded", "true");
          head.querySelector(".chevron").textContent = "▼";
          item.classList.add("isOpen");
        }
      });

      if (catIndex === 0) item.classList.add("isOpen");
      item.appendChild(head);
      item.appendChild(body);
      accordion.appendChild(item);
    });

    market.appendChild(accordion);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // -------- LIVE WORLDWIDE UPDATES --------
  function pushHistoryPoint(sources) {
    // store tiny time-series in localStorage so the chart works without a database
    const key = "liveHistory";
    const history = JSON.parse(localStorage.getItem(key) || "[]");

    history.push({
      t: Date.now(),
      wikipedia: sources?.wikipedia ?? 0,
      wikidata: sources?.wikidata ?? 0,
      met: sources?.met ?? 0,
    });

    // keep last 60 points
    const trimmed = history.slice(-60);
    localStorage.setItem(key, JSON.stringify(trimmed));
    return trimmed;
  }

  function renderChart(history) {
    if (!networkContainer) return;

    // chart goes ABOVE the graph
    let chartEl = document.getElementById("liveChart");
    if (!chartEl) {
      chartEl = document.createElement("div");
      chartEl.id = "liveChart";
      chartEl.style.margin = "12px 0";
      networkContainer.prepend(chartEl);
    }

    const width = Math.min(900, networkContainer.clientWidth || 900);
    const height = 140;
    const padding = 22;

    const points = history.map((d) => ({
      x: d.t,
      y: (d.wikipedia || 0) + (d.wikidata || 0) + (d.met || 0),
    }));

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(1, ...points.map((p) => p.y));

    const scaleX = (x) =>
      padding + ((x - minX) / Math.max(1, maxX - minX)) * (width - padding * 2);
    const scaleY = (y) =>
      height - padding - (y / maxY) * (height - padding * 2);

    const dPath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
      .join(" ");

    chartEl.innerHTML = `
      <div class="liveCard">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:baseline;">
          <div><strong>Live Trend (nodes over time)</strong></div>
          <div style="opacity:.8; font-size:12px;">${new Date().toLocaleTimeString()}</div>
        </div>
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <path d="${dPath}" fill="none" stroke="rgba(255,215,0,0.95)" stroke-width="2.5"></path>
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.18)"/>
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.18)"/>
        </svg>
      </div>
    `;
  }

  function renderNetworkGraph(nodes, links) {
    if (!networkContainer) return;
    if (!window.d3) {
      networkContainer.innerHTML += `<div class="liveCard"><strong>Error:</strong> D3 not loaded.</div>`;
      return;
    }

    // clear previous graph area (but keep chart if present)
    let graphEl = document.getElementById("liveGraph");
    if (!graphEl) {
      graphEl = document.createElement("div");
      graphEl.id = "liveGraph";
      graphEl.style.marginTop = "12px";
      networkContainer.appendChild(graphEl);
    }
    graphEl.innerHTML = "";

    const width = Math.min(900, networkContainer.clientWidth || 900);
    const height = 420;

    const svg = d3
      .select(graphEl)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "rgba(0,0,0,0.20)")
      .style("border", "1px solid rgba(0,0,0,0.25)")
      .style("border-radius", "14px");

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(85))
      .force("charge", d3.forceManyBody().strength(-240))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append("g")
      .attr("stroke", "rgba(255,215,0,0.45)")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.2);

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => (d.source === "hub" ? 10 : 6))
      .attr("fill", (d) => (d.source === "hub" ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.75)"))
      .attr("stroke", "rgba(255,215,0,0.95)")
      .attr("stroke-width", 1.4)
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label || d.id)
      .attr("font-size", 11)
      .attr("fill", "rgba(0,0,0,0.9)")
      .attr("stroke", "rgba(255,215,0,0.35)")
      .attr("stroke-width", 0.8);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      label.attr("x", (d) => d.x + 10).attr("y", (d) => d.y + 4);
    });
  }

  async function refreshLive() {
    try {
      if (liveStatus) liveStatus.textContent = "Refreshing live worldwide art updates…";

      const r = await fetch("/api/crawl", { cache: "no-store" });
      if (!r.ok) throw new Error(`API /api/crawl failed: ${r.status}`);
      const data = await r.json();

      if (!data.ok) throw new Error(data.error || "Unknown crawl error");

      const history = pushHistoryPoint(data.sources);
      renderChart(history);
      renderNetworkGraph(data.nodes || [], data.links || []);

      if (liveStatus) liveStatus.textContent = "Live updates loaded (Wikipedia + Wikidata + Met).";
      if (lastRefreshed) lastRefreshed.textContent = "Last refreshed: " + new Date().toLocaleString();
    } catch (e) {
      console.error(e);
      if (liveStatus) liveStatus.textContent = "Could not load live updates. Open DevTools Console to see the error.";
    }
  }

  // -------- SUBMIT FLOW --------
  stanceForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = (inputField?.value || "").trim();
    if (!text) return;

    let category = categorySelect?.value || "";

    if (category === "__new__") {
      const newCatVal = (newCategoryInput?.value || "").trim();
      if (!newCatVal) {
        if (statusEl) statusEl.textContent = "Please enter a category name.";
        newCategoryInput?.focus();
        return;
      }

      const existingCats = getCategories();
      // If it's genuinely a new category name, check the limit
      if (!existingCats.includes(newCatVal) && existingCats.length >= MAX_CATEGORIES) {
        if (statusEl) {
          statusEl.textContent = `Max ${MAX_CATEGORIES} categories reached. Please select an existing category.`;
        }
        return;
      }
      category = newCatVal;
    }

    if (!category) {
      if (statusEl) statusEl.textContent = "Please select or create a category.";
      categorySelect?.focus();
      return;
    }

    saveEntry(text, category);

    if (inputField) inputField.value = "";
    if (newCategoryInput) newCategoryInput.value = "";
    if (statusEl) statusEl.textContent = "";

    populateCategoryDropdown();
    showGlossary();
    displayGlossary();
    refreshLive();
  });

  // -------- INITIAL BOOT --------
  migrateEntries();
  populateCategoryDropdown();
  displayGlossary();
  refreshLive();
  setInterval(refreshLive, REFRESH_INTERVAL_MS);
});
