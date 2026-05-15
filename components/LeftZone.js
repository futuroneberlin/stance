export default function LeftZone({ entries }){
  const externalEntries = (entries || []).filter((e) => e.source && ['wikipedia', 'wikidata'].includes(e.source))

  return (
    <div className="zone-content">
      <div className="zone-label">LEFT</div>
      <p className="zone-intro">Internet-based references and external semantic material.</p>
      
      <div style={{ marginTop: 12 }}>
        {externalEntries.length === 0 && (
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Loading external data...</p>
        )}
        {externalEntries.map((entry) => (
          <div key={entry.id} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10, padding: 8, background: '#fafafa', borderLeft: '3px solid #ffd700' }}>
            <div style={{ fontWeight: 500 }}>{entry.text.slice(0, 60)}...</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{entry.source}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
