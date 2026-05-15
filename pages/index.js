import { useEffect, useState } from 'react'
import LeftZone from '../components/LeftZone'
import CenterZone from '../components/CenterZone'
import RightZone from '../components/RightZone'
import sample from '../data/entries.json'

export default function Home(){
  const [entries, setEntries] = useState(sample || [])

  useEffect(()=>{
    async function load(){
      try{
        // Fetch remote entries from database/API
        const remoteRes = await fetch('/api/entries')
        const remoteData = await remoteRes.json()
        if(Array.isArray(remoteData)){
          setEntries(remoteData)
        }

        // Load live definitions from Wikipedia/Wikidata
        const defRes = await fetch('/api/fetch-definitions')
        const defData = await defRes.json()
        if(defData.ok && Array.isArray(defData.entries)){
          setEntries((prev) => {
            const existing = Array.isArray(prev) ? prev : []
            const merged = [...existing, ...defData.entries]
            // Deduplicate by id
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
  },[])

  function addEntry(e){
    if(!e || !e.id || !e.text) return
    setEntries(prev=>[...prev, e])
  }

  return (
    <div className="container-full">
      <div className="hero">
        <div>
          <h1 className="hero-title">ART AS STANCE</h1>
          <p className="hero-subtitle">A living glossary where language, participation and external data continuously reshape meaning.</p>
        </div>
        <a className="live-link" href="https://github.com/futuroneberlin/stance" target="_blank" rel="noreferrer">Code</a>
      </div>

      <div className="zones-layout">
        <div className="zone-column zone-left">
          <LeftZone entries={entries} />
        </div>
        <div className="zone-column zone-center">
          <CenterZone entries={entries} />
        </div>
        <div className="zone-column zone-right">
          <RightZone entries={entries} onAdd={addEntry} />
        </div>
      </div>
    </div>
  )
}
