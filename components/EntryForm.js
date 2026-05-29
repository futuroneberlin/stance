import { useState } from 'react'

export default function EntryForm({ onSubmit }){
  const [actedBy, setActedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e){
    e && e.preventDefault()
    setError('')

    const chapterTwo = actedBy.trim()
    if(!chapterTwo){
      setError('Please fill the field before submitting.')
      return
    }

    // Pass raw inputs to parent for central processing pipeline
    try{
      setSaving(true)
      await Promise.resolve(onSubmit && onSubmit({ chapterTwo }))
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
