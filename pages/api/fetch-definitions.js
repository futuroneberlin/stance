export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sources = []
  const entries = []

  // Fetch Wikipedia content for "Art"
  try{
    const wikiRes = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Art',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if(wikiRes.ok){
      const data = await wikiRes.json()
      if(data.extract){
        const sentences = data.extract
          .split(/[.!?]+/)
          .filter((s) => s.trim().length > 20)
          .slice(0, 3)
        
        sentences.forEach((sentence, idx) => {
          if(sentence.trim()){
            entries.push({
              id: `wiki_art_${idx}`,
              text: `Art is ${sentence.trim()}`,
              category: ['intrinsic', 'shared'],
              timestamp: Math.floor(Date.now() / 1000),
              relations: ['definition', 'wikipedia'],
              source: 'wikipedia',
              url: 'https://en.wikipedia.org/wiki/Art'
            })
          }
        })
        sources.push('wikipedia')
      }
    }
  }catch(e){
    console.error('Wikipedia Art fetch error:', e.message)
  }

  // Fetch Wikipedia content for "Conceptual Art"
  try{
    const wikiRes = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/summary/Conceptual_art',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
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
              id: `wiki_conceptual_${idx}`,
              text: `Art is ${sentence.trim()}`,
              category: ['extrinsic', 'intrinsic'],
              timestamp: Math.floor(Date.now() / 1000),
              relations: ['concept', 'contemporary'],
              source: 'wikipedia',
              url: 'https://en.wikipedia.org/wiki/Conceptual_art'
            })
          }
        })
      }
    }
  }catch(e){
    console.error('Wikipedia Conceptual Art fetch error:', e.message)
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

    const wdRes = await fetch(wd_url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
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
    console.error('Wikidata fetch error:', e.message)
  }

  return res.status(200).json({
    ok: true,
    entries,
    sources,
    count: entries.length
  })
}

/*
  // Datamuse API for semantic word relations
  try{
    const datRes = await fetch('https://api.datamuse.com/words?ml=art&max=5')
    if(datRes.ok){
      const data = await datRes.json()
      if(Array.isArray(data)){
        data.forEach((word, idx) => {
          entries.push({
            id: `datamuse_${idx}`,
            text: `Art relates to ${word.word}`,
            category: ['shared'],
            timestamp: Math.floor(Date.now() / 1000),
            relations: [word.word, 'semantic'],
            source: 'datamuse'
          })
        })
        sources.push('datamuse')
      }
    }
  }catch(e){
    console.error('Datamuse fetch error:', e.message)
  }

  // OpenLibrary API for art subjects
  try{
    const olRes = await fetch('https://openlibrary.org/subjects/art.json?limit=5')
    if(olRes.ok){
      const data = await olRes.json()
      if(data.works && Array.isArray(data.works)){
        data.works.slice(0, 3).forEach((work, idx) => {
          const title = work.title || ''
          const firstEd = work.first_publish_year || ''
          entries.push({
            id: `openlibrary_${idx}`,
            text: `Art is explored in "${title}" (${firstEd})`,
            category: ['intrinsic', 'shared'],
            timestamp: Math.floor(Date.now() / 1000),
            relations: [title.split(' ')[0], 'literature'],
            source: 'openlibrary'
          })
        })
        sources.push('openlibrary')
      }
    }
  }catch(e){
    console.error('OpenLibrary fetch error:', e.message)
  }

  // Wikimedia Search API
  try{
    const wsRes = await fetch('https://en.wikipedia.org/w/api.php?action=opensearch&search=art&limit=3&format=json')
    if(wsRes.ok){
      const data = await wsRes.json()
      if(Array.isArray(data) && data.length > 3){
        const titles = data[1] || []
        const descriptions = data[2] || []
        titles.forEach((title, idx) => {
          if(title && descriptions[idx]){
            entries.push({
              id: `wikimedia_${idx}`,
              text: `Art relates to ${title}: ${descriptions[idx]}`,
              category: ['extrinsic'],
              timestamp: Math.floor(Date.now() / 1000),
              relations: [title.toLowerCase(), 'search'],
              source: 'wikimedia'
            })
          }
        })
        sources.push('wikimedia')
      }
    }
  }catch(e){
    console.error('Wikimedia search fetch error:', e.message)
  }
*/
