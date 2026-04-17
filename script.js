document.addEventListener('DOMContentLoaded', function() {
    const stanceForm = document.getElementById('stanceForm');
    const submitPanel = document.getElementById('submitPanel');
    const glossaryPanel = document.getElementById('glossaryPanel');
    const inputField = document.getElementById('inputField');
    const market = document.getElementById('market');

    stanceForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const entry = inputField.value.trim();

        if (!entry) return;

        const categoryMatch = entry.match(/^(?<category>\S+):\s*(?<text>.+)$/) || 
                            entry.match(/^#(?<category>\S+)\s+(?<text>.+)$/);

        if (categoryMatch && categoryMatch.groups) {
            const category = categoryMatch.groups.category;
            const text = categoryMatch.groups.text;

            let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
            if (!artEntries[category]) {
                artEntries[category] = [];
            }
            artEntries[category].push({text, timestamp: new Date().toLocaleTimeString()});
            localStorage.setItem('artEntries', JSON.stringify(artEntries));

            inputField.value = '';
            submitPanel.classList.add('isHidden');
            glossaryPanel.classList.remove('isHidden');
            displayGlossary();
        }
    });

    function displayGlossary() {
        market.innerHTML = '';
        let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
        
        for (const category in artEntries) {
            const term = document.createElement('div');
            term.className = 'term';
            
            const termHead = document.createElement('div');
            termHead.className = 'termHead';
            termHead.innerHTML = `<span class="ch">${category}</span><span class="count">${artEntries[category].length}</span>`;
            term.appendChild(termHead);

            const cols = document.createElement('div');
            cols.className = 'cols';
            cols.innerHTML = `<div>Time</div><div>Entry</div>`;
            term.appendChild(cols);

            const rows = document.createElement('div');
            rows.className = 'rows';
            
            artEntries[category].forEach((entry, index) => {
                const rowItem = document.createElement('div');
                rowItem.className = 'rowItem';
                if (index === artEntries[category].length - 1) rowItem.classList.add('isNew');
                rowItem.innerHTML = `<div class="ts">${entry.timestamp}</div><div class="msg">${entry.text}</div>`;
                rows.appendChild(rowItem);
            });
            
            term.appendChild(rows);
            market.appendChild(term);
        }
    }

    setInterval(displayGlossary, 4000);
});
const REFRESH_INTERVAL = 7 * 60 * 60 * 1000;

async function loadLiveArtData() {
  try {
    document.getElementById("liveStatus").textContent = "Refreshing art updates...";

    const [definitionsRes, connectionsRes, metadataRes] = await Promise.all([
      fetch("public/survey/definitions.json", { cache: "no-store" }),
      fetch("public/survey/connections.json", { cache: "no-store" }),
      fetch("public/survey/metadata.json", { cache: "no-store" })
    ]);

    const definitions = await definitionsRes.json();
    const connections = await connectionsRes.json();
    const metadata = await metadataRes.json();

    renderLiveArtUpdates(definitions, connections, metadata);

    document.getElementById("liveStatus").textContent = "Live art updates loaded successfully.";
    document.getElementById("lastRefreshed").textContent =
      "Last refreshed: " + new Date().toLocaleString();
  } catch (error) {
    console.error("Failed to load live art data:", error);
    document.getElementById("liveStatus").textContent =
      "Could not load live updates right now. Please try again.";
  }
}

function renderLiveArtUpdates(definitions, connections, metadata) {
  const container = document.getElementById("networkContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="update-card">
      <h3>Latest Art Signals</h3>
      <p>Total definitions: ${definitions.length || 0}</p>
      <p>Total connections: ${connections.length || 0}</p>
      <p>Source count: ${metadata?.sources?.length || 0}</p>
    </div>
  `;
}

function startAutoRefresh() {
  loadLiveArtData();
  setInterval(loadLiveArtData, REFRESH_INTERVAL);
}

window.addEventListener("DOMContentLoaded", startAutoRefresh);
const REFRESH_INTERVAL = 7 * 60 * 60 * 1000;

function showGlossary() {
  const submitPanel = document.getElementById("submitPanel");
  const glossaryPanel = document.getElementById("glossaryPanel");

  if (submitPanel) submitPanel.classList.add("isHidden");
  if (glossaryPanel) glossaryPanel.classList.remove("isHidden");
}

async function refreshData() {
  const liveStatus = document.getElementById("liveStatus");
  const lastRefreshed = document.getElementById("lastRefreshed");
  const networkContainer = document.getElementById("networkContainer");

  try {
    if (liveStatus) liveStatus.textContent = "Refreshing art updates…";

    const [definitionsRes, connectionsRes, metadataRes] = await Promise.all([
      fetch("public/survey/definitions.json", { cache: "no-store" }),
      fetch("public/survey/connections.json", { cache: "no-store" }),
      fetch("public/survey/metadata.json", { cache: "no-store" }),
    ]);

    const definitions = await definitionsRes.json();
    const connections = await connectionsRes.json();
    const metadata = await metadataRes.json();

    // Minimal visible output so you can confirm it works
    if (networkContainer) {
      networkContainer.innerHTML = `
        <div style="padding:12px;border:1px solid rgba(255,215,0,.35);border-radius:12px;background:rgba(255,215,0,.08);">
          <div><strong>Definitions:</strong> ${(definitions && definitions.length) || 0}</div>
          <div><strong>Connections:</strong> ${(connections && connections.length) || 0}</div>
          <div><strong>Sources:</strong> ${(metadata && metadata.sources && metadata.sources.length) || 0}</div>
        </div>
      `;
    }

    if (liveStatus) liveStatus.textContent = "Live art updates loaded.";
    if (lastRefreshed) lastRefreshed.textContent = "Last refreshed: " + new Date().toLocaleString();
  } catch (err) {
    console.error(err);
    if (liveStatus) liveStatus.textContent = "Failed to load live updates (check console).";
  }
}

function scheduleLiveUpdate() {
  // run once immediately
  refreshData();
  // then every 7 hours
  setInterval(refreshData, REFRESH_INTERVAL);
}

window.addEventListener("DOMContentLoaded", () => {
  // start the live updates even before submit
  scheduleLiveUpdate();

  // make submit actually switch screens so user sees change
  const form = document.getElementById("stanceForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      showGlossary();
      refreshData(); // refresh immediately after submit
    });
  }
});
