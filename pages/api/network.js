import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const dataFile = path.resolve(process.cwd(), 'data', 'network.json')

function readNetwork(){
  try{
    const raw = fs.readFileSync(dataFile,'utf8')
    return JSON.parse(raw)
  }catch(e){
    return { links: [] }
  }
}

function writeNetwork(payload){
  try{
    fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2), 'utf8')
    return true
  }catch(e){
    return false
  }
}

let supabase = null
if(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY){
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
}

export default async function handler(req, res){
  if(req.method === 'GET'){
    if(supabase){
      try{
        const { data, error } = await supabase.from('links').select('*')
        if(error) throw error
        return res.status(200).json(data)
      }catch(e){
        const net = readNetwork()
        return res.status(200).json(net.links || [])
      }
    }
    const net = readNetwork()
    return res.status(200).json(net.links || [])
  }

  if(req.method === 'POST'){
    const body = req.body || {}
    const links = Array.isArray(body.links) ? body.links : []

    if(supabase){
      try{
        // upsert links into supabase table 'links' with fields: source, target, weight
        // clear and insert for simplicity
        await supabase.from('links').delete()
        if(links.length) await supabase.from('links').insert(links.map(l=>({ source: l.source, target: l.target, weight: l.weight || 0 })))
        return res.status(200).json({ ok:true, supabase:true })
      }catch(e){
        console.error('supabase network save error', e.message||e)
        // fallback to file
      }
    }

    const ok = writeNetwork({ links })
    if(!ok) return res.status(500).json({ ok:false, error: 'could not write network file' })
    return res.status(200).json({ ok:true })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
