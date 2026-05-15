import { useState } from 'react'

export default function RightZone({ entries, onAdd }){
  const [artIs, setArtIs] = useState('')
  const [actedBy, setActedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const userEntries = (entries || []).filter((e) => !e.source || !['wikipedia', 'wikidata'].includes(e.source))

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

    const payloads = []
    if(chapterOne){
      const text = /^art is\b/i.test(chapterOne) ? chapterOne : `Art is ${chapterOne}`
      payloads.push({ text, category: inferCategories(text), relations: inferRelations(text) })
    }
    if(chapterTwo){
      const text = /^i acted through art today by\b/i.test(chapterTwo) ? chapterTwo : `I acted through art today by ${chapterTwo}`
      payloads.push({ text, category: inferCategories(text), relations: inferRelations(text) })
    }

    setSaving(true)
    try{
      for(const payload of payloads){
        const res = await fetch('/api/entries', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        const entry = data?.entry || data
        if(entry && entry.id && entry.text){
          onAdd && onAdd(entry)
        }
      }

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
            placeholder='collective memory, repair, listening'
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
            placeholder='drawing with neighbors, sharing silence'
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
          {userEntries.map((entry) => (
            <div key={entry.id} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 8, padding: 8, background: '#fafafa', borderLeft: '3px solid #ffd700' }}>
              <div>{entry.text.slice(0, 70)}...</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {(entry.category || []).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
