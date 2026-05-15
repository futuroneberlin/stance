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
              source: 'wikidata',
              url: `https://www.wikidata.org/wiki/Q838948`
            })
          }
        })
        sources.push('wikidata')
      }
    }
  }catch(e){
    console.error('Wikidata fetch error:', e)

    // Fetch from Wiktionary for "Art" definition
    try{
      const wiktRes = await fetch(
        'https://en.wiktionary.org/api/rest_v1/page/summary/art'
      )
      if(wiktRes.ok){
        const data = await wiktRes.json()
        if(data.extract){
          const defs = data.extract
            .split(/definition|meaning|noun/i)
            .slice(1, 3)
            .map(s => s.trim())
            .filter(s => s.length > 15)
        
          defs.forEach((def, idx) => {
            if(def && !entries.some(e => e.text.includes(def.slice(0, 20)))){
              entries.push({
                id: `wiktionary_${idx}`,
                text: `Art is ${def.split(/[.!?]/)[0].trim()}`,
                category: ['intrinsic'],
                timestamp: Math.floor(Date.now() / 1000),
                relations: ['definition', 'wiktionary'],
                source: 'wiktionary',
                url: 'https://en.wiktionary.org/wiki/art'
              })
            }
          })
          sources.push('wiktionary')
        }
      }
    }catch(e){
      console.error('Wiktionary fetch error:', e)
    }

    // Fetch from DBpedia
    try{
      const dbpRes = await fetch(
        'https://dbpedia.org/data/Art.json'
      )
      if(dbpRes.ok){
        const data = await dbpRes.json()
        const abstractObj = data['http://dbpedia.org/resource/Art']
        if(abstractObj && abstractObj['http://purl.org/dc/terms/abstract']){
          const abstract = abstractObj['http://purl.org/dc/terms/abstract'][0]?.value
          if(abstract && abstract.length > 30){
            const sentences = abstract.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 1)
            sentences.forEach((sent, idx) => {
              entries.push({
                id: `dbpedia_${idx}`,
                text: `Art is ${sent.trim()}`,
                category: ['intrinsic'],
                timestamp: Math.floor(Date.now() / 1000),
                relations: ['definition', 'reference'],
                source: 'dbpedia',
                url: 'https://dbpedia.org/resource/Art'
              })
            })
            sources.push('dbpedia')
          }
        }
      }
    }catch(e){
      console.error('DBpedia fetch error:', e)
    }

    // Add URLs to Wikipedia entries for clickability
    const entriesWithUrls = entries.map(e => {
      if(!e.url && e.source === 'wikipedia'){
        if(e.id.includes('art')){
          e.url = 'https://en.wikipedia.org/wiki/Art'
        }else if(e.id.includes('conceptual')){
          e.url = 'https://en.wikipedia.org/wiki/Conceptual_art'
        }
      }
      return e
    })

    return res.status(200).json({
      ok: true,
      entries,
      sources,
      count: entries.length
    })
  }

  return res.status(200).json({
    ok: true,
    entries: entriesWithUrls,
    sources,
    count: entries.length
  })
}
