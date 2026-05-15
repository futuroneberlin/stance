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
      <div className="hero">
        <div>
          <h1 className="hero-title">Admin Panel</h1>
          <p className="hero-subtitle">Manage entries, set moderation status, or delete items.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Admin Key</div>
        <p style={{ fontSize: 14, margin: '0 0 12px', color: '#666' }}>Enter your admin secret to unlock delete and status-update actions.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Secret"
          />
          <button className="btn" type="button" onClick={saveKey}>Save</button>
          <button className="btn" type="button" onClick={clearKey} style={{ background: '#ddd', color: '#222' }}>Clear</button>
        </div>
        <p style={{ fontSize: 13, margin: 0, color: '#888' }}>Status: {hasKey ? '✓ Key ready' : '— No key'}</p>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>Entries</div>
          <button className="btn" type="button" onClick={loadEntries} style={{ fontSize: 13 }}>Reload</button>
        </div>

        {loading && <p style={{ fontSize: 14, color: '#666' }}>Loading entries...</p>}
        {error && <p style={{ color: '#d9534f', fontSize: 13, margin: 0 }}>{error}</p>}

        {!loading && entries.length === 0 && <p style={{ color: '#999', fontSize: 14 }}>No entries yet.</p>}

        {!loading && entries.map((entry) => (
          <div key={entry.id} style={{ borderTop: '1px solid #e8e8e8', paddingTop: 12, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{entry.text}</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              ID: {entry.id} · {(entry.category || []).join(', ') || 'uncategorized'} · Status: {entry.moderationStatus || entry.moderation_status || 'none'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => updateStatus(entry.id, 'approved')} style={{ fontSize: 12, padding: '7px 11px' }}>→ Approve</button>
              <button className="btn" type="button" onClick={() => updateStatus(entry.id, 'flagged')} style={{ fontSize: 12, padding: '7px 11px', background: '#ffcccb' }}>→ Flag</button>
              <button className="btn" type="button" onClick={() => deleteEntry(entry.id)} style={{ fontSize: 12, padding: '7px 11px', background: '#ddd', color: '#222' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
