import { useEffect, useMemo, useState } from 'react'

export default function AdminPage(){
  const [adminKey, setAdminKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const local = typeof window !== 'undefined' ? localStorage.getItem('admin_key') : ''
    if(local){
      setAdminKey(local)
      setSavedKey(local)
    }
  }, [])

  const hasKey = useMemo(() => Boolean(savedKey), [savedKey])

  async function loadEntries(){
    setLoading(true)
    setError('')
    try{
      const res = await fetch('/api/entries')
      const data = await res.json()
      if(!Array.isArray(data)) throw new Error('invalid response')
      setEntries(data)
    }catch(e){
      setError('Einträge konnten nicht geladen werden.')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  function saveKey(){
    const trimmed = adminKey.trim()
    if(!trimmed) return
    localStorage.setItem('admin_key', trimmed)
    setSavedKey(trimmed)
    setError('')
  }

  function clearKey(){
    localStorage.removeItem('admin_key')
    setSavedKey('')
    setAdminKey('')
  }

  async function deleteEntry(id){
    if(!savedKey){
      setError('Bitte Admin-Key speichern.')
      return
    }
    const yes = window.confirm('Eintrag wirklich loeschen?')
    if(!yes) return

    const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': savedKey
      }
    })
    const data = await res.json()
    if(!res.ok){
      setError(data.error || 'Loeschen fehlgeschlagen.')
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function updateStatus(id, moderationStatus){
    if(!savedKey){
      setError('Bitte Admin-Key speichern.')
      return
    }

    const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': savedKey
      },
      body: JSON.stringify({ moderationStatus })
    })
    const data = await res.json()
    if(!res.ok){
      setError(data.error || 'Status-Update fehlgeschlagen.')
      return
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, moderationStatus } : e)))
  }

  return (
    <div className="container">
      <h1>Admin</h1>
      <div className="card">
        <strong>Admin-Key</strong>
        <p style={{ marginTop: 8 }}>Setze den Key, um Loeschen/Status-Updates auszufuehren.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 420 }}
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Secret"
          />
          <button className="btn" type="button" onClick={saveKey}>Key speichern</button>
          <button className="btn" type="button" onClick={clearKey}>Key entfernen</button>
        </div>
        <p style={{ marginTop: 8 }}>Status: {hasKey ? 'Key vorhanden' : 'kein Key gespeichert'}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Eintraege</strong>
          <button className="btn" type="button" onClick={loadEntries}>Neu laden</button>
        </div>

        {loading && <p>Lade Eintraege ...</p>}
        {error && <p style={{ color: '#b00020' }}>{error}</p>}

        {!loading && entries.length === 0 && <p>Keine Eintraege vorhanden.</p>}

        {!loading && entries.map((entry) => (
          <div key={entry.id} style={{ borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 12 }}>
            <div><strong>ID:</strong> {entry.id}</div>
            <div style={{ marginTop: 6 }}><strong>Text:</strong> {entry.text}</div>
            <div style={{ marginTop: 6 }}><strong>Kategorie:</strong> {(entry.category || []).join(', ') || '—'}</div>
            <div style={{ marginTop: 6 }}><strong>Status:</strong> {entry.moderationStatus || entry.moderation_status || 'none'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => updateStatus(entry.id, 'approved')}>Status: approved</button>
              <button className="btn" type="button" onClick={() => updateStatus(entry.id, 'flagged')}>Status: flagged</button>
              <button className="btn" type="button" onClick={() => updateStatus(entry.id, 'none')}>Status: none</button>
              <button className="btn" type="button" onClick={() => deleteEntry(entry.id)}>Eintrag loeschen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
