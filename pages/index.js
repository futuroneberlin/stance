import { useEffect, useState } from 'react'
import EntryForm from '../components/EntryForm'
import Visualization from '../components/Visualization'
import sample from '../data/entries.json'

export default function Home(){
  const [entries, setEntries] = useState(sample || [])

  useEffect(()=>{
    // fetch remote entries if available
    fetch('/api/entries').then(r=>r.json()).then(data=>{ if(Array.isArray(data)) setEntries(data) }).catch(()=>{})
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
