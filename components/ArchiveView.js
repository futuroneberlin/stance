import React from 'react'

export default function ArchiveView({ entries = [] }){
  const buckets = {}
  for(const e of entries){
    const ts = e.timestamp || Math.floor(Date.now()/1000)
    const year = new Date(ts*1000).getFullYear()
    buckets[year] = (buckets[year] || 0) + 1
  }
  const years = Object.keys(buckets).map(Number).sort((a,b)=>a-b)
  const max = Math.max(1, ...Object.values(buckets))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:12,fontWeight:600,color:'#444'}}>Archive timeline</div>
      <div style={{display:'flex',gap:8,alignItems:'end',height:56}}>
        {years.length === 0 && <div style={{fontSize:12,color:'#888'}}>No archive data yet.</div>}
        {years.map(y=>{
          const h = Math.round((buckets[y] / max) * 48)
          return (
            <div key={y} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div style={{width:18,height:h,background:'#ffd700',borderRadius:3}} />
              <div style={{fontSize:10,marginTop:4,color:'#666'}}>{y}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
