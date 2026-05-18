import { getSupabaseAdmin } from '../../lib/supabaseAdmin'
import fs from 'fs'
import path from 'path'

function getAdminKeyFromRequest(req){
  const fromHeader = req.headers['x-admin-key']
  if(fromHeader) return String(fromHeader)
  const auth = req.headers.authorization
  if(auth && auth.startsWith('Bearer ')) return auth.replace('Bearer ', '').trim()
  return ''
}

function isAdminAuthorized(req){
  const expected = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''
  if(!expected) return false
  return getAdminKeyFromRequest(req) === expected
}

export default async function handler(req, res){
  let supabase
  try{
    supabase = getSupabaseAdmin()
  }catch(e){
    // Only allow local file fallback in development to avoid accidental production behavior
    if(process.env.NODE_ENV !== 'development'){
      return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
    }

    // Fallback for local development when Supabase is not configured:
    const fallbackPath = path.join(process.cwd(), 'data', 'entries.json')
    if(req.method === 'GET'){
      try{
        const txt = fs.readFileSync(fallbackPath, 'utf8')
        const data = JSON.parse(txt || '[]')
        return res.status(200).json(Array.isArray(data) ? data : [])
      }catch(err){
        return res.status(200).json([])
      }
    }

    if(req.method === 'POST'){
      const body = req.body
      if(!body || !body.text) return res.status(400).json({error:'missing text'})
      const id = body.id || `entry_${String(Date.now())}_${Math.random().toString(36).slice(2,7)}`
      const entry = {
        id,
        text: body.text,
        category: body.category || [],
        timestamp: Math.floor(Date.now()/1000),
        relations: body.relations || [],
        source: body.source || 'user',
        moderation_status: body.moderationStatus || 'pending'
      }
      try{
        const existing = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]')
        existing.push(entry)
        fs.writeFileSync(fallbackPath, JSON.stringify(existing, null, 2), 'utf8')
        return res.status(201).json({ entry, supabase: false })
      }catch(err){
        // create file if missing
        try{
          fs.mkdirSync(path.dirname(fallbackPath), { recursive: true })
          fs.writeFileSync(fallbackPath, JSON.stringify([entry], null, 2), 'utf8')
          return res.status(201).json({ entry, supabase: false })
        }catch(err2){
          return res.status(500).json({ error: 'local fallback write failed' })
        }
      }
    }

    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const { data, error } = await supabase.from('entries').select('*').order('timestamp', { ascending: true })
    if(error) return res.status(500).json({ error: 'entries fetch failed', detail: error.message })
    return res.status(200).json(data || [])
  }

  if(req.method === 'POST'){
    const body = req.body
    if(!body || !body.text) return res.status(400).json({error:'missing text'})
    const id = body.id || `entry_${String(Date.now())}_${Math.random().toString(36).slice(2,7)}`
    const entry = {
      id,
      text: body.text,
      category: body.category || [],
      timestamp: Math.floor(Date.now()/1000),
      relations: body.relations || [],
      source: body.source || 'user',
      moderation_status: body.moderationStatus || 'pending'
    }
    const { data, error } = await supabase.from('entries').insert([entry]).select().limit(1)
    if(error) return res.status(500).json({ error: 'entry insert failed', detail: error.message })
    return res.status(201).json({ entry: data?.[0] || entry, supabase: true })
  }

  if(req.method === 'DELETE'){
    if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const id = req.query.id
    if(!id) return res.status(400).json({ error: 'missing id' })

    const { error } = await supabase.from('entries').delete().eq('id', id)
    if(error) return res.status(500).json({ error: 'entry delete failed', detail: error.message })
    return res.status(200).json({ ok: true, deletedId: id, supabase: true })
  }

  if(req.method === 'PATCH'){
    if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const id = req.query.id
    const body = req.body || {}
    const moderationStatus = body.moderationStatus
    if(!id) return res.status(400).json({ error: 'missing id' })
    if(!moderationStatus) return res.status(400).json({ error: 'missing moderationStatus' })

    const { data, error } = await supabase
      .from('entries')
      .update({ moderation_status: moderationStatus })
      .eq('id', id)
      .select()
      .limit(1)
    if(error) return res.status(500).json({ error: 'entry update failed', detail: error.message })
    return res.status(200).json({ ok: true, entry: data?.[0], supabase: true })
  }

  res.setHeader('Allow', 'GET,POST,DELETE,PATCH')
  return res.status(405).end('Method Not Allowed')
}
