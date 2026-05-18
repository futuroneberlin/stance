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
    // local fallback
    const fp = path.join(process.cwd(), 'data', 'nodes.json')
    if(req.method === 'GET'){
      try{ const txt = fs.readFileSync(fp,'utf8'); return res.status(200).json(JSON.parse(txt||'[]')) }catch(e){ return res.status(200).json([]) }
    }
    if(req.method === 'POST'){
      const body = req.body || {}
      const nodes = Array.isArray(body.nodes)? body.nodes : []
      try{
        const existing = JSON.parse(fs.readFileSync(fp,'utf8')||'[]')
        const byId = new Map(existing.map(n=>[n.node_id||n.id, n]))
        for(const n of nodes){ const id = String(n.node_id||n.id); byId.set(id, { node_id:id, label:n.label||'', node_type:n.node_type||n.type||'term', source_entry_id:n.source_entry_id||null, metadata:n.metadata||{} }) }
        const out = Array.from(byId.values())
        fs.writeFileSync(fp, JSON.stringify(out,null,2),'utf8')
        return res.status(200).json({ ok:true, count: out.length, supabase:false })
      }catch(err){ try{ fs.writeFileSync(fp, JSON.stringify(nodes,null,2),'utf8'); return res.status(200).json({ ok:true, count: nodes.length, supabase:false }) }catch(e2){ return res.status(500).json({ error:'local nodes write failed' }) } }
    }
    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const nodeType = req.query.nodeType
    const sourceEntryId = req.query.sourceEntryId

    let query = supabase.from('nodes').select('*').order('created_at', { ascending: true })
    if(nodeType) query = query.eq('node_type', nodeType)
    if(sourceEntryId) query = query.eq('source_entry_id', sourceEntryId)

    const { data, error } = await query
    if(error) return res.status(500).json({ error: 'nodes fetch failed', detail: error.message })
    return res.status(200).json(data || [])
  }

  if(req.method === 'POST'){
    const body = req.body || {}
    const nodes = Array.isArray(body.nodes) ? body.nodes : []
    if(nodes.length === 0) return res.status(200).json({ ok: true, count: 0, supabase: true })

    const payload = nodes.map((n) => ({
      node_id: String(n.node_id || n.id),
      label: String(n.label || ''),
      node_type: String(n.node_type || n.type || 'term'),
      source_entry_id: n.source_entry_id || null,
      metadata: n.metadata || {}
    }))

    const { error } = await supabase
      .from('nodes')
      .upsert(payload, { onConflict: 'node_id' })

    if(error) return res.status(500).json({ error: 'nodes upsert failed', detail: error.message })
    return res.status(200).json({ ok: true, count: payload.length, supabase: true })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
