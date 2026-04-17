(function () {
  const UPDATE_INTERVAL_MS = 7 * 60 * 60 * 1000;
  const STORAGE_KEYS = {
    rawPrefix: 'futurOne.web.raw.',
    definitions: 'futurOne.survey.definitions',
    connections: 'futurOne.survey.connections',
    metadata: 'futurOne.survey.metadata'
  };

  const STOP_WORDS = new Set([
    'about', 'after', 'also', 'among', 'because', 'between', 'concept', 'concepts', 'from', 'into', 'into',
    'many', 'more', 'most', 'only', 'than', 'that', 'their', 'there', 'these', 'this', 'those', 'through',
    'where', 'which', 'while', 'with', 'without', 'would', 'been', 'being', 'what', 'when', 'were', 'have',
    'has', 'had', 'over', 'under', 'your', 'them', 'they', 'used', 'often', 'form', 'forms', 'work', 'works',
    'practice', 'artist', 'artists', 'movement', 'style', 'styles', 'object', 'objects', 'museum', 'museums',
    'visual', 'history', 'modern', 'contemporary', 'world', 'time', 'like'
  ]);

  const categoryKeywords = [
    { key: 'movement', words: ['ism', 'movement', 'school'] },
    { key: 'medium', words: ['paint', 'sculpture', 'drawing', 'photography', 'print', 'digital', 'installation'] },
    { key: 'theory', words: ['theory', 'aesthetic', 'philosophy', 'critique', 'discourse'] },
    { key: 'institution', words: ['museum', 'gallery', 'collection', 'archive'] },
    { key: 'person', words: ['artist', 'maker', 'author', 'painter', 'sculptor'] }
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function stripHtml(input) {
    return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function tokenise(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  }

  function categorise(definition) {
    const sample = `${definition.title} ${definition.definition}`.toLowerCase();
    const hit = categoryKeywords.find((entry) => entry.words.some((word) => sample.includes(word)));
    return hit ? hit.key : 'concept';
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async function fetchWikipedia() {
    const raw = await fetchJson('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=art%20concepts&srlimit=20&format=json&origin=*');
    const results = (raw.query && raw.query.search) || [];
    const definitions = results.map((item) => ({
      id: `wikipedia-${item.pageid}`,
      source: 'wikipedia',
      title: item.title,
      definition: stripHtml(item.snippet),
      importance: Math.max(1, item.size || 1)
    }));
    return { raw, definitions };
  }

  async function fetchWikidata() {
    const raw = await fetchJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=art%20concepts&language=en&limit=20&format=json&origin=*');
    const results = raw.search || [];
    const definitions = results.map((item) => ({
      id: `wikidata-${item.id}`,
      source: 'wikidata',
      title: item.label,
      definition: item.description || 'No description available.',
      importance: Number(item.match && item.match.score) || 1
    }));
    return { raw, definitions };
  }

  async function fetchMetMuseum() {
    const searchRaw = await fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/search?q=art&hasImages=true');
    const objectIds = (searchRaw.objectIDs || []).slice(0, 12);
    const detailList = await Promise.all(
      objectIds.map((id) => fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`))
    );

    const definitions = detailList.map((item) => ({
      id: `met-${item.objectID}`,
      source: 'metmuseum',
      title: item.title || item.objectName || `Object ${item.objectID}`,
      definition: [item.objectName, item.classification, item.period, item.artistDisplayName].filter(Boolean).join(' · '),
      importance: item.isPublicDomain ? 8 : 4
    }));

    return {
      raw: {
        search: searchRaw,
        objects: detailList
      },
      definitions
    };
  }

  async function fetchRijksmuseum() {
    const raw = await fetchJson('https://www.rijksmuseum.nl/api/en/collection?key=0fiuZFh4&format=json&ps=20&imgonly=True');
    const items = raw.artObjects || [];
    const definitions = items.map((item) => ({
      id: `rijks-${item.objectNumber}`,
      source: 'rijksmuseum',
      title: item.title,
      definition: [item.longTitle, item.principalOrFirstMaker].filter(Boolean).join(' · '),
      importance: item.hasImage ? 7 : 3
    }));
    return { raw, definitions };
  }

  function dedupeDefinitions(list) {
    const map = new Map();
    list.forEach((item) => {
      if (!item || !item.title) {
        return;
      }
      const key = `${item.source}:${item.id || item.title.toLowerCase()}`;
      if (!map.has(key)) {
        const normalized = {
          ...item,
          definition: String(item.definition || '').trim(),
          importance: Number(item.importance) || 1,
          category: item.category || categorise(item)
        };
        map.set(key, normalized);
      }
    });
    return Array.from(map.values());
  }

  function createConnections(definitions) {
    const tokenMap = new Map();

    definitions.forEach((item) => {
      const uniqueTokens = new Set(tokenise(`${item.title} ${item.definition}`));
      uniqueTokens.forEach((token) => {
        if (!tokenMap.has(token)) {
          tokenMap.set(token, []);
        }
        tokenMap.get(token).push(item.id);
      });
    });

    const edgeMap = new Map();

    tokenMap.forEach((ids, token) => {
      if (ids.length < 2 || ids.length > 12) {
        return;
      }
      for (let i = 0; i < ids.length - 1; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const source = ids[i];
          const target = ids[j];
          const key = source < target ? `${source}::${target}` : `${target}::${source}`;
          const existing = edgeMap.get(key) || { source, target, weight: 0, sharedTerms: [] };
          existing.weight += 1;
          existing.sharedTerms.push(token);
          edgeMap.set(key, existing);
        }
      }
    });

    return Array.from(edgeMap.values())
      .filter((edge) => edge.weight > 1)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 180);
  }

  function createTrending(definitions, connections) {
    const byId = new Map(definitions.map((item) => [item.id, item]));
    return connections.slice(0, 8).map((edge) => {
      const left = byId.get(edge.source);
      const right = byId.get(edge.target);
      return {
        source: edge.source,
        target: edge.target,
        sourceLabel: left ? left.title : edge.source,
        targetLabel: right ? right.title : edge.target,
        weight: edge.weight,
        sharedTerms: edge.sharedTerms.slice(0, 4)
      };
    });
  }

  function persistResults(results) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    Object.keys(results.rawData).forEach((source) => {
      localStorage.setItem(`${STORAGE_KEYS.rawPrefix}${source}`, JSON.stringify(results.rawData[source]));
    });
    localStorage.setItem(STORAGE_KEYS.definitions, JSON.stringify(results.definitions));
    localStorage.setItem(STORAGE_KEYS.connections, JSON.stringify(results.connections));
    localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify(results.metadata));
  }

  function loadStoredData() {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const definitions = JSON.parse(localStorage.getItem(STORAGE_KEYS.definitions) || '[]');
      const connections = JSON.parse(localStorage.getItem(STORAGE_KEYS.connections) || '[]');
      const metadata = JSON.parse(localStorage.getItem(STORAGE_KEYS.metadata) || 'null');
      if (!metadata) {
        return null;
      }

      const rawData = {
        wikipedia: JSON.parse(localStorage.getItem(`${STORAGE_KEYS.rawPrefix}wikipedia`) || 'null'),
        rijksmuseum: JSON.parse(localStorage.getItem(`${STORAGE_KEYS.rawPrefix}rijksmuseum`) || 'null'),
        metmuseum: JSON.parse(localStorage.getItem(`${STORAGE_KEYS.rawPrefix}metmuseum`) || 'null'),
        wikidata: JSON.parse(localStorage.getItem(`${STORAGE_KEYS.rawPrefix}wikidata`) || 'null')
      };

      return {
        rawData,
        definitions,
        connections,
        metadata,
        trending: createTrending(definitions, connections)
      };
    } catch (error) {
      return null;
    }
  }

  async function loadBundledSurveyData() {
    try {
      const [definitions, connections, metadata] = await Promise.all([
        fetchJson('/public/survey/definitions.json'),
        fetchJson('/public/survey/connections.json'),
        fetchJson('/public/survey/metadata.json')
      ]);

      if (!Array.isArray(definitions) || !Array.isArray(connections) || !metadata) {
        return null;
      }

      return {
        rawData: {
          wikipedia: null,
          rijksmuseum: null,
          metmuseum: null,
          wikidata: null
        },
        definitions,
        connections,
        metadata,
        trending: createTrending(definitions, connections)
      };
    } catch (error) {
      return null;
    }
  }

  function shouldRefresh(metadata) {
    if (!metadata || !metadata.lastUpdate) {
      return true;
    }
    const elapsed = Date.now() - new Date(metadata.lastUpdate).getTime();
    return Number.isNaN(elapsed) || elapsed >= UPDATE_INTERVAL_MS;
  }

  async function crawlArtDefinitions(onProgress) {
    const progress = typeof onProgress === 'function' ? onProgress : function () {};
    const sources = [
      { key: 'wikipedia', label: 'Wikipedia', fetcher: fetchWikipedia },
      { key: 'rijksmuseum', label: 'Rijksmuseum', fetcher: fetchRijksmuseum },
      { key: 'metmuseum', label: 'Met Museum', fetcher: fetchMetMuseum },
      { key: 'wikidata', label: 'Wikidata', fetcher: fetchWikidata }
    ];

    const rawData = {};
    const allDefinitions = [];
    const failedSources = [];

    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      progress({
        stage: 'fetching',
        source: source.key,
        message: `Fetching ${source.label}…`,
        percentage: Math.round((index / sources.length) * 100)
      });

      try {
        const result = await source.fetcher();
        rawData[source.key] = result.raw;
        allDefinitions.push(...result.definitions);
      } catch (error) {
        failedSources.push({ source: source.key, message: error.message });
        rawData[source.key] = { error: error.message, at: nowIso() };
      }
    }

    const definitions = dedupeDefinitions(allDefinitions);
    const connections = createConnections(definitions);
    const metadata = {
      lastUpdate: nowIso(),
      sourceCount: sources.length - failedSources.length,
      totalSources: sources.length,
      totalConcepts: definitions.length,
      totalConnections: connections.length,
      failedSources
    };

    const results = {
      rawData,
      definitions,
      connections,
      metadata,
      trending: createTrending(definitions, connections)
    };

    persistResults(results);

    progress({
      stage: 'done',
      message: failedSources.length ? 'Completed with partial source failures.' : 'Crawl completed successfully.',
      percentage: 100
    });

    return results;
  }

  function scheduleCrawler(options) {
    const opts = options || {};
    let running = false;

    const run = async function (force) {
      if (running) {
        return null;
      }
      const existing = loadStoredData();
      if (!force && existing && !shouldRefresh(existing.metadata)) {
        if (typeof opts.onData === 'function') {
          opts.onData(existing);
        }
        return existing;
      }

      running = true;
      try {
        const result = await crawlArtDefinitions(opts.onProgress);
        if (typeof opts.onData === 'function') {
          opts.onData(result);
        }
        return result;
      } catch (error) {
        if (typeof opts.onError === 'function') {
          opts.onError(error);
        }
        throw error;
      } finally {
        running = false;
      }
    };

    const timerId = setInterval(function () {
      run(false).catch(function () {});
    }, UPDATE_INTERVAL_MS);

    return {
      runNow: function () {
        return run(true);
      },
      runIfNeeded: function () {
        return run(false);
      },
      stop: function () {
        clearInterval(timerId);
      }
    };
  }

  window.FuturCrawler = {
    UPDATE_INTERVAL_MS,
    crawlArtDefinitions,
    scheduleCrawler,
    loadStoredData,
    loadBundledSurveyData
  };
})();
