export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).end()
  const body = req.body || {}
  const items = Array.isArray(body.items) ? body.items : []

  // If OPENAI_API_KEY present, call OpenAI embeddings API
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
  if(key){
    try{
      const texts = items.map(i=>String(i.text || ''))
      const out = await fetch('https://api.openai.com/v1/embeddings', {
        method:'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: texts })
      })
      const json = await out.json()
      if(json && Array.isArray(json.data)){
        const embeddings = {}
        for(let i=0;i<json.data.length;i++){
          embeddings[items[i].id] = json.data[i].embedding
        }
        return res.status(200).json({ ok:true, embeddings })
      }
    }catch(e){
      console.error('openai embed error', e)
    }
  }

  // Fallback: deterministic local embedding (small dimension)
  function localEmbedding(text, dims=32){
    const t = String(text||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean)
    const vec = new Array(dims).fill(0)
    for(const w of t){
      let h=0
      for(let i=0;i<w.length;i++) h = (h*131 + w.charCodeAt(i))|0
      const idx = Math.abs(h) % dims
      vec[idx] += 1
    }
    const norm = Math.hypot(...vec) || 1
    return vec.map(v=>v/norm)
  }

  const embeddings = {}
  for(const it of items){ embeddings[it.id] = localEmbedding(it.text, 32) }
  return res.status(200).json({ ok:true, embeddings, fallback:true })
}
