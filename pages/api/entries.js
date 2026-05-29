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

function normalizeEntry(entry){
  if(!entry || typeof entry !== 'object') return entry
  return {
    ...entry,
    category: Array.isArray(entry.category) ? entry.category : [],
    relations: Array.isArray(entry.relations) ? entry.relations : [],
    is_seed: Boolean(entry.is_seed),
    is_visible: entry.is_visible !== false,
    source: entry.source || (entry.is_seed ? 'seed' : 'user'),
    moderation_status: entry.moderation_status || entry.moderationStatus || 'pending'
  }
}

function normalizeEntryList(rows){
  return Array.isArray(rows) ? rows.map(normalizeEntry) : []
}

function readFallbackEntries(fallbackPath){
  try{
    const txt = fs.readFileSync(fallbackPath, 'utf8')
    return normalizeEntryList(JSON.parse(txt || '[]'))
  }catch(err){
    return []
  }
}

function writeFallbackEntries(fallbackPath, entries){
  fs.writeFileSync(fallbackPath, JSON.stringify(entries, null, 2), 'utf8')
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
      return res.status(200).json(readFallbackEntries(fallbackPath))
    }

    if(req.method === 'POST'){
      const body = req.body
      if(!body || !body.text) return res.status(400).json({error:'missing text'})
      const id = body.id || `entry_${String(Date.now())}_${Math.random().toString(36).slice(2,7)}`
      const entry = normalizeEntry({
        id,
        text: body.text,
        category: body.category || [],
        timestamp: Number.isFinite(Number(body.timestamp)) ? Number(body.timestamp) : Math.floor(Date.now()/1000),
        relations: body.relations || [],
        source: body.source || (body.is_seed ? 'seed' : 'user'),
        is_seed: Boolean(body.is_seed),
        is_visible: body.is_visible !== false,
        moderation_status: body.moderationStatus || body.moderation_status || 'pending'
      })
      try{
        const existing = readFallbackEntries(fallbackPath)
        existing.push(entry)
        writeFallbackEntries(fallbackPath, existing)
        return res.status(201).json({ entry, supabase: false })
      }catch(err){
        // create file if missing
        try{
          fs.mkdirSync(path.dirname(fallbackPath), { recursive: true })
          writeFallbackEntries(fallbackPath, [entry])
          return res.status(201).json({ entry, supabase: false })
        }catch(err2){
          return res.status(500).json({ error: 'local fallback write failed' })
        }
      }
    }

    if(req.method === 'DELETE'){
      if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
      const id = req.query.id
      if(!id) return res.status(400).json({ error: 'missing id' })
      const existing = readFallbackEntries(fallbackPath)
      const filtered = existing.filter((entry) => String(entry.id) !== String(id))
      writeFallbackEntries(fallbackPath, filtered)
      return res.status(200).json({ ok: true, deletedId: id, supabase: false })
    }

    if(req.method === 'PATCH'){
      if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
      const id = req.query.id
      const body = req.body || {}
      if(!id) return res.status(400).json({ error: 'missing id' })
      const existing = readFallbackEntries(fallbackPath)
      const index = existing.findIndex((entry) => String(entry.id) === String(id))
      if(index === -1) return res.status(404).json({ error: 'entry not found' })

      const updates = {}
      if(body.moderationStatus) updates.moderation_status = body.moderationStatus
      if(typeof body.is_visible === 'boolean') updates.is_visible = body.is_visible
      if(body.is_seed !== undefined) updates.is_seed = Boolean(body.is_seed)
      if(!Object.keys(updates).length) return res.status(400).json({ error: 'missing update fields' })

      existing[index] = normalizeEntry({ ...existing[index], ...updates })
      writeFallbackEntries(fallbackPath, existing)
      return res.status(200).json({ ok: true, entry: existing[index], supabase: false })
    }

    return res.status(500).json({ error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.' })
  }

  if(req.method === 'GET'){
    const { data, error } = await supabase.from('entries').select('*').order('timestamp', { ascending: true })
    if(error) return res.status(500).json({ error: 'entries fetch failed', detail: error.message })
    return res.status(200).json(normalizeEntryList(data))
  }

  if(req.method === 'POST'){
    const body = req.body
    if(!body || !body.text) return res.status(400).json({error:'missing text'})
    const id = body.id || `entry_${String(Date.now())}_${Math.random().toString(36).slice(2,7)}`
    const entry = normalizeEntry({
      id,
      text: body.text,
      category: body.category || [],
      timestamp: Number.isFinite(Number(body.timestamp)) ? Number(body.timestamp) : Math.floor(Date.now()/1000),
      relations: body.relations || [],
      source: body.source || (body.is_seed ? 'seed' : 'user'),
      is_seed: Boolean(body.is_seed),
      is_visible: body.is_visible !== false,
      moderation_status: body.moderationStatus || body.moderation_status || 'pending'
    })
    const { data, error } = await supabase.from('entries').insert([entry]).select().limit(1)
    if(error) return res.status(500).json({ error: 'entry insert failed', detail: error.message })
    return res.status(201).json({ entry: normalizeEntry(data?.[0] || entry), supabase: true })
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
    const updatePayload = {}
    if(!id) return res.status(400).json({ error: 'missing id' })
    if(moderationStatus) updatePayload.moderation_status = moderationStatus
    if(typeof body.is_visible === 'boolean') updatePayload.is_visible = body.is_visible
    if(body.is_seed !== undefined) updatePayload.is_seed = Boolean(body.is_seed)
    if(!Object.keys(updatePayload).length) return res.status(400).json({ error: 'missing update fields' })

    const { data, error } = await supabase
      .from('entries')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .limit(1)
    if(error) return res.status(500).json({ error: 'entry update failed', detail: error.message })
    return res.status(200).json({ ok: true, entry: normalizeEntry(data?.[0]), supabase: true })
  }

  res.setHeader('Allow', 'GET,POST,DELETE,PATCH')
  return res.status(405).end('Method Not Allowed')
}
