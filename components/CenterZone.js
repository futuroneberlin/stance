import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import ArchiveView from './ArchiveView'

export default function CenterZone({ entries, links = [], categories = [], nodes: persistedNodes = [] }){
  const ref = useRef(null)

  const categoryTags = useMemo(() => (Array.isArray(categories) ? categories : []).slice(0, 12), [categories])

  useEffect(()=>{
    if(!entries || !ref.current) return
    const cleanEntries = (entries || []).filter((e) => e && e.id && e.text)
    const graphNodes = cleanEntries.map(e=>({ id:e.id, text:e.text, category:e.category || [], source: e.source }))
    if(!graphNodes.length){
      d3.select(ref.current).selectAll('*').remove()
      return
    }
    const categoryLinks = []
    for(let i=0;i<graphNodes.length;i++){
      for(let j=i+1;j<graphNodes.length;j++){
        const a = cleanEntries[i]
        const b = cleanEntries[j]
        const sharedCat = a.category && b.category && a.category.filter(x=>b.category.includes(x))
        if(sharedCat && sharedCat.length) categoryLinks.push({ source:a.id, target:b.id })
      }
    }

    const width = 500, height = 600
    d3.select(ref.current).selectAll('*').remove()
    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${width} ${height}`)

    // decide which nodes to render: prefer persistedNodes if available
    const nodeData = Array.isArray(persistedNodes) && persistedNodes.length ? persistedNodes : graphNodes

    // normalize and merge external prop links with category links, dedupe and filter
    const propLinks = Array.isArray(links) ? links : []
    const normalizeLink = (l) => {
      if(!l) return null
      const s = l.source && typeof l.source === 'object' ? (l.source.id || l.source) : l.source
      const t = l.target && typeof l.target === 'object' ? (l.target.id || l.target) : l.target
      if(!s || !t) return null
      return { source: String(s), target: String(t), weight: l.weight }
    }

    const normalizedPropLinks = propLinks.map(normalizeLink).filter(Boolean)

    // start from categoryLinks but normalize to strings
    const normalizedCategoryLinks = categoryLinks.map(l=>({ source: String(l.source), target: String(l.target) }))

    const mergedRaw = [...normalizedCategoryLinks]
    for(const pl of normalizedPropLinks){
      const dup = mergedRaw.find(l=> (l.source===pl.source && l.target===pl.target) || (l.source===pl.target && l.target===pl.source))
      if(!dup) mergedRaw.push(pl)
    }

    // create a set of valid node ids from nodeData
    const validNodeIds = new Set((nodeData||[]).map(n => String(n.id)))

    // filter merged links to only those where both endpoints exist in nodeData
    const mergedLinks = mergedRaw.filter(l => validNodeIds.has(String(l.source)) && validNodeIds.has(String(l.target)))

    const sim = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink(mergedLinks).id(d=>d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width/2, height/2))

    const link = svg.append('g').selectAll('line').data(mergedLinks).enter().append('line')
      .attr('stroke','#cfcfcf').attr('stroke-opacity',0.6).attr('stroke-width',d=> d.weight ? (1 + (d.weight-0.12)*6) : 1.2)
      .attr('stroke-dasharray', d=> d.weight ? '0' : '4 6')
      .style('transition','stroke-width 0.25s, stroke-opacity 0.25s')

    const node = svg.append('g').selectAll('g.node').data(nodeData).enter().append('g').attr('class','node').attr('data-node-id', d=>d.id)
    node.append('circle')
      .attr('r',8)
      .attr('fill',(d)=> d.source ? '#e8e8e8' : '#ffd700')
      .attr('stroke','#ddd')
      .attr('stroke-width',1)
      .style('cursor','pointer')
      .on('mouseenter', function(event,d){
        d3.select(this).transition().attr('r',12).attr('stroke-width',2)
        // highlight connected links
        link.filter(l=>l.source.id===d.id||l.target.id===d.id).transition().attr('stroke','#ffd700').attr('stroke-opacity',1).attr('stroke-width',2.2)
      })
      .on('mouseleave', function(event,d){
        d3.select(this).transition().attr('r',8).attr('stroke-width',1)
        link.filter(l=>l.source.id===d.id||l.target.id===d.id).transition().attr('stroke','#cfcfcf').attr('stroke-opacity',0.6).attr('stroke-width',1.2)
      })
    node.append('title').text(d=>d.text)

    // animate link drawing
    link.attr('stroke-dashoffset', 1000).transition().duration(900).attr('stroke-dashoffset',0)

    sim.on('tick', ()=>{
      link.attr('x1',d=> (d.source && d.source.x != null) ? d.source.x : 0)
          .attr('y1',d=> (d.source && d.source.y != null) ? d.source.y : 0)
          .attr('x2',d=> (d.target && d.target.x != null) ? d.target.x : 0)
          .attr('y2',d=> (d.target && d.target.y != null) ? d.target.y : 0)
      node.attr('transform', d=>`translate(${d.x},${d.y})`)
    })

    return ()=> sim.stop()
  },[entries, links])

  return (
    <div className="zone-content">
      <div className="zone-label">CENTER</div>
      <p className="zone-intro">Overlaps, tensions and hybrid meanings in a shared relational core.</p>
      {categoryTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 10px' }}>
          {categoryTags.map((category) => (
            <span key={category.category_key} style={{ fontSize: 11, padding: '4px 8px', background: '#fff', border: '1px solid #eee' }}>
              {category.label} · {category.usage_count}
            </span>
          ))}
        </div>
      )}
      {Array.isArray(persistedNodes) && persistedNodes.length > 0 && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Persisted nodes: {persistedNodes.length}</div>
      )}
      <svg ref={ref} style={{width:'100%',height:'auto',aspectRatio:'1',marginTop:12,minHeight:360,border:'1px solid #e8e8e8'}} />
      <div style={{marginTop:10}}>
        <ArchiveView entries={entries} />
      </div>
    </div>
  )
}
