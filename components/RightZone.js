import { useState } from 'react'

export default function RightZone({ entries, onSubmit }){
  const [artIs, setArtIs] = useState('')
  const [actedBy, setActedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const userEntries = (entries || []).filter((e) => !e.source || !['wikipedia', 'wikidata', 'wiktionary', 'dbpedia'].includes(e.source))

  function inferCategories(text){
    const t = String(text || '').toLowerCase()
    const cat = []
    if(/memory|emotion|intuition|identity|reflection|inner|care|listen/.test(t)) cat.push('intrinsic')
    if(/politic|econom|institution|public|city|market|system|media/.test(t)) cat.push('extrinsic')
    if(/shared|network|community|dialogue|ecology|collab|collective|participation/.test(t)) cat.push('shared')
    if(!cat.length) cat.push('shared')
    return cat
  }

  function inferRelations(text){
    const words = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4)
    const unique = Array.from(new Set(words))
    return unique.slice(0, 6)
  }

  async function submit(e){
    e.preventDefault()
    setError('')

    const chapterOne = artIs.trim()
    const chapterTwo = actedBy.trim()
    if(!chapterOne && !chapterTwo){
      setError('Please fill at least one chapter.')
      return
    }

    setSaving(true)
    try{
      // delegate to central pipeline
      await Promise.resolve(onSubmit && onSubmit({ chapterOne, chapterTwo }))
      setArtIs('')
      setActedBy('')
    }catch(err){
      console.error(err)
      setError('Saving failed. Please try again.')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="zone-content">
      <div className="zone-label">RIGHT</div>
      <p className="zone-intro">Human statements, subjective experiences and analog observations.</p>
      
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Art is ...</label>
          <textarea
            className="input"
            rows={2}
            value={artIs}
            onChange={e=>setArtIs(e.target.value)}
            placeholder=''
            style={{ fontSize: 13 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>I acted through art today by ...</label>
          <textarea
            className="input"
            rows={2}
            value={actedBy}
            onChange={e=>setActedBy(e.target.value)}
            placeholder=''
            style={{ fontSize: 13 }}
          />
        </div>

        {error && <p style={{ color: '#d9534f', fontSize: 12, margin: '8px 0' }}>{error}</p>}

        <button className="btn" type="submit" disabled={saving} style={{ fontSize: 13, width: '100%' }}>
          {saving ? 'Saving...' : 'Submit'}
        </button>
      </form>

      {userEntries.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Your Contributions</div>
          {userEntries.map((entry) => {
            const related = (entries || []).filter((e) => e.id !== entry.id && Array.isArray(e.category) && Array.isArray(entry.category) && e.category.some(c=>entry.category.includes(c)))
            return (
              <div key={entry.id} data-node-id={entry.id} style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 12, padding: 12, background: '#fafafa', borderLeft: '3px solid #ffd700' }}>
                <div style={{ fontWeight:600, marginBottom:6 }}>{entry.text}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {(entry.category || []).map((c) => (
                    <div key={c} style={{ background:'#fff', border:'1px solid #eee', padding:'4px 8px', fontSize:12, color:'#444' }}>{c}</div>
                  ))}
                </div>
                <div style={{ fontSize:12, color:'#666' }}>
                  Connections: {related.length} {related.length>0 && `· Related: ${related.slice(0,3).map(r=>r.text.slice(0,40)).join(' — ')}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
