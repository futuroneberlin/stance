import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function Visualization({ entries }){
  const ref = useRef(null)

  useEffect(()=>{
    if(!entries || !ref.current) return
    const nodes = entries.map(e=>({ id:e.id, text:e.text, category:e.category }))
    const links = []
    // simple link: if two entries share a category or relation word
    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const a = entries[i]
        const b = entries[j]
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

    const link = svg.append('g').selectAll('line').data(links).enter().append('line').attr('stroke','#bbb')
    const node = svg.append('g').selectAll('circle').data(nodes).enter().append('g')
    node.append('circle').attr('r',10).attr('fill','#111')
    node.append('title').text(d=>d.text)
    node.append('text').text(d=>d.text.slice(0,40)).attr('x',14).attr('y',4).style('font-size','12px')

    sim.on('tick', ()=>{
      link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y)
      node.attr('transform', d=>`translate(${d.x},${d.y})`)
    })

    return ()=> sim.stop()
  },[entries])

  return (
    <div className="card">
      <strong>Netzwerk-Visualisierung</strong>
      <svg ref={ref} style={{width:'100%',height:400}} />
    </div>
  )
}
