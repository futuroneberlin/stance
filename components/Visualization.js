import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function Visualization({ entries }){
  const ref = useRef(null)

  useEffect(()=>{
    if(!entries || !ref.current) return
    const cleanEntries = (entries || []).filter((e) => e && e.id && e.text)
    const nodes = cleanEntries.map(e=>({ id:e.id, text:e.text, category:e.category || [] }))
    if(!nodes.length){
      d3.select(ref.current).selectAll('*').remove()
      return
    }
    const links = []
    // Link nodes that share at least one category.
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = cleanEntries[i]
        const b = cleanEntries[j]
        const sharedCat = a.category && b.category && a.category.filter(x=>b.category.includes(x))
        if(sharedCat && sharedCat.length) links.push({ source:a.id, target:b.id })
      }
    }

    const width = 900, height = 400
    d3.select(ref.current).selectAll('*').remove()
    const svg = d3.select(ref.current).attr('viewBox', `0 0 ${width} ${height}`)

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d=>d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width/2, height/2))

    const link = svg.append('g').selectAll('line').data(links).enter().append('line').attr('stroke','#222').attr('stroke-opacity',0.35)
    const node = svg.append('g').selectAll('circle').data(nodes).enter().append('g')
    node.append('circle').attr('r',9).attr('fill',(d)=>{
      if((d.category || []).includes('intrinsic')) return '#0047ff'
      if((d.category || []).includes('extrinsic')) return '#e10600'
      return '#ffd400'
    })
    node.append('title').text(d=>d.text)
    node.append('text').text(d=>d.text.slice(0,44)).attr('x',14).attr('y',4).style('font-size','11px').style('font-family','Space Grotesk, Arial').style('fill','#111')

    sim.on('tick', ()=>{
      link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y)
      node.attr('transform', d=>`translate(${d.x},${d.y})`)
    })

    return ()=> sim.stop()
  },[entries])

  return (
    <div className="card">
      <strong>Network Diagram</strong>
      <svg ref={ref} style={{width:'100%',height:400}} />
    </div>
  )
}
