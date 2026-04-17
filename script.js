const REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;
const TICKER_INTERVAL_MS = 2200;
const HISTORY_KEY = "liveHistory";
const ENTRIES_KEY = "artEntries";
const MAX_TRENDING = 8;
const DEFAULT_NODE_LIMIT = 36;
const NODE_BOUNDARY_PADDING = 12;
const RESIZE_DEBOUNCE_MS = 180;
const HUB_NODE_ID = "hub:art";
const MIN_GRAPH_HEIGHT = 460;
const MAX_GRAPH_HEIGHT = 700;
const GRAPH_HEIGHT_VIEWPORT_RATIO = 0.68;
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
};

document.addEventListener("DOMContentLoaded", () => {
  const stanceForm = document.getElementById("stanceForm");
  const inputField = document.getElementById("inputField");
  const categorySelect = document.getElementById("categorySelect");
  const status = document.getElementById("status");
  const recentEntriesEl = document.getElementById("recentEntries");

  const tickerWordEl = document.getElementById("tickerWord");
  const tickerSourceEl = document.getElementById("tickerSource");

  const liveStatus = document.getElementById("liveStatus");
  const lastRefreshed = document.getElementById("lastRefreshed");
  const refreshNowBtn = document.getElementById("refreshNowBtn");
  const showAllNodesToggle = document.getElementById("showAllNodesToggle");

  const networkContainer = document.getElementById("networkContainer");
  const trendChartEl = document.getElementById("trendChart");
  const trendingListEl = document.getElementById("trendingList");
  const sourceCountsEl = document.getElementById("sourceCounts");

  const state = {
    liveNodes: [],
    liveLinks: [],
    tickerTerms: [],
    tickerIndex: -1,
    tickerTimer: null,
    focusedNodeId: null,
    graphView: null,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const colorBySource = (source) => {
    if (source === "wikipedia") return "#4d98ff";
    if (source === "wikidata") return "#bf60ff";
    if (source === "met") return "#ff6d6d";
    if (source === "hub") return "#ffd700";
    return "#bfbfbf";
  };

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("localStorage parse failed", error);
      return fallback;
    }
  }

  function safeWriteJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("localStorage write failed", error);
    }
  }

  function getEntries() {
    return safeReadJSON(ENTRIES_KEY, []);
  }

  function saveEntry(text, category) {
    const clean = (text || "").trim();
    if (!clean) return false;

    const entries = getEntries();
    entries.push({
      text: clean,
      category: category || "general",
      timestamp: Date.now(),
    });
    safeWriteJSON(ENTRIES_KEY, entries);
    return true;
  }

  function renderRecentEntries() {
    if (!recentEntriesEl) return;

    const entries = getEntries();
    const recent = entries.slice(-6).reverse();

    if (!recent.length) {
      recentEntriesEl.innerHTML = `<li class="emptyState">No entries yet. Add one to start your own glossary trail.</li>`;
      return;
    }

    recentEntriesEl.innerHTML = recent
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return `
          <li class="recentItem">
            <div class="recentMeta"><span>${escapeHtml(entry.category)}</span><span>${time}</span></div>
            <div class="recentText">${escapeHtml(entry.text)}</div>
          </li>
        `;
      })
      .join("");
  }

  function sourceClass(source) {
    const safe = String(source || "unknown").toLowerCase();
    if (safe === "wikipedia" || safe === "wikidata" || safe === "met" || safe === "hub") {
      return `sourceTag--${safe}`;
    }
    return "sourceTag--unknown";
  }

  function updateTickerTerms(nodes) {
    state.tickerTerms = (nodes || []).filter((node) => node && node.id !== HUB_NODE_ID);

    if (!state.tickerTerms.length) {
      if (tickerWordEl) tickerWordEl.textContent = "Waiting for live terms…";
      if (tickerSourceEl) {
        tickerSourceEl.textContent = "offline";
        tickerSourceEl.className = "sourceTag sourceTag--unknown";
      }
      return;
    }

    state.tickerIndex = -1;
    rotateTicker();

    if (!state.tickerTimer) {
      state.tickerTimer = setInterval(rotateTicker, TICKER_INTERVAL_MS);
    }
  }

  function rotateTicker() {
    if (!state.tickerTerms.length || !tickerWordEl || !tickerSourceEl) return;

    state.tickerIndex = (state.tickerIndex + 1) % state.tickerTerms.length;
    const term = state.tickerTerms[state.tickerIndex];

    tickerWordEl.textContent = term.label || term.id;
    tickerWordEl.classList.remove("isFlashing");
    window.requestAnimationFrame(() => tickerWordEl.classList.add("isFlashing"));

    tickerSourceEl.textContent = term.source || "unknown";
    tickerSourceEl.className = `sourceTag ${sourceClass(term.source)}`;
  }

  function pushHistoryPoint(sources) {
    const history = safeReadJSON(HISTORY_KEY, []);

    history.push({
      t: Date.now(),
      wikipedia: sources?.wikipedia ?? 0,
      wikidata: sources?.wikidata ?? 0,
      met: sources?.met ?? 0,
    });

    const trimmed = history.slice(-60);
    safeWriteJSON(HISTORY_KEY, trimmed);
    return trimmed;
  }

  function renderSourceCounts(sources) {
    if (!sourceCountsEl) return;

    const ordered = ["wikipedia", "wikidata", "met"].map((name) => ({
      name,
      value: Number(sources?.[name] || 0),
    }));

    sourceCountsEl.innerHTML = ordered
      .map((item) => `<li class="sourceCountItem" aria-label="${item.name}: ${item.value}"><span>${item.name}</span><strong>${item.value}</strong></li>`)
      .join("");
  }

  function buildDegreeMap(links) {
    const degree = new Map();
    (links || []).forEach((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (!sourceId || !targetId) return;

      degree.set(sourceId, (degree.get(sourceId) || 0) + 1);
      degree.set(targetId, (degree.get(targetId) || 0) + 1);
    });
    return degree;
  }

  function getDisplayGraph(showAll) {
    const nodes = state.liveNodes || [];
    const links = state.liveLinks || [];
    const degree = buildDegreeMap(links);

    if (showAll) {
      return {
        nodes,
        links,
        degree,
      };
    }

    const sortedNodes = [...nodes]
      .filter((node) => node.id !== HUB_NODE_ID)
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));

    const selectedIds = new Set([HUB_NODE_ID]);
    sortedNodes.slice(0, DEFAULT_NODE_LIMIT).forEach((node) => selectedIds.add(node.id));

    const filteredNodes = nodes.filter((node) => selectedIds.has(node.id));
    const filteredLinks = links.filter((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      return selectedIds.has(sourceId) && selectedIds.has(targetId);
    });

    return {
      nodes: filteredNodes,
      links: filteredLinks,
      degree,
    };
  }

  function renderTrendChart(history) {
    if (!trendChartEl) return;
    if (!history.length) {
      trendChartEl.innerHTML = `<div class="emptyState">No trend data yet.</div>`;
      return;
    }

    const width = Math.max(320, trendChartEl.clientWidth - 20);
    const height = 150;
    const padding = 20;

    const points = history.map((d) => ({
      x: d.t,
      y: getTotalSources(d),
    }));

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(1, ...points.map((p) => p.y));

    const scaleX = (x) => padding + ((x - minX) / Math.max(1, maxX - minX)) * (width - padding * 2);
    const scaleY = (y) => height - padding - (y / maxY) * (height - padding * 2);

    const path = points
      .map((point, index) => `${index ? "L" : "M"}${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
      .join(" ");

    trendChartEl.innerHTML = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend chart">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.2)" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.2)" />
        <path d="${path}" fill="none" stroke="rgba(255,215,0,0.95)" stroke-width="2.5" />
      </svg>
    `;
  }

  function renderTrendingList(displayNodes, degreeMap) {
    if (!trendingListEl) return;

    const trending = [...displayNodes]
      .filter((node) => node.id !== HUB_NODE_ID)
      .map((node) => ({
        ...node,
        mentions: degreeMap.get(node.id) || 0,
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, MAX_TRENDING);

    if (!trending.length) {
      trendingListEl.innerHTML = `<li class="emptyState">No terms available yet.</li>`;
      return;
    }

    trendingListEl.innerHTML = trending
      .map(
        (item) => `
          <li>
            <button class="trendingButton${state.focusedNodeId === item.id ? " isFocused" : ""}" type="button" data-focus-id="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.label || item.id)}</span>
              <strong>${item.mentions}</strong>
            </button>
          </li>
        `
      )
      .join("");
  }

  function renderNetworkGraph(displayNodes, displayLinks) {
    if (!networkContainer) return;

    networkContainer.innerHTML = "";

    if (!window.d3) {
      networkContainer.innerHTML = `<div class="emptyState">D3 failed to load.</div>`;
      return;
    }

    if (!displayNodes.length) {
      networkContainer.innerHTML = `<div class="emptyState">No network terms available yet.</div>`;
      return;
    }

    const width = Math.max(500, networkContainer.clientWidth);
    const height = Math.max(MIN_GRAPH_HEIGHT, Math.min(MAX_GRAPH_HEIGHT, Math.floor(window.innerHeight * GRAPH_HEIGHT_VIEWPORT_RATIO)));

    const svg = d3
      .select(networkContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const links = displayLinks.map((link) => ({
      source: typeof link.source === "object" ? link.source.id : link.source,
      target: typeof link.target === "object" ? link.target.id : link.target,
      weight: link.weight || 1,
    }));

    const nodes = displayNodes.map((node) => ({ ...node }));

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(70))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    const link = svg
      .append("g")
      .attr("stroke", "rgba(255,215,0,0.35)")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.2);

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => (d.id === HUB_NODE_ID ? 9 : 6.3))
      .attr("fill", (d) => colorBySource(d.source))
      .attr("stroke", "rgba(0,0,0,0.92)")
      .attr("stroke-width", 1.1)
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.2).restart();
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
      .attr("fill", "#ffffff")
      .attr("stroke", "rgba(0,0,0,0.88)")
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke")
      .attr("font-weight", 500);

    const tooltip = getOrCreateTooltip();

    node
      .on("mouseenter", (event, d) => {
        const urlText = d.url ? `<br><span>${escapeHtml(d.url)}</span>` : "";
        tooltip.innerHTML = `<strong>${escapeHtml(d.label || d.id)}</strong><br>${escapeHtml(d.source || "unknown")}${urlText}`;
        tooltip.hidden = false;
      })
      .on("mousemove", (event) => {
        tooltip.style.left = `${event.clientX + 12}px`;
        tooltip.style.top = `${event.clientY + 12}px`;
      })
      .on("mouseleave", () => {
        tooltip.hidden = true;
      })
      .on("click", (_, d) => {
        focusNode(d.id);
      });

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node
        .attr("cx", (d) => {
          d.x = clamp(d.x || width / 2, NODE_BOUNDARY_PADDING, width - NODE_BOUNDARY_PADDING);
          return d.x;
        })
        .attr("cy", (d) => {
          d.y = clamp(d.y || height / 2, NODE_BOUNDARY_PADDING, height - NODE_BOUNDARY_PADDING);
          return d.y;
        });

      label
        .attr("x", (d) => d.x + 10)
        .attr("y", (d) => d.y + 3);
    });

    state.graphView = { node, link, label, nodes, links };
    applyNodeFocus();
  }

  function focusNode(nodeId) {
    state.focusedNodeId = nodeId;
    applyNodeFocus();

    if (trendingListEl) {
      trendingListEl.querySelectorAll(".trendingButton").forEach((button) => {
        button.classList.toggle("isFocused", button.dataset.focusId === nodeId);
      });
    }
  }

  function applyNodeFocus() {
    const graph = state.graphView;
    if (!graph) return;

    const focusId = state.focusedNodeId;
    if (!focusId) {
      graph.node.attr("opacity", 1).attr("stroke-width", 1.1);
      graph.label.attr("opacity", 1);
      graph.link.attr("opacity", 0.8);
      return;
    }

    const connected = new Set([focusId]);
    graph.links.forEach((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      if (sourceId === focusId) connected.add(targetId);
      if (targetId === focusId) connected.add(sourceId);
    });

    graph.node
      .attr("opacity", (d) => (connected.has(d.id) ? 1 : 0.2))
      .attr("stroke-width", (d) => (d.id === focusId ? 2.2 : 1.1));

    graph.label.attr("opacity", (d) => (connected.has(d.id) ? 1 : 0.2));

    graph.link.attr("opacity", (d) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source;
      const targetId = typeof d.target === "object" ? d.target.id : d.target;
      return sourceId === focusId || targetId === focusId ? 1 : 0.1;
    });
  }

  function getTotalSources(datum) {
    return Number(datum?.wikipedia || 0) + Number(datum?.wikidata || 0) + Number(datum?.met || 0);
  }

  function debounce(fn, waitMs) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), waitMs);
    };
  }

  function escapeHtml(raw) {
    return String(raw).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
  }

  function getOrCreateTooltip() {
    let el = document.getElementById("graphTooltip");
    if (!el) {
      el = document.createElement("div");
      el.id = "graphTooltip";
      el.className = "graphTooltip";
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function renderLiveViews(showAllNodes) {
    const graphData = getDisplayGraph(showAllNodes);
    renderNetworkGraph(graphData.nodes, graphData.links);
    renderTrendingList(graphData.nodes, graphData.degree);
  }

  async function refreshLive() {
    try {
      if (liveStatus) liveStatus.textContent = "Refreshing live worldwide art updates…";

      const response = await fetch("/api/crawl", { cache: "no-store" });
      if (!response.ok) throw new Error(`/api/crawl failed (${response.status})`);

      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Unknown crawl error");

      state.liveNodes = Array.isArray(data.nodes) ? data.nodes : [];
      state.liveLinks = Array.isArray(data.links) ? data.links : [];

      updateTickerTerms(state.liveNodes);
      renderSourceCounts(data.sources || {});
      renderTrendChart(pushHistoryPoint(data.sources || {}));
      renderLiveViews(Boolean(showAllNodesToggle?.checked));

      if (liveStatus) liveStatus.textContent = "Live updates loaded from Wikipedia, Wikidata, and The Met.";
      if (lastRefreshed) lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
    } catch (error) {
      console.warn("Live refresh error:", error);
      if (liveStatus) liveStatus.textContent = "Could not load live updates (open console / check JSON paths).";
    }
  }

  stanceForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const ok = saveEntry(inputField?.value || "", categorySelect?.value || "general");
    if (!ok) {
      if (status) status.textContent = "Entry cannot be empty.";
      return;
    }

    if (inputField) inputField.value = "";
    if (status) status.textContent = "Entry added.";
    renderRecentEntries();
  });

  refreshNowBtn?.addEventListener("click", () => {
    refreshLive();
  });

  showAllNodesToggle?.addEventListener("change", () => {
    state.focusedNodeId = null;
    renderLiveViews(Boolean(showAllNodesToggle.checked));
  });

  trendingListEl?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-focus-id]");
    if (!button) return;
    focusNode(button.dataset.focusId);
  });

  window.addEventListener("resize", debounce(() => {
    renderLiveViews(Boolean(showAllNodesToggle?.checked));
  }, RESIZE_DEBOUNCE_MS));

  renderRecentEntries();
  renderSourceCounts({ wikipedia: 0, wikidata: 0, met: 0 });
  renderTrendChart(safeReadJSON(HISTORY_KEY, []));

  refreshLive();
  setInterval(refreshLive, REFRESH_INTERVAL_MS);
});
