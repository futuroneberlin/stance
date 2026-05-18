import { getSupabaseAdmin } from '../../lib/supabaseAdmin'
import fs from 'fs'
import path from 'path'

function toKey(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
}

export default async function handler(req, res){
  let supabase
  try{
    supabase = getSupabaseAdmin()
  }catch(e){
    if(process.env.NODE_ENV !== 'development'){
      return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
    }
    const fp = path.join(process.cwd(), 'data', 'categories.json')
    if(req.method === 'GET'){
      try{ const txt = fs.readFileSync(fp,'utf8'); return res.status(200).json(JSON.parse(txt||'[]')) }catch(e){ return res.status(200).json([]) }
    }
    if(req.method === 'POST'){
      const body = req.body || {}
      const categories = Array.isArray(body.categories)? body.categories: []
      try{
        const existing = JSON.parse(fs.readFileSync(fp,'utf8')||'[]')
        const map = new Map(existing.map(c=>[c.category_key, c]))
        for(const c of categories){ const key = toKey(c.category_key||c.key||c.label||c); map.set(key, { category_key: key, label: String(c.label||c.category_key||key), description: c.description||null, usage_count: Number(c.usage_count||1) }) }
        const out = Array.from(map.values())
        fs.writeFileSync(fp, JSON.stringify(out,null,2),'utf8')
        return res.status(200).json({ ok:true, count: out.length, supabase:false })
      }catch(err){ try{ fs.writeFileSync(fp, JSON.stringify(categories,null,2),'utf8'); return res.status(200).json({ ok:true, count: categories.length, supabase:false }) }catch(e2){ return res.status(500).json({ error:'local categories write failed' }) } }
    }
    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const { data, error } = await supabase.from('categories').select('*').order('usage_count', { ascending: false })
    if(error) return res.status(500).json({ error: 'categories fetch failed', detail: error.message })
    return res.status(200).json(data || [])
  }

  if(req.method === 'POST'){
    const body = req.body || {}
    const categories = Array.isArray(body.categories) ? body.categories : []
    if(categories.length === 0) return res.status(200).json({ ok: true, count: 0, supabase: true })

    const payload = categories.map((c) => {
      if(typeof c === 'string'){
        const key = toKey(c)
        return {
          category_key: key,
          label: c,
          description: null,
          usage_count: 1
        }
      }
      const key = toKey(c.category_key || c.key || c.label)
      return {
        category_key: key,
        label: String(c.label || c.category_key || key),
        description: c.description || null,
        usage_count: Number(c.usage_count || 1)
      }
    }).filter((c) => c.category_key)

    const { error } = await supabase
      .from('categories')
      .upsert(payload, { onConflict: 'category_key' })

    if(error) return res.status(500).json({ error: 'categories upsert failed', detail: error.message })
    return res.status(200).json({ ok: true, count: payload.length, supabase: true })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
