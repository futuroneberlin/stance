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
    setEntries(prev=>[...prev, e])
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Art as Stance</h1>
        <a href="https://project-zp3zk.vercel.app/" target="_blank" rel="noreferrer">Live</a>
      </div>

      <div className="card">
        <h2>Über dieses Projekt</h2>
        <p>Ein dynamisches, semantisches System und wachendes Glossar — basierend auf dem bereitgestellten README.</p>
        <pre style={{whiteSpace:'pre-wrap'}}>
{`Art as Stance

Art is ...
I acted through art today by ...

Beiträge formen ein sich entwickelndes Netzwerk.`}
        </pre>
      </div>

      <EntryForm onAdd={addLocal} />
      <Visualization entries={entries} />

    </div>
  )
}
