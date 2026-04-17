document.addEventListener('DOMContentLoaded', function () {
  const stanceForm = document.getElementById('stanceForm');
  const submitPanel = document.getElementById('submitPanel');
  const glossaryPanel = document.getElementById('glossaryPanel');
  const inputField = document.getElementById('inputField');
  const market = document.getElementById('market');

  const liveStatus = document.getElementById('liveStatus');
  const lastRefreshed = document.getElementById('lastRefreshed');
  const networkContainer = document.getElementById('networkContainer');

  const REFRESH_INTERVAL = 7 * 60 * 60 * 1000;

  function showGlossary() {
    submitPanel?.classList.add('isHidden');
    glossaryPanel?.classList.remove('isHidden');
  }

  stanceForm?.addEventListener('submit', function (event) {
    event.preventDefault();

    const entryRaw = (inputField?.value || '').trim();
    if (!entryRaw) return;

    // Accept BOTH:
    //   "category: text"
    //   "#category text"
    // and plain text (falls back to "general")
    const categoryMatch =
      entryRaw.match(/^(?<category>\S+):\s*(?<text>.+)$/) ||
      entryRaw.match(/^#(?<category>\S+)\s+(?<text>.+)$/);

    const category = (categoryMatch && categoryMatch.groups && categoryMatch.groups.category)
      ? categoryMatch.groups.category
      : 'general';

    const text = (categoryMatch && categoryMatch.groups && categoryMatch.groups.text)
      ? categoryMatch.groups.text
      : entryRaw;

    let artEntries = JSON.parse(localStorage.getItem('artEntries')) || {};
    if (!artEntries[category]) artEntries[category] = [];

    artEntries[category].push({
      text,
      timestamp: new Date().toLocaleTimeString()
    });

    localStorage.setItem('artEntries', JSON.stringify(artEntries));
    inputField.value = '';

    showGlossary();
    displayGlossary();

    // Also refresh live crawler data immediately after a submit
    refreshLiveUpdates();
  });

  function displayGlossary() {
    if (!market) return;

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

  async function refreshLiveUpdates() {
    // If you haven't added the live block to HTML yet, fail silently
    if (!liveStatus && !networkContainer) return;

    try {
      if (liveStatus) liveStatus.textContent = 'Refreshing art updates…';

      // IMPORTANT: likely correct path on GitHub Pages/Vercel for files in /public/survey/*
      const [definitionsRes, connectionsRes, metadataRes] = await Promise.all([
        fetch('/survey/definitions.json', { cache: 'no-store' }),
        fetch('/survey/connections.json', { cache: 'no-store' }),
        fetch('/survey/metadata.json', { cache: 'no-store' })
      ]);

      const definitions = await definitionsRes.json();
      const connections = await connectionsRes.json();
      const metadata = await metadataRes.json();

      if (networkContainer) {
        // Minimal visible proof it works (you can replace this with D3 graph later)
        networkContainer.innerHTML = `
          <div class="liveCard">
            <div><strong>Definitions:</strong> ${(definitions && definitions.length) || 0}</div>
            <div><strong>Connections:</strong> ${(connections && connections.length) || 0}</div>
            <div><strong>Sources:</strong> ${(metadata && metadata.sources && metadata.sources.length) || 0}</div>
          </div>
        `;
      }

      if (liveStatus) liveStatus.textContent = 'Live art updates loaded.';
      if (lastRefreshed) lastRefreshed.textContent = 'Last refreshed: ' + new Date().toLocaleString();
    } catch (err) {
      console.error('Live updates failed:', err);
      if (liveStatus) liveStatus.textContent = 'Could not load live updates (open console / check JSON paths).';
    }
  }

  // Keep your existing local render loop (optional; 4s is aggressive but OK)
  setInterval(displayGlossary, 4000);

  // Live updates: run once + every 7 hours
  refreshLiveUpdates();
  setInterval(refreshLiveUpdates, REFRESH_INTERVAL);
});
