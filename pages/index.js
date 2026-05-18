import { useEffect, useState } from 'react'
import LeftZone from '../components/LeftZone'
import CenterZone from '../components/CenterZone'
import RightZone from '../components/RightZone'
import EntryForm from '../components/EntryForm'
import RevealTransition from '../components/RevealTransition'
import ProcessingOverlay from '../components/ProcessingOverlay'
import SemanticOverlay from '../components/SemanticOverlay'
import sample from '../data/entries.json'
import { loadEntries, saveEntry } from '../lib/persistence'

export default function Home(){
  // start with an empty dataset — do not surface network or diagram on first load
  const [entries, setEntries] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [simLinks, setSimLinks] = useState([])
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  // Do NOT load remote or internet-derived data on initial page load.
  // Only fetch remote data when the user has passed the entry screen (submitted === true).
  useEffect(()=>{
    if(!submitted) return
    let mounted = true
    async function load(){
      try{
        const remoteData = await loadEntries()
        if(Array.isArray(remoteData) && mounted){
          setEntries(remoteData)
        }

        const defRes = await fetch('/api/fetch-definitions')
        const defData = await defRes.json()
        if(defData.ok && Array.isArray(defData.entries) && mounted){
          setEntries((prev) => {
            const existing = Array.isArray(prev) ? prev : []
            const merged = [...existing, ...defData.entries]
            const seen = new Set(existing.map((e) => e.id))
            return merged.filter((e) => {
              if(seen.has(e.id)) return false
              seen.add(e.id)
              return true
            })
          })
        }
      }catch(err){
        console.error('Load error:', err)
      }
    }

    load()
    return ()=>{ mounted = false }
  },[submitted])

  // central pipeline: handle raw submit from EntryForm
  async function handleSubmit({ chapterOne, chapterTwo }){
    // start processing
    setProcessing(true)
    setProcessingMessage('Saving your contribution...')

    const payloads = []
    if(chapterOne && chapterOne.trim()){
      const text = /^art is\b/i.test(chapterOne) ? chapterOne.trim() : `Art is ${chapterOne.trim()}`
      payloads.push({ text })
    }
    if(chapterTwo && chapterTwo.trim()){
      const text = /^i acted through art today by\b/i.test(chapterTwo) ? chapterTwo.trim() : `I acted through art today by ${chapterTwo.trim()}`
      payloads.push({ text })
    }

    const savedEntries = []
    try{
      // save each entry via API
      for(const p of payloads){
        setProcessingMessage('Saving contribution...')
        try{
          const entry = await saveEntry(p.text)
          if(entry && entry.id) savedEntries.push(entry)
        }catch(e){
          console.error('saveEntry failed', e)
        }
      }

      setProcessingMessage('Fetching external references...')
      // fetch external internet data
      const defRes = await fetch('/api/fetch-definitions')
      const defData = await defRes.json()
      const external = (defData && defData.entries) ? defData.entries : []

      setProcessingMessage('Building semantic relations...')
      // merge and deduplicate
      const merged = [...(entries || [])]
      for(const s of savedEntries) merged.push(s)
      for(const x of external) merged.push(x)
      const byId = new Map()
      for(const e of merged){ if(e && e.id) byId.set(e.id, e) }
      let all = Array.from(byId.values())

      // infer categories & relations for entries that lack them
      function inferCategories(text){
        const t = String(text||'').toLowerCase()
        const cat = []
        // enhanced keyword sets
        if(/memory|emotion|intuition|identity|reflection|inner|care|listen|feeling|affect|soul/.test(t)) cat.push('intrinsic')
        if(/politic|political|econom|institution|public|city|market|system|media|state|policy/.test(t)) cat.push('extrinsic')
        if(/shared|network|community|dialogue|ecology|collab|collective|participation|communal/.test(t)) cat.push('collective')
        if(/environment|nature|climate|ecology|landscape/.test(t)) cat.push('environmental')
        if(/emotion|joy|sad|anger|love|desire|longing/.test(t)) cat.push('emotional')
        // fallback broader heuristics
        if(!cat.length){
          if(t.length < 40) cat.push('concept')
          else cat.push('text')
        }
        return Array.from(new Set(cat))
      }

      function inferRelations(text){
        const words = String(text||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>3)
        // pick top unique keywords
        const freq = {}
        for(const w of words){ freq[w] = (freq[w]||0)+1 }
        const sorted = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])
        return sorted.slice(0,8)
      }

      function inferEntities(text){
        // naive NER: capitalized multi-word sequences and known patterns
        const ents = []
        const capMatches = String(text||'').match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b/g)
        if(capMatches){
          for(const m of capMatches){ if(m.length>3) ents.push(m.trim()) }
        }
        // common source patterns
        const srcMatches = String(text||'').match(/Wikipedia|Wikidata|DBpedia|Twitter|Instagram/gi)
        if(srcMatches) ents.push(...srcMatches.map(s=>s.trim()))
        return Array.from(new Set(ents))
      }

      // request embeddings from server (OpenAI if configured, otherwise local fallback)
      const embedReqItems = all.map(e=>({ id: e.id, text: e.text }))
      let embedResp = { ok:false, embeddings: {} }
      try{
        const r = await fetch('/api/embeddings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items: embedReqItems }) })
        embedResp = await r.json()
      }catch(e){ console.error('embed request failed', e) }

      const embeddings = embedResp.embeddings || {}

      all = all.map(e=>({
        ...e,
        category: Array.isArray(e.category) && e.category.length ? e.category : inferCategories(e.text),
        relations: Array.isArray(e.relations) && e.relations.length ? e.relations : inferRelations(e.text),
        entities: inferEntities(e.text),
        embedding: embeddings[e.id] || []
      }))

      // build similarity links using cosine similarity of embeddings
      function cosine(a,b){ if(!a||!b||a.length!==b.length) return 0; let s=0, na=0, nb=0; for(let i=0;i<a.length;i++){ s+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]} return s/ (Math.sqrt(na)*Math.sqrt(nb) || 1) }
      const simLinks = []
      for(let i=0;i<all.length;i++){
        for(let j=i+1;j<all.length;j++){
          const a = all[i], b = all[j]
          const sim = cosine(Array.isArray(a.embedding)?a.embedding:[], Array.isArray(b.embedding)?b.embedding:[])
          if(sim > 0.12){ // threshold
            simLinks.push({ source: a.id, target: b.id, weight: sim })
          }
        }
      }

      // attach similarity links to state for visualization and persist them
      setProcessingMessage('Connecting overlaps and clusters...')
      setEntries(all.map(e=>({ ...e })))
      setSimLinks(simLinks)

      // persist network links (Supabase or fallback file)
      try{
        await fetch('/api/network', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ links: simLinks }) })
      }catch(e){ console.error('persist network failed', e) }

      // brief pause to show progression
      await new Promise((r)=>setTimeout(r, 600))

      // cinematic reveal
      setProcessing(false)
      setRevealing(true)
      // persist 'entered' only if we actually saved user entries
      const persistEntered = savedEntries.length > 0
      setTimeout(()=>{
        setRevealing(false)
        setSubmitted(true)
        if(persistEntered){ try{ localStorage.setItem('entered','1') }catch(e){} }
      }, 1200)

    }catch(err){
      console.error('processing error', err)
      setProcessing(false)
      // fallback: reveal anyway but keep entries
      setSubmitted(true)
    }
  }

  function addEntry(e){
    if(!e || !e.id || !e.text) return
    setEntries(prev=>[...prev, e])
  }

  return (
    <div className="container-full">
      {!submitted ? (
        <div className="entry-screen">
          <EntryForm onSubmit={handleSubmit} />

          {processing && (
            <ProcessingOverlay steps={["Saving your contribution...","Analyzing semantics...","Fetching external references...","Building semantic relations...","Connecting overlaps and clusters..."]} active={processing} />
          )}

              {revealing && (
                <RevealTransition
                  entries={entries}
                  onComplete={() => {
                    setRevealing(false)
                    setSubmitted(true)
                  }}
                />
              )}
        </div>
      ) : (
        <>
          <div className="hero">
            <div>
              <h1 className="hero-title">ART AS STANCE</h1>
              <p className="hero-subtitle">A living glossary where language, participation and external data continuously reshape meaning.</p>
            </div>
            <a className="live-link" href="https://github.com/futuroneberlin/stance" target="_blank" rel="noreferrer">Code</a>
          </div>

          <div style={{ position: 'relative' }}>
            <div className="zones-wrapper" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: '0 0' }}>
              <div className="zones-layout">
                <div className="zone-column zone-left">
                  <LeftZone entries={entries} />
                </div>
                <div className="zone-column zone-center">
                  <CenterZone entries={entries} links={simLinks} />
                </div>
                <div className="zone-column zone-right">
                  <RightZone entries={entries} onSubmit={handleSubmit} />
                </div>
              </div>
            </div>

            <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
              <SemanticOverlay links={simLinks} transform={transform} onTransform={(updater)=> setTransform(prev => typeof updater === 'function' ? updater(prev) : updater)} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
