export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sources = []
  const entries = []

  // Fetch Wikipedia content for "Art"
  try{
    const wikiRes = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Art'
    )
    if(wikiRes.ok){
      const data = await wikiRes.json()
      if(data.extract){
        const sentences = data.extract
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 20)
          .slice(0, 2)
        
        sentences.forEach((sentence, idx) => {
          if(sentence.trim()){
            entries.push({
              id: `wiki_art_${idx}`,
              text: `Art is ${sentence.trim()}`,
              category: ['intrinsic', 'shared'],
              timestamp: Math.floor(Date.now() / 1000),
              relations: ['definition', 'wikipedia'],
              source: 'wikipedia'
            })
          }
        })
        sources.push('wikipedia')
      }
    }
  }catch(e){
    console.error('Wikipedia fetch error:', e)
  }

  // Fetch Wikipedia content for "Conceptual Art"
  try{
    const wikiRes = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Conceptual_art'
    )
    if(wikiRes.ok){
      const data = await wikiRes.json()
      if(data.extract){
        const sentence = data.extract
          .split(/[.!?]+/)[0]
          .trim()
        if(sentence.length > 20){
          entries.push({
            id: `wiki_conceptual_art`,
            text: `Art is ${sentence}`,
            category: ['extrinsic', 'intrinsic'],
            timestamp: Math.floor(Date.now() / 1000),
            relations: ['concept', 'contemporary'],
            source: 'wikipedia'
          })
        }
      }
    }
  }catch(e){
    console.error('Conceptual Art fetch error:', e)
  }

  // Fetch Wikidata for art-related concepts
  try{
    const sparql = `
SELECT ?label ?description WHERE {
  ?item wdt:P31 wd:Q838948.
  ?item rdfs:label ?label.
  ?item schema:description ?description.
  FILTER(LANG(?label) = "en")
  FILTER(LANG(?description) = "en")
}
LIMIT 3
    `.trim()

    const wd_url = new URL('https://query.wikidata.org/sparql')
    wd_url.searchParams.set('query', sparql)
    wd_url.searchParams.set('format', 'json')

    const wdRes = await fetch(wd_url.toString())
    if(wdRes.ok){
      const data = await wdRes.json()
      if(data.results && data.results.bindings){
        data.results.bindings.forEach((binding, idx) => {
          const label = binding.label?.value
          const desc = binding.description?.value
          if(label && desc){
            entries.push({
              id: `wikidata_${idx}`,
              text: `Art is ${desc}`,
              category: ['intrinsic'],
              timestamp: Math.floor(Date.now() / 1000),
              relations: ['concept', label.toLowerCase()],
              source: 'wikidata'
            })
          }
        })
        sources.push('wikidata')
      }
    }
  }catch(e){
    console.error('Wikidata fetch error:', e)
  }

  return res.status(200).json({
    ok: true,
    entries,
    sources,
    count: entries.length
  })
}
