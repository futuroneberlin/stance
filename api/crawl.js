export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    // Wikipedia (free)
    const wikiTopics = ["Art", "Conceptual_art", "Performance_art", "Net_art", "Installation_art"];
    const wikiSummaries = await Promise.all(
      wikiTopics.map(async (t) => {
        const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
        if (!r.ok) return null;
        const j = await r.json();
        return { id: `wiki:${t}`, label: j.title, url: j.content_urls?.desktop?.page, source: "wikipedia" };
      })
    );

    // Wikidata (free SPARQL)
    const sparql = `
      SELECT ?item ?itemLabel WHERE {
        VALUES ?item { wd:Q735 wd:Q17443 wd:Q18215 wd:Q860861 }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `;
    const wdRes = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql), {
      headers: { "User-Agent": "futuroneberlin-stance/1.0 (vercel)" }
    });
    const wdJson = wdRes.ok ? await wdRes.json() : { results: { bindings: [] } };
    const wdItems = (wdJson.results.bindings || []).map((b) => ({
      id: `wd:${b.item.value}`,
      label: b.itemLabel?.value || "Wikidata item",
      url: b.item.value,
      source: "wikidata",
    }));

    // MET (free)
    const metSearch = await fetch("https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=art");
    const metSearchJson = metSearch.ok ? await metSearch.json() : { objectIDs: [] };
    const metIDs = (metSearchJson.objectIDs || []).slice(0, 10);

    const metObjects = await Promise.all(
      metIDs.map(async (id) => {
        const r = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!r.ok) return null;
        const j = await r.json();
        return {
          id: `met:${id}`,
          label: j.title || `Met Object ${id}`,
          url: j.objectURL || "",
          source: "met",
        };
      })
    );

    const nodes = [
      { id: "hub:art", label: "ART (live hub)", source: "hub" },
      ...wikiSummaries.filter(Boolean),
      ...wdItems,
      ...metObjects.filter(Boolean),
    ];

    const links = nodes
      .filter((n) => n.id !== "hub:art")
      .map((n) => ({ source: "hub:art", target: n.id, weight: 1 }));

    res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      sources: {
        wikipedia: wikiSummaries.filter(Boolean).length,
        wikidata: wdItems.length,
        met: metObjects.filter(Boolean).length,
      },
      nodes,
      links,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
