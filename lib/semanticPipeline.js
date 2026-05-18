export function inferCategories(text){
  const t = String(text || '').toLowerCase()
  const categories = []
  if(/memory|emotion|intuition|identity|reflection|inner|care|listen|feeling|affect|soul/.test(t)) categories.push('intrinsic')
  if(/politic|political|econom|institution|public|city|market|system|media|state|policy/.test(t)) categories.push('extrinsic')
  if(/shared|network|community|dialogue|ecology|collab|collective|participation|communal/.test(t)) categories.push('collective')
  if(/environment|nature|climate|ecology|landscape/.test(t)) categories.push('environmental')
  if(/emotion|joy|sad|anger|love|desire|longing/.test(t)) categories.push('emotional')
  if(!categories.length){
    if(t.length < 40) categories.push('concept')
    else categories.push('text')
  }
  return Array.from(new Set(categories))
}

export function inferRelations(text){
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)

  const freq = {}
  for(const word of words){
    freq[word] = (freq[word] || 0) + 1
  }

  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 8)
}

export function inferEntities(text){
  const entities = []
  const caps = String(text || '').match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g)
  if(caps){
    for(const item of caps){
      if(item.length > 3) entities.push(item.trim())
    }
  }

  const sourceMatches = String(text || '').match(/Wikipedia|Wikidata|DBpedia|Twitter|Instagram/gi)
  if(sourceMatches) entities.push(...sourceMatches.map((item) => item.trim()))

  return Array.from(new Set(entities))
}

export function cosineSimilarity(a = [], b = []){
  if(!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0

  for(let i = 0; i < a.length; i += 1){
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dot / ((Math.sqrt(normA) * Math.sqrt(normB)) || 1)
}

export function buildSemanticArtifacts(entries = [], embeddings = {}){
  const all = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    category: Array.isArray(entry.category) && entry.category.length ? Array.from(new Set(entry.category)) : inferCategories(entry.text),
    relations: Array.isArray(entry.relations) && entry.relations.length ? Array.from(new Set(entry.relations)) : inferRelations(entry.text),
    entities: inferEntities(entry.text),
    embedding: Array.isArray(embeddings[entry.id]) ? embeddings[entry.id] : []
  }))

  const categoryCount = {}
  for(const entry of all){
    for(const category of (entry.category || [])){
      categoryCount[category] = (categoryCount[category] || 0) + 1
    }
  }

  const categoryPayload = Object.keys(categoryCount).map((category) => ({
    category_key: category,
    label: category,
    usage_count: categoryCount[category]
  }))

  const nodeMap = new Map()
  for(const entry of all){
    nodeMap.set(entry.id, {
      node_id: entry.id,
      label: String(entry.text || '').slice(0, 140),
      node_type: entry.source ? 'external_entry' : 'entry',
      source_entry_id: entry.id,
      metadata: { source: entry.source || 'user' }
    })

    for(const category of (entry.category || [])){
      const categoryId = `cat:${category}`
      if(!nodeMap.has(categoryId)){
        nodeMap.set(categoryId, {
          node_id: categoryId,
          label: category,
          node_type: 'category',
          source_entry_id: null,
          metadata: {}
        })
      }
    }

    for(const relation of (entry.relations || [])){
      const token = String(relation || '').trim().toLowerCase()
      if(!token) continue
      const termId = `term:${token}`
      if(!nodeMap.has(termId)){
        nodeMap.set(termId, {
          node_id: termId,
          label: token,
          node_type: 'term',
          source_entry_id: entry.id,
          metadata: {}
        })
      }
    }
  }

  const nodePayload = Array.from(nodeMap.values())

  const contextualLinks = []
  for(const entry of all){
    for(const category of (entry.category || [])){
      contextualLinks.push({
        source_node_id: entry.id,
        target_node_id: `cat:${category}`,
        relation_type: 'classified_as',
        weight: 0.85,
        context_entry_id: entry.id,
        metadata: {}
      })
    }

    for(const relation of (entry.relations || [])){
      const token = String(relation || '').trim().toLowerCase()
      if(!token) continue
      contextualLinks.push({
        source_node_id: entry.id,
        target_node_id: `term:${token}`,
        relation_type: 'mentions',
        weight: 0.65,
        context_entry_id: entry.id,
        metadata: {}
      })
    }
  }

  const similarityLinks = []
  for(let i = 0; i < all.length; i += 1){
    for(let j = i + 1; j < all.length; j += 1){
      const left = all[i]
      const right = all[j]
      const similarity = cosineSimilarity(left.embedding, right.embedding)
      if(similarity > 0.12){
        similarityLinks.push({
          source: left.id,
          target: right.id,
          weight: similarity
        })
      }
    }
  }

  const graphLinks = [
    ...contextualLinks,
    ...similarityLinks.map((link) => ({
      source_node_id: link.source,
      target_node_id: link.target,
      relation_type: 'semantic_similarity',
      weight: Number(link.weight || 0),
      context_entry_id: null,
      metadata: {}
    }))
  ]

  return {
    entries: all,
    categoryPayload,
    nodePayload,
    contextualLinks,
    similarityLinks,
    graphLinks
  }
}
