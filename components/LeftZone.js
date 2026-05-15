export default function LeftZone({ entries }){
  const externalEntries = (entries || []).filter((e) => e.source && ['wikipedia', 'wikidata', 'wiktionary', 'dbpedia'].includes(e.source))

  return (
    <div className="zone-content">
      <div className="zone-label">LEFT</div>
      <p className="zone-intro">Internet-based references and external semantic material.</p>
      
      <div style={{ marginTop: 12 }}>
        {externalEntries.length === 0 && (
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Loading external data...</p>
        )}
        {externalEntries.map((entry) => (
          <a 
            key={entry.id} 
            href={entry.url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'block',
              textDecoration: 'none',
              fontSize: 12, 
              lineHeight: 1.5, 
              marginBottom: 10, 
              padding: 8, 
              background: '#fafafa', 
              borderLeft: '3px solid #ffd700',
              color: '#222',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
          >
            <div style={{ fontWeight: 500 }}>{entry.text.slice(0, 65)}...</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
              {entry.source} {entry.url ? '↗' : ''}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
