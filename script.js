// script.js (artlive) — clean beginner version
// - local glossary entries in localStorage
// - live worldwide updates via /api/crawl
// - refresh every 7 hours
// - chart + network graph (D3)

const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;

document.addEventListener("DOMContentLoaded", () => {
  const stanceForm = document.getElementById("stanceForm");
  const submitPanel = document.getElementById("submitPanel");
  const glossaryPanel = document.getElementById("glossaryPanel");
  const inputField = document.getElementById("inputField");
  const market = document.getElementById("market");

  const liveStatus = document.getElementById("liveStatus");
  const lastRefreshed = document.getElementById("lastRefreshed");
  const networkContainer = document.getElementById("networkContainer");

  function showGlossary() {
    if (submitPanel) submitPanel.classList.add("isHidden");
    if (glossaryPanel) glossaryPanel.classList.remove("isHidden");
  }

  function showSubmit() {
    if (glossaryPanel) glossaryPanel.classList.add("isHidden");
    if (submitPanel) submitPanel.classList.remove("isHidden");
    if (inputField) inputField.focus();
  }

  function saveEntryToLocalStorage(raw) {
    const entryRaw = (raw || "").trim();
    if (!entryRaw) return;

    // allow "category: text" or "#category text" OR plain text -> general
    const categoryMatch =
      entryRaw.match(/^(?<category>\S+):\s*(?<text>.+)$/) ||
      entryRaw.match(/^#(?<category>\S+)\s+(?<text>.+)$/);

    const category =
      categoryMatch && categoryMatch.groups && categoryMatch.groups.category
        ? categoryMatch.groups.category
        : "general";

    const text =
      categoryMatch && categoryMatch.groups && categoryMatch.groups.text
        ? categoryMatch.groups.text
        : entryRaw;

    const artEntries = JSON.parse(localStorage.getItem("artEntries") || "{}");
    if (!artEntries[category]) artEntries[category] = [];
    artEntries[category].push({ text, timestamp: new Date().toLocaleTimeString() });
    localStorage.setItem("artEntries", JSON.stringify(artEntries));
  }

  function displayGlossary() {
    if (!market) return;

    market.innerHTML = "";
    const artEntries = JSON.parse(localStorage.getItem("artEntries") || "{}");

    // Sort categories: "general" first, then alphabetically
    const categories = Object.keys(artEntries).sort((a, b) => {
      if (a === "general") return -1;
      if (b === "general") return 1;
      return a.localeCompare(b);
    });

    for (const category of categories) {
      const term = document.createElement("div");
      term.className = "term";

      const termHead = document.createElement("div");
      termHead.className = "termHead";
      termHead.innerHTML = `<span class="ch">${category}</span><span class="count">${artEntries[category].length}</span>`;
      term.appendChild(termHead);

      const cols = document.createElement("div");
      cols.className = "cols";
      cols.innerHTML = `<div>Time</div><div>Entry</div>`;
      term.appendChild(cols);

      const rows = document.createElement("div");
      rows.className = "rows";

      // Sort entries by timestamp (newest first)
      const sortedEntries = [...artEntries[category]].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      sortedEntries.forEach((entry, index) => {
        const rowItem = document.createElement("div");
        rowItem.className = "rowItem";
        if (index === 0) rowItem.classList.add("isNew"); // Highlight newest
        rowItem.innerHTML = `<div class="ts">${entry.timestamp}</div><div class="msg">${entry.text}</div>`;
        rows.appendChild(rowItem);
      });

      term.appendChild(rows);
      market.appendChild(term);
    }
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
    if (!history || history.length === 0) return; // skip if no history yet

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

    // Create peer-to-peer mesh links (web of connections, not hub-spoke)
    const meshLinks = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < Math.min(i + 3, nodes.length); j++) {
        if (nodes[i].id !== nodes[j].id) {
          meshLinks.push({ source: nodes[i].id, target: nodes[j].id, weight: 1 });
        }
      }
    }

    const svg = d3
      .select(graphEl)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background", "linear-gradient(135deg, rgba(31,41,55,0.4), rgba(17,24,39,0.5))")
      .style("border", "2px solid rgba(69, 123, 157, 0.4)")
      .style("border-radius", "12px");

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(meshLinks).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("collide", d3.forceCollide(24))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Links with gradient effect
    const link = svg
      .append("g")
      .attr("stroke", "rgba(69, 123, 157, 0.35)")
      .selectAll("line")
      .data(meshLinks)
      .join("line")
      .attr("stroke-width", 1.5)
      .style("stroke", (d) => {
        const colors = ["#E63946", "#457B9D", "#FFB703"];
        return colors[Math.floor(Math.random() * colors.length)];
      })
      .style("opacity", 0.4);

    // Nodes with source-based colors
    const colorMap = {
      "wikipedia": "#E63946",
      "wikidata": "#457B9D",
      "met": "#FFB703",
      "hub": "#1B1B1B"
    };

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 7)
      .attr("fill", (d) => colorMap[d.source] || "#6C757D")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0 2px 8px rgba(0,0,0,0.3))")
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
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

    // Labels with readable background
    const label = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g");

    label
      .append("rect")
      .attr("x", -40)
      .attr("y", -10)
      .attr("width", 80)
      .attr("height", 18)
      .attr("rx", 4)
      .attr("fill", "rgba(31, 41, 55, 0.85)")
      .attr("stroke", "rgba(255,255,255,0.2)")
      .attr("stroke-width", 1);

    label
      .append("text")
      .text((d) => d.label?.substring(0, 12) || d.id.substring(0, 12))
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "#FFFFFF")
      .style("pointer-events", "none");

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      label.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
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
      console.error("Live update error:", e);
      // Show helpful message based on environment
      const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isDev) {
        if (liveStatus) liveStatus.textContent = "(Dev mode) Live crawler only works on production. Using local data in development.";
      } else {
        if (liveStatus) liveStatus.textContent = "Could not load live updates. Check your connection.";
      }
    }
  }

  // submit flow
  stanceForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = inputField?.value;
    if (!value || !value.trim()) {
      if (inputField) inputField.focus();
      return;
    }
    saveEntryToLocalStorage(value);
    stanceForm.reset(); // properly reset all form fields
    showGlossary();
    displayGlossary();
    refreshLive();
    if (inputField) inputField.focus();
  });

  // add back button to return to submit form
  const glossaryHeader = document.querySelector(".glossaryHeader");
  if (glossaryHeader) {
    const backBtn = document.createElement("button");
    backBtn.className = "backBtn";
    backBtn.textContent = "← Submit Another";
    backBtn.style.cssText = "position:absolute; left:12px; top:12px; background:transparent; border:none; color:inherit; cursor:pointer; font-size:14px; padding:4px 8px;";
    backBtn.addEventListener("click", () => {
      showSubmit();
      if (inputField) inputField.focus();
    });
    glossaryHeader.style.position = "relative";
    glossaryHeader.insertBefore(backBtn, glossaryHeader.firstChild);
  }

  // initial boot
  showSubmit(); // start on submit panel
  refreshLive();
  setInterval(refreshLive, REFRESH_INTERVAL_MS);
});
