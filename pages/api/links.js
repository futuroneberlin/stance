import { getSupabaseAdmin } from '../../lib/supabaseAdmin'
import fs from 'fs'
import path from 'path'

export default async function handler(req, res){
  let supabase
  try{
    supabase = getSupabaseAdmin()
  }catch(e){
    if(process.env.NODE_ENV !== 'development'){
      return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
    }
    const fp = path.join(process.cwd(), 'data', 'links.json')
    if(req.method === 'GET'){
      try{ const txt = fs.readFileSync(fp,'utf8'); return res.status(200).json(JSON.parse(txt||'[]')) }catch(e){ return res.status(200).json([]) }
    }
    if(req.method === 'POST'){
      const body = req.body || {}
      const links = Array.isArray(body.links)? body.links : []
      try{
        const existing = JSON.parse(fs.readFileSync(fp,'utf8')||'[]')
        const key = (l)=>`${l.source_node_id||l.source}:::${l.target_node_id||l.target}:::${l.relation_type||l.relationType||'semantic_similarity'}`
        const map = new Map(existing.map(l=>[key(l), l]))
        for(const l of links){ const k = key(l); map.set(k, { source_node_id: String(l.source_node_id||l.source), target_node_id: String(l.target_node_id||l.target), relation_type: String(l.relation_type||l.relationType||'semantic_similarity'), weight: Number(l.weight||0), context_entry_id: l.context_entry_id||null, metadata: l.metadata||{} }) }
        const out = Array.from(map.values())
        fs.writeFileSync(fp, JSON.stringify(out,null,2),'utf8')
        return res.status(200).json({ ok:true, count: out.length, supabase:false })
      }catch(err){ try{ fs.writeFileSync(fp, JSON.stringify(links,null,2),'utf8'); return res.status(200).json({ ok:true, count: links.length, supabase:false }) }catch(e2){ return res.status(500).json({ error:'local links write failed' }) } }
    }
    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const relationType = req.query.relationType
    let query = supabase.from('links').select('*').order('created_at', { ascending: true })
    if(relationType) query = query.eq('relation_type', relationType)
    const { data, error } = await query
    if(error) return res.status(500).json({ error: 'links fetch failed', detail: error.message })
    return res.status(200).json(data || [])
  }

  if(req.method === 'POST'){
    const body = req.body || {}
    const links = Array.isArray(body.links) ? body.links : []
    if(links.length === 0) return res.status(200).json({ ok: true, count: 0, supabase: true })

    const payload = links.map((l) => ({
      source_node_id: String(l.source_node_id || l.source),
      target_node_id: String(l.target_node_id || l.target),
      relation_type: String(l.relation_type || l.relationType || 'semantic_similarity'),
      weight: Number(l.weight || 0),
      context_entry_id: l.context_entry_id || null,
      metadata: l.metadata || {}
    }))

    const { error } = await supabase
      .from('links')
      .upsert(payload, { onConflict: 'source_node_id,target_node_id,relation_type' })

    if(error) return res.status(500).json({ error: 'links upsert failed', detail: error.message })
    return res.status(200).json({ ok: true, count: payload.length, supabase: true })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
