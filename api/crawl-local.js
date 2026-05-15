// Local mock API for testing (serves sample data)
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // Return mock data for local testing
    const mockNodes = [
      { id: "hub:art", label: "ART (live hub)", source: "hub" },
      { id: "wiki:Art", label: "Art", source: "wikipedia" },
      { id: "wiki:Conceptual_art", label: "Conceptual Art", source: "wikipedia" },
      { id: "wiki:Performance_art", label: "Performance Art", source: "wikipedia" },
      { id: "wd:Q735", label: "Art (Wikidata)", source: "wikidata" },
      { id: "wd:Q17443", label: "Painting", source: "wikidata" },
      { id: "met:1", label: "Sample Met Object", source: "met" },
    ];

    const mockLinks = mockNodes
      .filter((n) => n.id !== "hub:art")
      .map((n) => ({ source: "hub:art", target: n.id, weight: 1 }));

    res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      sources: {
        wikipedia: 3,
        wikidata: 2,
        met: 1,
      },
      nodes: mockNodes,
      links: mockLinks,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
