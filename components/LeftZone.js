import { useEffect, useState } from 'react'

export default function LeftZone({ entries }){
  const externalFromEntries = (entries || []).filter((e) => e.source && ['wikipedia', 'wikidata', 'wiktionary', 'dbpedia'].includes(e.source))
  const [externalRemote, setExternalRemote] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    // react to new user input: fetch internet-based references on demand
    // pick the most recent user-provided text as a hint
    const userTexts = (entries || []).filter(e => !e.source).map(e=>e.text || '')
    if(userTexts.length === 0) return
    const latest = userTexts[userTexts.length-1]
    const words = String(latest||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>4)
    const hint = words[0] || ''
    setLoading(true)
    fetch('/api/fetch-definitions').then(r=>r.json()).then((data)=>{
      if(data && Array.isArray(data.entries)){
        if(hint){
          const filtered = data.entries.filter(en => (en.text||'').toLowerCase().includes(hint))
          setExternalRemote(filtered.length ? filtered : data.entries)
        }else{
          setExternalRemote(data.entries)
        }
      }
    }).catch(()=>{
      setExternalRemote([])
    }).finally(()=> setLoading(false))
  },[entries])

  const externalEntries = externalRemote.length ? externalRemote : externalFromEntries

  return (
    <div className="zone-content">
      <div className="zone-label">LEFT</div>
      <p className="zone-intro">Internet-based references and external semantic material.</p>
      
      <div style={{ marginTop: 12 }}>
        {loading && (
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Loading external data...</p>
        )}
        {(!loading && externalEntries.length === 0) && (
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>No external matches found yet.</p>
        )}
        {externalEntries.map((entry) => (
          <a 
            key={entry.id} 
            data-node-id={entry.id}
            href={entry.url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'block',
              textDecoration: 'none',
              fontSize: 12, 
              lineHeight: 1.5, 
              marginBottom: 10, 
              padding: 8, 
              background: '#fafafa', 
              borderLeft: '3px solid #ffd700',
              color: '#222',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
          >
            <div style={{ fontWeight: 500 }}>{(entry.text||'').slice(0, 65)}{(entry.text||'').length>65 ? '...' : ''}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
              {entry.source} {entry.url ? '↗' : ''}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
