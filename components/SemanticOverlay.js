import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function SemanticOverlay({ links = [], transform = {x:0,y:0,k:1}, onTransform }){
  const ref = useRef(null)
  const rafRef = useRef(null)

  useEffect(()=>{
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const g = svg.append('g').attr('class','overlay-links')

    function draw(){
      g.selectAll('*').remove()
      for(const l of links){
        try{
          const aEl = document.querySelector(`[data-node-id="${l.source}"]`)
          const bEl = document.querySelector(`[data-node-id="${l.target}"]`)
          if(!aEl || !bEl) continue
          const aRect = aEl.getBoundingClientRect()
          const bRect = bEl.getBoundingClientRect()
          const x1 = aRect.left + aRect.width/2 + window.scrollX
          const y1 = aRect.top + aRect.height/2 + window.scrollY
          const x2 = bRect.left + bRect.width/2 + window.scrollX
          const y2 = bRect.top + bRect.height/2 + window.scrollY

          const path = d3.path()
          const midx = (x1 + x2)/2
          const midy = (y1 + y2)/2
          const dx = x2 - x1
          const dy = y2 - y1
          const cx = x1 + dx*0.5
          const cy = y1 + dy*0.5 - Math.min(120, Math.hypot(dx,dy)/4)
          path.moveTo(x1,y1)
          path.quadraticCurveTo(cx,cy,x2,y2)

          g.append('path')
            .attr('d', path.toString())
            .attr('fill','none')
            .attr('stroke', l.weight ? '#ffd700' : '#eee')
            .attr('stroke-opacity', l.weight ? Math.min(0.9, l.weight+0.2) : 0.4)
            .attr('stroke-width', l.weight ? (1 + (l.weight-0.12)*6) : 1)
            .attr('data-link', `${l.source}__${l.target}`)
            .style('pointer-events','stroke')
            .on('mouseenter', ()=>{
              // highlight connected nodes
              try{ document.querySelectorAll('[data-node-id]').forEach(el=>el.style.opacity = '0.18') }catch(e){}
              try{ aEl.style.opacity = '1'; bEl.style.opacity='1'; aEl.style.boxShadow='0 4px 18px rgba(0,0,0,0.12)'; bEl.style.boxShadow='0 4px 18px rgba(0,0,0,0.12)'; }catch(e){}
            })
            .on('mouseleave', ()=>{
              try{ document.querySelectorAll('[data-node-id]').forEach(el=>el.style.opacity = '1') }catch(e){}
              try{ aEl.style.boxShadow='none'; bEl.style.boxShadow='none'; }catch(e){}
            })
            .attr('stroke-dasharray', function(){ const l = this.getTotalLength(); return l; })
            .attr('stroke-dashoffset', function(){ return this.getTotalLength(); })
            .transition().duration(900).attr('stroke-dashoffset',0)
        }catch(e){/* ignore */}
      }
    }

    function tick(){ draw(); rafRef.current = requestAnimationFrame(tick) }
    tick()

    // update on resize/scroll
    function onChange(){ draw() }
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange)

    return ()=>{
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange)
      if(rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  },[links, transform])

  // basic pan/zoom handlers (emit transform changes)
  useEffect(()=>{
    const el = ref.current
    if(!el) return
    let dragging = false, sx=0, sy=0
    function onPointerDown(e){ dragging = true; sx = e.clientX; sy = e.clientY; el.setPointerCapture && el.setPointerCapture(e.pointerId) }
    function onPointerUp(e){ dragging = false; el.releasePointerCapture && el.releasePointerCapture(e.pointerId) }
    function onPointerMove(e){ if(!dragging) return; const dx = e.clientX - sx; const dy = e.clientY - sy; sx = e.clientX; sy = e.clientY; onTransform && onTransform((t)=>({ x: t.x + dx, y: t.y + dy, k: t.k })) }
    function onWheel(e){ e.preventDefault(); const delta = -e.deltaY*0.001; onTransform && onTransform((t)=>{ const k = Math.max(0.4, Math.min(2.0, t.k*(1+delta))); return { x: t.x, y: t.y, k } }) }
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    el.addEventListener('wheel', onWheel, { passive:false })

    return ()=>{
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('wheel', onWheel)
    }
  },[onTransform])

  return (
    <svg ref={ref} className="semantic-overlay" style={{ position:'fixed', inset:0, pointerEvents:'auto', zIndex:1200 }} />
  )
}
