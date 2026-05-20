import { useEffect, useState } from 'react'
import LeftZone from '../components/LeftZone'
import CenterZone from '../components/CenterZone'
import RightZone from '../components/RightZone'
import EntryForm from '../components/EntryForm'
import RevealTransition from '../components/RevealTransition'
import ProcessingOverlay from '../components/ProcessingOverlay'
import SemanticOverlay from '../components/SemanticOverlay'
import { loadEntries, loadNetwork, loadCategories, loadNodes, loadLinks, saveCategories, saveEntry, saveLinks, saveNetwork, saveNodes } from '../lib/persistence'
import { buildSemanticArtifacts } from '../lib/semanticPipeline'

export default function Home(){
  const [entries, setEntries] = useState([])
  const [nodes, setNodes] = useState([])
  const [categories, setCategories] = useState([])
  const [links, setLinks] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [simLinks, setSimLinks] = useState([])
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  useEffect(()=>{
    // Restore the archive view if the user already entered it in this browser session.
    try{
      if(localStorage.getItem('stance-journey') === '1'){
        setSubmitted(true)
      }
    }catch(e){}

    // Clear only the old legacy key so the first screen still works on a fresh visit.
    try{
      localStorage.removeItem('entered')
    }catch(e){}
  },[])

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

        const persistedLinks = await loadNetwork()
        if(Array.isArray(persistedLinks) && mounted){
          setSimLinks(persistedLinks)
        }

        const persistedCategories = await loadCategories()
        if(Array.isArray(persistedCategories) && mounted){
          setCategories(persistedCategories)
        }

        const persistedNodes = await loadNodes()
        if(Array.isArray(persistedNodes) && mounted){
          setNodes(persistedNodes)
        }

        const persistedGraphLinks = await loadLinks()
        if(Array.isArray(persistedGraphLinks) && mounted){
          setLinks(persistedGraphLinks)
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

    try{
      localStorage.removeItem('entered')
      localStorage.removeItem('stance-journey')
    }catch(e){}

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

      // verify insertion succeeded by reloading persisted entries
      try{
        const persisted = await loadEntries()
        if(Array.isArray(persisted)){
          // ensure saved entries appear in persisted list; merge if necessary
          const byId = new Map(persisted.map((e)=>[String(e.id), e]))
          for(const se of savedEntries){ if(se && se.id) byId.set(String(se.id), se) }
          const merged = Array.from(byId.values())
          setEntries(merged)
        }
      }catch(e){
        console.warn('Failed to reload entries after save', e)
        // fallback: include saved entries into current state
        if(savedEntries.length){
          setEntries((prev)=>{
            const byId = new Map((Array.isArray(prev)?prev:[]).map(e=>[String(e.id), e]))
            for(const se of savedEntries){ if(se && se.id) byId.set(String(se.id), se) }
            return Array.from(byId.values())
          })
        }
      }

      setProcessingMessage('Fetching external references...')
      // fetch external internet data
      const defRes = await fetch('/api/fetch-definitions')
      const defData = await defRes.json()
      const external = (defData && defData.entries) ? defData.entries : []

      // request embeddings from server (OpenAI if configured, otherwise local fallback)
      const merged = [...(entries || []), ...savedEntries, ...external]
      const byId = new Map()
      for(const e of merged){ if(e && e.id) byId.set(e.id, e) }
      const all = Array.from(byId.values())

      const embedReqItems = all.map((e)=>({ id: e.id, text: e.text }))
      let embedResp = { ok:false, embeddings: {} }
      try{
        const r = await fetch('/api/embeddings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items: embedReqItems }) })
        embedResp = await r.json()
      }catch(e){ console.error('embed request failed', e) }

      const embeddings = embedResp.embeddings || {}
      const artifacts = buildSemanticArtifacts(all, embeddings)
      const semanticEntries = artifacts.entries
      const simLinks = artifacts.similarityLinks

      // attach similarity links to state for visualization and persist them
      setProcessingMessage('Connecting overlaps and clusters...')
      setEntries(semanticEntries.map((e)=>({ ...e })))
      setSimLinks(simLinks)
      setCategories(artifacts.categoryPayload)
      setNodes(artifacts.nodePayload)
      setLinks(artifacts.graphLinks)

      // materialize semantic graph artifacts for persistent storage
      // persist graph data in Supabase
      try{
        await saveCategories(artifacts.categoryPayload)
        await saveNodes(artifacts.nodePayload)
        await saveLinks(artifacts.graphLinks)
        await saveNetwork(simLinks)
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
        try{ localStorage.setItem('stance-journey','1') }catch(e){}
      }, 1200)

    }catch(err){
      console.error('processing error', err)
      setProcessing(false)
      // fallback: reveal anyway but keep entries
      setSubmitted(true)
    }
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
                  <CenterZone entries={entries} links={links.length ? links : simLinks} categories={categories} nodes={nodes} />
                </div>
                <div className="zone-column zone-right">
                  <RightZone submitted={submitted} entries={entries} onSubmit={handleSubmit} categories={categories} nodes={nodes} links={links} />
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
