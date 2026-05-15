import { useEffect, useState } from 'react'
import EntryForm from '../components/EntryForm'
import Visualization from '../components/Visualization'
import sample from '../data/entries.json'

export default function Home(){
  const [entries, setEntries] = useState(sample || [])
  const [loaded, setLoaded] = useState(false)

  useEffect(()=>{
    async function load(){
      try{
        // Fetch remote entries first
        const remoteRes = await fetch('/api/entries')
        const remoteData = await remoteRes.json()
        if(Array.isArray(remoteData)){
          setEntries(remoteData)
        }

        // Then load live definitions if we don't have many entries yet
        if(!Array.isArray(remoteData) || remoteData.length < 8){
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
        }
      }catch(err){
        console.error('Load error:', err)
      }finally{
        setLoaded(true)
      }
    }

    load()
  },[])

  function addLocal(e){
    if(!e || !e.id || !e.text) return
    setEntries(prev=>[...prev, e])
  }

  return (
    <div className="container">
      <div className="hero">
        <div>
          <h1 className="hero-title">ART AS STANCE</h1>
          <p className="hero-subtitle">A living glossary where language, participation and external data continuously reshape meaning.</p>
        </div>
        <a className="live-link" href="https://project-zp3zk.vercel.app/" target="_blank" rel="noreferrer">LIVE</a>
      </div>

      <div className="zones">
        <div className="zone zone-left">
          <div className="zone-label">LEFT</div>
          <p>Internet-based references and external semantic material.</p>
        </div>
        <div className="zone zone-center">
          <div className="zone-label">CENTER</div>
          <p>Overlaps, tensions and hybrid meanings in a shared relational core.</p>
        </div>
        <div className="zone zone-right">
          <div className="zone-label">RIGHT</div>
          <p>Human statements, subjective experiences and analog observations.</p>
        </div>
      </div>

      <EntryForm onAdd={addLocal} />
      <Visualization entries={entries} />
    </div>
  )
}
