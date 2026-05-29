import { useEffect, useMemo, useState } from 'react'

function normalizeHint(text){
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
  return words[0] || 'art'
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

function buildTitle(entry){
  if(!entry) return ''
  const text = String(entry.text || '').replace(/\s+/g, ' ').trim()
  return text.length > 92 ? `${text.slice(0, 92)}…` : text
}

export default function BottomDataChannel({ entries = [], archiveEntries = [] }){
  const [externalItems, setExternalItems] = useState([])
  const [loading, setLoading] = useState(false)

  const latestEntryText = entries[0]?.text || ''

  useEffect(()=>{
    let active = true
    const hint = normalizeHint(latestEntryText)
    setLoading(true)

    fetch('/api/fetch-definitions')
      .then((response) => response.json())
      .then((data) => {
        if(!active) return
        const sourceEntries = Array.isArray(data?.entries) ? data.entries : []
        const filtered = sourceEntries.filter((entry) => (entry.text || '').toLowerCase().includes(hint))
        setExternalItems((filtered.length ? filtered : sourceEntries).slice(0, 8))
      })
      .catch(() => {
        if(!active) return
        setExternalItems([])
      })
      .finally(() => {
        if(active) setLoading(false)
      })

    return ()=>{
      active = false
    }
  }, [latestEntryText])

  const streamItems = useMemo(() => {
    const externalCards = externalItems.slice(0, 6).map((entry) => ({
      id: `external:${entry.id}`,
      title: buildTitle(entry),
      source: entry.source || 'external',
      meta: entry.url ? 'open source' : 'external reference',
      link: entry.url || '#',
      kind: 'external'
    }))

    const archiveCards = archiveEntries.slice(0, 6).map((entry) => ({
      id: `archive:${entry.id}`,
      title: buildTitle(entry),
      source: entry.is_seed ? 'seed' : 'local archive',
      meta: formatTimestamp(entry.timestamp) || 'local material',
      link: '#',
      kind: 'archive'
    }))

    return [...externalCards, ...archiveCards]
  }, [archiveEntries, externalItems])

  const loopItems = streamItems.length > 0 ? [...streamItems, ...streamItems] : []

  return (
    <div className="bottom-channel">
      <div className="bottom-channel__head">
        <div>
          <div className="bottom-channel__label">DATA CHANNEL</div>
          <div className="bottom-channel__title">material feed</div>
        </div>
        <div className="bottom-channel__meta">
          {loading ? 'refreshing sources' : `${externalItems.length} external · ${archiveEntries.length} local`}
        </div>
      </div>

      <div className="bottom-channel__track">
        <div className="bottom-channel__flow">
          {loopItems.length === 0 ? (
            <div className="bottom-channel__empty">Material stream warming up.</div>
          ) : loopItems.map((item) => (
            <a
              key={item.id}
              className={`bottom-channel__card bottom-channel__card--${item.kind}`}
              href={item.link}
              target={item.link !== '#' ? '_blank' : undefined}
              rel={item.link !== '#' ? 'noreferrer' : undefined}
            >
              <div className="bottom-channel__card-source">{item.source}</div>
              <div className="bottom-channel__card-title">{item.title}</div>
              <div className="bottom-channel__card-meta">{item.meta}</div>
            </a>
          ))}
        </div>
      </div>

      <div className="bottom-channel__archive-row">
        {archiveEntries.length === 0 ? (
          <div className="bottom-channel__archive-empty">No local archive yet.</div>
        ) : archiveEntries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="bottom-channel__archive-chip">
            <span>{entry.is_seed ? 'Seed' : 'Local'}</span>
            <strong>{buildTitle(entry)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
