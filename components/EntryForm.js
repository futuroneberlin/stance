import { useState } from 'react'

export default function EntryForm({ onSubmit }){
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
    e && e.preventDefault()
    setError('')

    const chapterOne = artIs.trim()
    const chapterTwo = actedBy.trim()
    if(!chapterOne && !chapterTwo){
      setError('Please fill at least one chapter.')
      return
    }

    // Pass raw inputs to parent for central processing pipeline
    try{
      setSaving(true)
      await Promise.resolve(onSubmit && onSubmit({ chapterOne, chapterTwo }))
      setArtIs('')
      setActedBy('')
    }catch(err){
      console.error(err)
      setError('Submission failed. Please try again.')
    }finally{
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="entry-screen-form">
      <h1 className="entry-title">ART AS STANCE</h1>

      <div className="entry-field">
        <label className="sr-only" htmlFor="chapter-1">Art is</label>
        <textarea
          id="chapter-1"
          className="entry-input"
          rows={3}
          value={artIs}
          onChange={e=>setArtIs(e.target.value)}
          placeholder={'Art is ...'}
        />
      </div>

      <div className="entry-field">
        <label className="sr-only" htmlFor="chapter-2">I acted through art today by</label>
        <textarea
          id="chapter-2"
          className="entry-input"
          rows={3}
          value={actedBy}
          onChange={e=>setActedBy(e.target.value)}
          placeholder={'I acted through art today by ...'}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{marginTop:18}}>
        <button className="entry-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'ENTER'}</button>
      </div>
    </form>
  )
}
