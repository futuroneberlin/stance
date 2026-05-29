import { useEffect, useMemo, useState } from 'react'
import EntryForm from '../components/EntryForm'
import CenterZone from '../components/CenterZone'
import BottomDataChannel from '../components/BottomDataChannel'
import seedEntriesData from '../data/entries.json'
import categoriesData from '../data/categories.json'
import nodesData from '../data/nodes.json'
import linksData from '../data/links.json'

const STORAGE_KEY = 'stance-local-entries'

const seedEntries = Array.isArray(seedEntriesData)
  ? seedEntriesData.filter((entry) => entry && entry.is_seed !== false)
  : []

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

function normalizeEntryText(text){
  const trimmed = String(text || '').trim()
  if(!trimmed) return ''
  return /^art is\b/i.test(trimmed)
    ? trimmed
    : `Art is ${trimmed}`
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

export default function Home(){
  const [userEntries, setUserEntries] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(()=>{
    const storedEntries = readStoredEntries()
    setUserEntries(storedEntries)
    setSubmitted(storedEntries.length > 0)
    setHydrated(true)
  },[])

  useEffect(()=>{
    if(!hydrated) return
    writeStoredEntries(userEntries)
  },[userEntries, hydrated])

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

    const nextEntries = [entry, ...userEntries.filter((item) => item && item.id !== entry.id)]
    setUserEntries(nextEntries)
    setSubmitted(true)
    writeStoredEntries(nextEntries)
  }

  const semanticEntries = useMemo(() => {
    return [...seedEntries, ...userEntries]
      .filter((entry) => entry && entry.text)
      .slice()
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
  }, [userEntries])

  const latestEntry = userEntries[0] || seedEntries[0] || null

  return (
    <div className="container-full">
      {!submitted ? (
        <div className="entry-screen">
          <EntryForm onSubmit={handleSubmit} />
        </div>
      ) : (
        <div className="cell-shell">
          <div className="cell-shell__frame">
            <CenterZone
              entries={semanticEntries}
              categories={categoriesData}
              nodes={nodesData}
              links={linksData}
              latestEntry={latestEntry}
            />

            {latestEntry && (
              <div className="cell-latest-strip">
                <div className="cell-latest-strip__label">CURRENT ENTRY</div>
                <div className="cell-latest-strip__text">{latestEntry.text}</div>
                <div className="cell-latest-strip__meta">{formatTimestamp(latestEntry.timestamp)}</div>
              </div>
            )}
          </div>

          <BottomDataChannel entries={semanticEntries} archiveEntries={userEntries} />
        </div>
      )}
    </div>
  )
}
