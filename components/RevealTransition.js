import { useEffect } from 'react'

export default function RevealTransition({ entries = [], onComplete }){
  useEffect(()=>{
    const t = setTimeout(()=>{
      onComplete && onComplete()
    }, 1400)
    return ()=>clearTimeout(t)
  },[onComplete])

  // Simple visual: overlay with cinematic fade + SVG animated lines
  return (
    <div className="reveal-overlay" aria-hidden>
      <div className="reveal-center">
        <h2 className="reveal-title">ART AS STANCE</h2>
        <p className="reveal-sub">Opening the semantic observatory</p>
      </div>

      <svg className="reveal-svg" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor="#ffd700" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path className="reveal-line left-to-center" d="M100 150 C350 80 450 80 600 150" stroke="url(#g1)" strokeWidth="3" fill="none" />
        <path className="reveal-line center-to-right" d="M600 150 C750 80 850 80 1100 150" stroke="url(#g1)" strokeWidth="3" fill="none" />
      </svg>
    </div>
  )
}
