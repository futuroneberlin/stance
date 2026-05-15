import { useState } from 'react'

export default function EntryForm({ onAdd }){
  const [artIs, setArtIs] = useState('')
  const [actedBy, setActedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
    <form onSubmit={submit} className="card entry-card">
      <div className="card-title">Contribute</div>

      <div className="chapter">
        <label className="chapter-label" htmlFor="chapter-1">Chapter I</label>
        <div className="prompt">Art is ...</div>
        <textarea
          id="chapter-1"
          className="input"
          rows={3}
          value={artIs}
          onChange={e=>setArtIs(e.target.value)}
          placeholder={'collective memory, friction, repair, future ritual'}
        />
      </div>

      <div className="chapter">
        <label className="chapter-label" htmlFor="chapter-2">Chapter II</label>
        <div className="prompt">I acted through art today by ...</div>
        <textarea
          id="chapter-2"
          className="input"
          rows={3}
          value={actedBy}
          onChange={e=>setActedBy(e.target.value)}
          placeholder={'listening carefully, drawing with neighbors, archiving street sounds'}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{marginTop:10}}>
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button>
      </div>
    </form>
  )
}
