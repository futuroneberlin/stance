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
