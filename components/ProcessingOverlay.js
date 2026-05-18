import { useEffect, useState } from 'react'

export default function ProcessingOverlay({ steps = [], active = false }){
  const [idx, setIdx] = useState(0)

  useEffect(()=>{
    if(!active) return
    setIdx(0)
  },[active])

  useEffect(()=>{
    if(!active) return
    const t = setInterval(()=>{
      setIdx((i)=> Math.min(i+1, steps.length-1))
    }, 800)
    return ()=>clearInterval(t)
  },[active, steps.length])

  if(!active) return null

  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-title">Building semantic environment…</div>
        <div className="processing-step">{steps[idx] || ''}</div>
        <div className="processing-meta">{idx+1}/{steps.length}</div>
      </div>
    </div>
  )
}
