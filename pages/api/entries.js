import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const dataFile = path.resolve(process.cwd(), 'data', 'entries.json')

function readEntries(){
  try{
    const raw = fs.readFileSync(dataFile,'utf8')
    return JSON.parse(raw)
  }catch(e){
    return []
  }
}

function writeEntries(entries){
  try{
    fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2), 'utf8')
    return true
  }catch(e){
    return false
  }
}

let supabase = null
if(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY){
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
}

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

async function commitEntriesToGitHub(entries){
  const token = process.env.GH_WRITE_TOKEN || process.env.GITHUB_WRITE_TOKEN
  const owner = process.env.GITHUB_REPO_OWNER
  const repo = process.env.GITHUB_REPO_NAME
  const branch = process.env.GITHUB_BRANCH || 'main'
  if(!token || !owner || !repo) return { ok:false, reason: 'missing env for github commit' }

  const filePath = 'data/entries.json'
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`
  const getRes = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } })
  let sha = null
  if(getRes.status === 200){
    const json = await getRes.json()
    sha = json.sha
  }

  const content = Buffer.from(JSON.stringify(entries, null, 2)).toString('base64')
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers:{ Authorization: `token ${token}`, 'Content-Type':'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify({ message: 'chore: update entries.json', content, branch, sha })
  })

  if(commitRes.ok) return { ok:true }
  const errText = await commitRes.text()
  return { ok:false, reason: errText }
}

export default async function handler(req, res){
  if(req.method === 'GET'){
    if(supabase){
      try{
        const { data, error } = await supabase.from('entries').select('*').order('timestamp', { ascending: true })
        if(error) throw error
        return res.status(200).json(data)
      }catch(e){
        // fallback to local file
        const entries = readEntries()
        return res.status(200).json(entries)
      }
    }

    const entries = readEntries()
    return res.status(200).json(entries)
  }

  if(req.method === 'POST'){
    const body = req.body
    if(!body || !body.text) return res.status(400).json({error:'missing text'})
    const id = `entry_${String(Date.now())}`
    const entry = {
      id,
      text: body.text,
      category: body.category || [],
      timestamp: Math.floor(Date.now()/1000),
      relations: body.relations || []
    }

    if(supabase){
      try{
        const { data, error } = await supabase.from('entries').insert([entry]).select().limit(1)
        if(error) throw error
        return res.status(201).json({ entry: data[0], supabase: true })
      }catch(e){
        // continue to fallback
      }
    }

    // fallback: write locally and optionally commit to GitHub
    const entries = readEntries()
    entries.push(entry)
    const ok = writeEntries(entries)

    let ghResult = { ok:false }
    try{
      ghResult = await commitEntriesToGitHub(entries)
    }catch(e){
      ghResult = { ok:false, reason: String(e) }
    }

    if(!ok && !ghResult.ok) return res.status(500).json({error:'could not save', gh: ghResult })
    return res.status(201).json({ entry, gh: ghResult })
  }

  if(req.method === 'DELETE'){
    if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const id = req.query.id
    if(!id) return res.status(400).json({ error: 'missing id' })

    if(supabase){
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if(error) return res.status(500).json({ error: 'supabase delete failed', detail: error.message })
      return res.status(200).json({ ok: true, deletedId: id, supabase: true })
    }

    const entries = readEntries()
    const next = entries.filter((e) => e.id !== id)
    if(next.length === entries.length) return res.status(404).json({ error: 'entry not found' })
    const ok = writeEntries(next)

    let ghResult = { ok:false }
    try{
      ghResult = await commitEntriesToGitHub(next)
    }catch(e){
      ghResult = { ok:false, reason: String(e) }
    }

    if(!ok && !ghResult.ok) return res.status(500).json({ error: 'could not persist delete', gh: ghResult })
    return res.status(200).json({ ok: true, deletedId: id, gh: ghResult })
  }

  if(req.method === 'PATCH'){
    if(!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const id = req.query.id
    const body = req.body || {}
    const moderationStatus = body.moderationStatus
    if(!id) return res.status(400).json({ error: 'missing id' })
    if(!moderationStatus) return res.status(400).json({ error: 'missing moderationStatus' })

    if(supabase){
      const { data, error } = await supabase
        .from('entries')
        .update({ moderation_status: moderationStatus })
        .eq('id', id)
        .select()
        .limit(1)
      if(error) return res.status(500).json({ error: 'supabase update failed', detail: error.message })
      return res.status(200).json({ ok: true, entry: data[0], supabase: true })
    }

    const entries = readEntries()
    const idx = entries.findIndex((e) => e.id === id)
    if(idx === -1) return res.status(404).json({ error: 'entry not found' })
    const next = [...entries]
    next[idx] = { ...next[idx], moderationStatus }
    const ok = writeEntries(next)

    let ghResult = { ok:false }
    try{
      ghResult = await commitEntriesToGitHub(next)
    }catch(e){
      ghResult = { ok:false, reason: String(e) }
    }

    if(!ok && !ghResult.ok) return res.status(500).json({ error: 'could not persist update', gh: ghResult })
    return res.status(200).json({ ok: true, entry: next[idx], gh: ghResult })
  }

  res.setHeader('Allow', 'GET,POST,DELETE,PATCH')
  return res.status(405).end('Method Not Allowed')
}
