import { useMemo, useState } from 'react'
import ArchiveView from './ArchiveView'

function formatTimestamp(timestamp){
  if(!timestamp) return 'No timestamp'
  const value = Number(timestamp)
  if(Number.isNaN(value)) return 'No timestamp'
  const date = new Date(value < 1e12 ? value * 1000 : value)
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export default function RightZone({ submitted = false, entries, archiveEntries = [], archiveLoading = false, archiveError = '', onSubmit, categories = [], nodes = [], links = [] }){
  const [artIs, setArtIs] = useState('')
  const [actedBy, setActedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const visibleArchiveEntries = useMemo(() => {
    return (archiveEntries && archiveEntries.length ? archiveEntries : (entries || []))
      .filter((entry) => entry.is_visible !== false && (!entry.source || entry.source === 'user' || entry.source === 'seed'))
      .slice()
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
  }, [archiveEntries, entries])

  const generatedCategoryCount = useMemo(() => {
    return visibleArchiveEntries.reduce((count, entry) => count + (Array.isArray(entry.category) ? entry.category.length : 0), 0)
  }, [visibleArchiveEntries])

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
      {!submitted ? (
        <>
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

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Semantic State</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              Entries: {archiveEntries.length} · Nodes: {nodes.length} · Links: {links.length} · Categories: {categories.length}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(categories || []).slice(0, 10).map((category) => (
                <span key={category.category_key} style={{ background:'#fff', border:'1px solid #eee', padding:'4px 8px', fontSize:12, color:'#444' }}>
                  {category.label}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Archive View</div>
          {archiveLoading ? (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Loading archive...</div>
          ) : archiveError ? (
            <div style={{ fontSize: 12, color: '#b00020', marginBottom: 12 }}>{archiveError}</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                  Stored entries: {visibleArchiveEntries.length} · Generated categories: {generatedCategoryCount}
              </div>

                <ArchiveView entries={visibleArchiveEntries} />

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {visibleArchiveEntries.length === 0 && (
                  <div style={{ fontSize: 12, color: '#888' }}>No stored entries yet.</div>
                )}
                  {visibleArchiveEntries.map((entry) => {
                  const categories = Array.isArray(entry.category) ? entry.category : []
                  return (
                    <div key={entry.id} data-node-id={entry.id} style={{ fontSize: 13, lineHeight: 1.4, padding: 12, background: '#fafafa', borderLeft: '3px solid #ffd700' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600 }}>{entry.text}</div>
                          {entry.is_seed && <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 6px', background: '#1a1a1a', color: '#fff' }}>Seed</span>}
                        </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                        {formatTimestamp(entry.timestamp)}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {categories.length === 0 && <span style={{ fontSize: 12, color: '#888' }}>No generated categories</span>}
                        {categories.map((category) => (
                          <div key={category} style={{ background:'#fff', border:'1px solid #eee', padding:'4px 8px', fontSize:12, color:'#444' }}>{category}</div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
