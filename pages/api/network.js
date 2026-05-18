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
    const fp = path.join(process.cwd(), 'data', 'network.json')
    if(req.method === 'GET'){
      try{ const txt = fs.readFileSync(fp,'utf8'); return res.status(200).json(JSON.parse(txt||'[]')) }catch(e){ return res.status(200).json([]) }
    }
    if(req.method === 'POST'){
      const body = req.body || {}
      const links = Array.isArray(body.links)? body.links: []
      try{ fs.writeFileSync(fp, JSON.stringify(links,null,2),'utf8'); return res.status(200).json({ ok:true, count: links.length, supabase:false }) }catch(e){ return res.status(500).json({ error:'local network write failed' }) }
    }
    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const { data, error } = await supabase
      .from('links')
      .select('source_node_id,target_node_id,weight,relation_type')
      .eq('relation_type', 'semantic_similarity')
    if(error) return res.status(500).json({ error: 'links fetch failed', detail: error.message })
    const links = (data || []).map((row) => ({
      source: row.source_node_id,
      target: row.target_node_id,
      weight: Number(row.weight || 0),
      relationType: row.relation_type
    }))
    return res.status(200).json(links)
  }

  if(req.method === 'POST'){
    const body = req.body || {}
    const links = Array.isArray(body.links) ? body.links : []
    // replace semantic-similarity projection to keep a stable graph snapshot
    const del = await supabase.from('links').delete().eq('relation_type', 'semantic_similarity')
    if(del.error) return res.status(500).json({ error: 'links cleanup failed', detail: del.error.message })

    const payload = links.map((l) => ({
      source_node_id: l.source,
      target_node_id: l.target,
      relation_type: 'semantic_similarity',
      weight: Number(l.weight || 0)
    }))

    if(payload.length > 0){
      const ins = await supabase.from('links').insert(payload)
      if(ins.error) return res.status(500).json({ error: 'links insert failed', detail: ins.error.message })
    }

    return res.status(200).json({ ok:true, count: payload.length, supabase:true })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
