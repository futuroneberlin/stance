export async function loadEntries(){
  try{
    const res = await fetch('/api/entries')
    if(!res.ok) throw new Error('load failed')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }catch(e){
    console.error('loadEntries error', e)
    return []
  }
}

export async function saveEntry(text, opts = {}){
  try{
    const body = { text, ...opts }
    const res = await fetch('/api/entries', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    if(!res.ok){
      const t = await res.text()
      throw new Error(`saveEntry failed: ${t}`)
    }
    const data = await res.json()
    return data.entry || data
  }catch(e){
    console.error('saveEntry error', e)
    throw e
  }
}

export async function loadNetwork(){
  try{
    const res = await fetch('/api/network')
    if(!res.ok) throw new Error('load network failed')
    const data = await res.json()
    return Array.isArray(data) ? data : (data.links || [])
  }catch(e){
    console.error('loadNetwork error', e)
    return []
  }
}

export async function loadNodes(){
  try{
    const res = await fetch('/api/nodes')
    if(!res.ok) throw new Error('load nodes failed')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }catch(e){
    console.error('loadNodes error', e)
    return []
  }
}

export async function loadCategories(){
  try{
    const res = await fetch('/api/categories')
    if(!res.ok) throw new Error('load categories failed')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }catch(e){
    console.error('loadCategories error', e)
    return []
  }
}

export async function loadLinks(){
  try{
    const res = await fetch('/api/links')
    if(!res.ok) throw new Error('load links failed')
    const data = await res.json()
    const rows = Array.isArray(data) ? data : []
    return rows.map((row) => ({
      id: row.id,
      source: row.source_node_id || row.source,
      target: row.target_node_id || row.target,
      weight: Number(row.weight || 0),
      relationType: row.relation_type || row.relationType || 'semantic_similarity',
      context_entry_id: row.context_entry_id || null,
      metadata: row.metadata || {}
    }))
  }catch(e){
    console.error('loadLinks error', e)
    return []
  }
}

export async function saveNetwork(links){
  try{
    const res = await fetch('/api/network', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ links }) })
    if(!res.ok){
      const t = await res.text()
      throw new Error(`saveNetwork failed: ${t}`)
    }
    const data = await res.json()
    return data
  }catch(e){
    console.error('saveNetwork error', e)
    throw e
  }
}

export async function saveNodes(nodes){
  const res = await fetch('/api/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes })
  })
  if(!res.ok){
    const t = await res.text()
    throw new Error(`saveNodes failed: ${t}`)
  }
  return res.json()
}

export async function saveCategories(categories){
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories })
  })
  if(!res.ok){
    const t = await res.text()
    throw new Error(`saveCategories failed: ${t}`)
  }
  return res.json()
}

export async function saveLinks(links){
  const res = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ links })
  })
  if(!res.ok){
    const t = await res.text()
    throw new Error(`saveLinks failed: ${t}`)
  }
  return res.json()
}
