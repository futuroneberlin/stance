document.addEventListener('DOMContentLoaded', function () {
    const stanceForm = document.getElementById('stanceForm');
    const submitPanel = document.getElementById('submitPanel');
    const glossaryPanel = document.getElementById('glossaryPanel');
    const inputField = document.getElementById('inputField');
    const market = document.getElementById('market');
    const tabs = document.getElementById('tabs');
    const networkPanel = document.getElementById('networkPanel');
    const crawlerStatus = document.getElementById('crawlerStatus');
    const lastUpdate = document.getElementById('lastUpdate');
    const crawlNowBtn = document.getElementById('crawlNowBtn');
    const crawlProgressBar = document.getElementById('crawlProgressBar');
    const networkStats = document.getElementById('networkStats');
    const trendingList = document.getElementById('trendingList');

    const TAB_GLOSSARY = 'glossary';
    const TAB_NETWORK = 'network';
    let activeTab = TAB_GLOSSARY;
    let networkData = null;
    let bundledData = null;

    const CATEGORY_COLORS = {
        concept: '#FFD700',
        movement: '#FFFFFF',
        medium: '#a0a0a0',
        theory: '#f4de7f',
        institution: '#f5f5f5',
        person: '#ffe066'
    };

    function safeParse(value, fallback) {
        try {
            const parsed = JSON.parse(value);
            return parsed == null ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function loadEntries() {
        return safeParse(localStorage.getItem('artEntries'), {});
    }

    function saveEntries(entries) {
        localStorage.setItem('artEntries', JSON.stringify(entries));
    }

    function formatTime(isoTimestamp) {
        if (!isoTimestamp) {
            return 'never';
        }
        const date = new Date(isoTimestamp);
        if (Number.isNaN(date.getTime())) {
            return 'unknown';
        }
        return date.toLocaleString();
    }

    function setCrawlerStatus(message, kind) {
        crawlerStatus.textContent = message;
        crawlerStatus.dataset.kind = kind || 'neutral';
    }

    function updateLastUpdate(metadata) {
        const suffix = metadata && metadata.lastUpdate ? formatTime(metadata.lastUpdate) : 'never';
        lastUpdate.textContent = `Last update: ${suffix}`;
    }

    function updateProgress(percentage) {
        const value = Math.max(0, Math.min(100, Number(percentage) || 0));
        crawlProgressBar.style.width = `${value}%`;
    }

    function renderTabs() {
        tabs.innerHTML = '';
        [
            { key: TAB_GLOSSARY, label: 'Glossary' },
            { key: TAB_NETWORK, label: 'Network' }
        ].forEach(function (tabDef) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `tab${activeTab === tabDef.key ? ' isActive' : ''}`;
            button.textContent = tabDef.label;
            button.addEventListener('click', function () {
                activeTab = tabDef.key;
                renderTabs();
                renderPanels();
            });
            tabs.appendChild(button);
        });
    }

    function renderPanels() {
        const showGlossary = activeTab === TAB_GLOSSARY;
        market.classList.toggle('isHidden', !showGlossary);
        networkPanel.classList.toggle('isHidden', showGlossary);
        if (!showGlossary && networkData) {
            renderNetwork(networkData);
        }
    }

    function displayGlossary() {
        market.innerHTML = '';
        const artEntries = loadEntries();
        const categories = Object.keys(artEntries);

        if (!categories.length) {
            const empty = document.createElement('div');
            empty.className = 'term';
            empty.innerHTML = '<div class="termHead"><span class="ch">No entries yet</span><span class="count">0</span></div>';
            market.appendChild(empty);
            return;
        }

        categories.forEach(function (category) {
            const term = document.createElement('div');
            term.className = 'term';

            const termHead = document.createElement('div');
            termHead.className = 'termHead';
            termHead.innerHTML = `<span class="ch">${category}</span><span class="count">${artEntries[category].length}</span>`;
            term.appendChild(termHead);

            const cols = document.createElement('div');
            cols.className = 'cols';
            cols.innerHTML = '<div>Time</div><div>Entry</div>';
            term.appendChild(cols);

            const rows = document.createElement('div');
            rows.className = 'rows';

            artEntries[category].forEach(function (entry, index) {
                const rowItem = document.createElement('div');
                rowItem.className = 'rowItem';
                if (index === artEntries[category].length - 1) {
                    rowItem.classList.add('isNew');
                }
                rowItem.innerHTML = `<div class="ts">${entry.timestamp}</div><div class="msg">${entry.text}</div>`;
                rows.appendChild(rowItem);
            });

            term.appendChild(rows);
            market.appendChild(term);
        });
    }

    function renderStats(metadata) {
        const stats = metadata || {};
        networkStats.innerHTML = [
            `<div class="stat"><span class="label">Concepts</span><span class="value">${stats.totalConcepts || 0}</span></div>`,
            `<div class="stat"><span class="label">Connections</span><span class="value">${stats.totalConnections || 0}</span></div>`,
            `<div class="stat"><span class="label">Sources</span><span class="value">${stats.sourceCount || 0}/${stats.totalSources || 4}</span></div>`
        ].join('');
    }

    function renderTrending(items) {
        trendingList.innerHTML = '';
        if (!items || !items.length) {
            trendingList.innerHTML = '<li>No trending relationships yet.</li>';
            return;
        }

        items.slice(0, 6).forEach(function (item) {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.sourceLabel}</strong> ↔ <strong>${item.targetLabel}</strong> <span class="trendWeight">(${item.weight})</span>`;
            trendingList.appendChild(li);
        });
    }

    function renderNetwork(data) {
        if (!window.d3) {
            setCrawlerStatus('D3 failed to load.', 'error');
            return;
        }

        const graphEl = document.getElementById('networkGraph');
        const width = graphEl.clientWidth || 900;
        const height = 460;
        const definitions = (data.definitions || []).slice(0, 80);
        const definitionIds = new Set(definitions.map(function (item) { return item.id; }));
        const links = (data.connections || []).filter(function (edge) {
            return definitionIds.has(edge.source) && definitionIds.has(edge.target);
        }).slice(0, 180);

        renderStats(data.metadata);
        renderTrending(data.trending || []);

        const svg = d3.select('#networkGraph')
            .attr('viewBox', [0, 0, width, height].join(' '));

        svg.selectAll('*').remove();

        const root = svg.append('g');
        svg.call(d3.zoom().scaleExtent([0.45, 4]).on('zoom', function (event) {
            root.attr('transform', event.transform);
        }));

        const link = root.append('g')
            .attr('stroke', 'rgba(255,255,255,0.2)')
            .attr('stroke-opacity', 0.8)
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke-width', function (d) { return Math.min(4.5, 0.6 + d.weight * 0.35); });

        const node = root.append('g')
            .attr('stroke', '#000')
            .attr('stroke-width', 1)
            .selectAll('circle')
            .data(definitions)
            .join('circle')
            .attr('r', function (d) { return Math.max(4, Math.min(14, 4 + Math.log2((d.importance || 1) + 1))); })
            .attr('fill', function (d) { return CATEGORY_COLORS[d.category] || CATEGORY_COLORS.concept; })
            .call(dragBehavior())
            .append('title')
            .text(function (d) { return `${d.title}\n${d.definition}`; });

        const labels = root.append('g')
            .selectAll('text')
            .data(definitions)
            .join('text')
            .attr('fill', '#FFFFFF')
            .attr('font-size', 10)
            .attr('dx', 8)
            .attr('dy', 3)
            .text(function (d) { return d.title.length > 24 ? `${d.title.slice(0, 24)}…` : d.title; });

        const simulation = d3.forceSimulation(definitions)
            .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(58))
            .force('charge', d3.forceManyBody().strength(-115))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(function (d) { return Math.max(8, Math.min(16, 6 + Math.log2((d.importance || 1) + 1))); }));

        simulation.on('tick', function () {
            link
                .attr('x1', function (d) { return d.source.x; })
                .attr('y1', function (d) { return d.source.y; })
                .attr('x2', function (d) { return d.target.x; })
                .attr('y2', function (d) { return d.target.y; });

            d3.select('#networkGraph g').selectAll('circle')
                .attr('cx', function (d) { return d.x; })
                .attr('cy', function (d) { return d.y; });

            labels
                .attr('x', function (d) { return d.x; })
                .attr('y', function (d) { return d.y; });
        });

        function dragBehavior() {
            function dragstarted(event) {
                if (!event.active) {
                    simulation.alphaTarget(0.3).restart();
                }
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) {
                    simulation.alphaTarget(0);
                }
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
        }
    }

    function onCrawlData(data) {
        const useBundledFallback = bundledData && data && data.metadata && data.metadata.totalConcepts === 0;
        networkData = useBundledFallback ? bundledData : data;
        const meta = networkData.metadata || data.metadata;
        updateLastUpdate(meta);
        if (useBundledFallback) {
            setCrawlerStatus('Live APIs failed, using bundled survey data.', 'warning');
        } else {
            setCrawlerStatus(`Crawler online · ${meta.sourceCount}/${meta.totalSources} sources`, (meta.failedSources || []).length ? 'warning' : 'ok');
        }
        updateProgress(100);

        if (activeTab === TAB_NETWORK) {
            renderNetwork(networkData);
        } else {
            renderStats(meta);
            renderTrending(networkData.trending || []);
        }
    }

    function startCrawler() {
        if (!window.FuturCrawler) {
            setCrawlerStatus('Crawler module unavailable.', 'error');
            return;
        }

        const stored = window.FuturCrawler.loadStoredData();
        const storedHasData = !!(stored && stored.metadata && stored.metadata.totalConcepts > 0);
        if (storedHasData) {
            networkData = stored;
            updateLastUpdate(stored.metadata);
            renderStats(stored.metadata);
            renderTrending(stored.trending || []);
            setCrawlerStatus('Loaded cached crawl data.', 'ok');
            updateProgress(100);
        }
        if (!storedHasData && typeof window.FuturCrawler.loadBundledSurveyData === 'function') {
            window.FuturCrawler.loadBundledSurveyData().then(function (bundled) {
                if (!bundled) {
                    return;
                }
                bundledData = bundled;
                networkData = bundled;
                updateLastUpdate(bundled.metadata);
                renderStats(bundled.metadata);
                renderTrending(bundled.trending || []);
                setCrawlerStatus('Loaded bundled survey data.', 'ok');
                updateProgress(100);
            });
        }

        const scheduler = window.FuturCrawler.scheduleCrawler({
            onProgress: function (update) {
                setCrawlerStatus(update.message || 'Crawling…', 'neutral');
                updateProgress(update.percentage || 0);
            },
            onData: onCrawlData,
            onError: function (error) {
                setCrawlerStatus(`Crawler error: ${error.message}`, 'error');
                updateProgress(0);
            }
        });

        crawlNowBtn.addEventListener('click', function () {
            setCrawlerStatus('Manual crawl started…', 'neutral');
            updateProgress(5);
            scheduler.runNow().catch(function () {
                setCrawlerStatus('Manual crawl failed.', 'error');
            });
        });

        scheduler.runIfNeeded().catch(function (error) {
            setCrawlerStatus(`Initial crawl failed: ${error.message}`, 'error');
        });
    }

    stanceForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const entry = inputField.value.trim();

        if (!entry) {
            return;
        }

        const categoryMatch = entry.match(/^(?<category>\S+):\s*(?<text>.+)$/) || entry.match(/^#(?<category>\S+)\s+(?<text>.+)$/);
        if (!categoryMatch || !categoryMatch.groups) {
            return;
        }

        const entries = loadEntries();
        const category = categoryMatch.groups.category;
        const text = categoryMatch.groups.text;

        if (!entries[category]) {
            entries[category] = [];
        }

        entries[category].push({
            text,
            timestamp: new Date().toLocaleTimeString()
        });

        saveEntries(entries);
        inputField.value = '';

        submitPanel.classList.add('isHidden');
        glossaryPanel.classList.remove('isHidden');

        displayGlossary();
    });

    renderTabs();
    renderPanels();
    displayGlossary();
    startCrawler();

    setInterval(displayGlossary, 4000);
});
