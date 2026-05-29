import { useEffect, useState } from 'react'
import EntryForm from '../components/EntryForm'

const STORAGE_KEY = 'stance-local-entries'

function readStoredEntries(){
  if(typeof window === 'undefined') return []
  try{
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  }catch(err){
    console.error('Failed to read local entries', err)
    return []
  }
}

function writeStoredEntries(entries){
  if(typeof window === 'undefined') return
  try{
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }catch(err){
    console.error('Failed to store local entries', err)
  }
}

function formatTimestamp(timestamp){
  if(!timestamp) return ''
  const value = Number(timestamp)
  if(Number.isNaN(value)) return ''
  const date = new Date(value < 1e12 ? value * 1000 : value)
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function normalizeEntryText(text){
  const trimmed = String(text || '').trim()
  if(!trimmed) return ''
  return /^art is\b/i.test(trimmed)
    ? trimmed
    : `Art is ${trimmed}`
}

export default function Home(){
  const [entries, setEntries] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(()=>{
    const storedEntries = readStoredEntries()
    setEntries(storedEntries)
    setSubmitted(storedEntries.length > 0)
    setHydrated(true)
  },[])

  useEffect(()=>{
    if(!hydrated) return
    writeStoredEntries(entries)
  },[entries, hydrated])

  async function handleSubmit({ chapterTwo }){
    const text = normalizeEntryText(chapterTwo)
    if(!text) return

    const entry = {
      id: `entry_${Date.now()}`,
      text,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'user',
      is_seed: false,
      is_visible: true,
      category: [],
      relations: []
    }

    const nextEntries = [entry, ...entries.filter((item) => item && item.id !== entry.id)]
    setEntries(nextEntries)
    setSubmitted(true)
    writeStoredEntries(nextEntries)
  }

  const latestEntry = entries[0] || null
  const archiveEntries = entries.slice(1)

  return (
    <div className="container-full">
      {!submitted ? (
        <div className="entry-screen">
          <EntryForm onSubmit={handleSubmit} />
        </div>
      ) : (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 0' }}>
          {latestEntry && (
            <div style={{ marginBottom: 24, padding: 18, background: '#fff', border: '1px solid #e8e8e8' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Submitted entry</div>
              <div style={{ fontSize: 16, lineHeight: 1.5 }}>{latestEntry.text}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{formatTimestamp(latestEntry.timestamp)}</div>
            </div>
          )}

          <div style={{ padding: 18, background: '#fff', border: '1px solid #e8e8e8' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Archive</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {archiveEntries.map((entry) => (
                <div key={entry.id} style={{ padding: 12, background: '#fafafa', borderLeft: '3px solid #ffd700' }}>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{entry.text}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{formatTimestamp(entry.timestamp)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
