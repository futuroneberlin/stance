import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'

function getCategoryMotionProfile(categories = []){
  const values = (Array.isArray(categories) ? categories : []).map((category) => String(category?.label || category?.category_key || '').toLowerCase())
  const has = (needle) => values.some((value) => value.includes(needle))
  return {
    material: has('mater') ? 1 : 0,
    system: has('system') ? 1 : 0,
    social: has('sozial') || has('social') ? 1 : 0,
    introspective: has('intros') ? 1 : 0
  }
}

function buildNoiseTexture(THREE){
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if(!context) return null
  const image = context.createImageData(canvas.width, canvas.height)
  for(let index = 0; index < image.data.length; index += 4){
    const value = 124 + Math.floor((Math.random() - 0.5) * 42)
    image.data[index] = value
    image.data[index + 1] = value
    image.data[index + 2] = value
    image.data[index + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

export default function CenterZone({ entries, links = [], categories = [], nodes: persistedNodes = [], latestEntry = null }){
  const ref = useRef(null)
  const threeRef = useRef(null)

  const categoryTags = useMemo(() => (Array.isArray(categories) ? categories : []).slice(0, 12), [categories])

  const semanticModel = useMemo(() => {
    const cleanEntries = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.id && entry.text)
    const cleanCategories = (Array.isArray(categories) ? categories : []).filter((category) => category && category.category_key)
    const cleanPersistedNodes = (Array.isArray(persistedNodes) ? persistedNodes : []).filter((node) => node && (node.id || node.node_id))

    const entryNodes = cleanEntries.map((entry) => ({
      id: String(entry.id),
      text: entry.text,
      kind: entry.is_seed ? 'seed_entry' : 'visitor_entry',
      source: entry.source || (entry.is_seed ? 'seed' : 'user'),
      category: Array.isArray(entry.category) ? entry.category : [],
      is_seed: Boolean(entry.is_seed),
      is_visible: entry.is_visible !== false,
      entry
    }))

    const categoryNodes = cleanCategories.map((category) => ({
      id: `cat:${category.category_key}`,
      text: category.label || category.category_key,
      kind: 'category',
      source: 'category',
      category: [category.category_key],
      usage_count: Number(category.usage_count || 0),
      entry: null
    }))

    const nodeMap = new Map()
    for(const node of [...cleanPersistedNodes, ...entryNodes, ...categoryNodes]){
      const id = String(node.id || node.node_id)
      if(!id || nodeMap.has(id)) continue
      nodeMap.set(id, {
        id,
        text: node.text || node.label || id,
        kind: node.kind || node.node_type || 'entry',
        source: node.source || node.metadata?.source || 'user',
        category: Array.isArray(node.category) ? node.category : [],
        is_seed: Boolean(node.is_seed),
        is_visible: node.is_visible !== false,
        usage_count: Number(node.usage_count || 0),
        entry: node.entry || null
      })
    }

    const nodesList = Array.from(nodeMap.values())

    const linkMap = new Map()
    const addLink = (source, target, weight = 1, relationType = 'semantic') => {
      const s = String(source || '')
      const t = String(target || '')
      if(!s || !t || s === t) return
      const key = [s, t].sort().join('|')
      if(linkMap.has(key)) return
      linkMap.set(key, { source: s, target: t, weight: Number(weight || 0), relationType })
    }

    for(const entry of cleanEntries){
      const entryId = String(entry.id)
      for(const category of Array.isArray(entry.category) ? entry.category : []){
        addLink(entryId, `cat:${category}`, 0.85, 'classified_as')
      }
      for(const relation of Array.isArray(entry.relations) ? entry.relations : []){
        const token = String(relation || '').trim().toLowerCase()
        if(token) addLink(entryId, `term:${token}`, 0.65, 'mentions')
      }
    }

    const externalLinks = Array.isArray(links) ? links : []
    for(const rawLink of externalLinks){
      const source = rawLink && typeof rawLink.source === 'object' ? rawLink.source?.id : rawLink?.source
      const target = rawLink && typeof rawLink.target === 'object' ? rawLink.target?.id : rawLink?.target
      if(!source || !target) continue
      const sourceId = String(source)
      const targetId = String(target)
      if(!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue
      addLink(sourceId, targetId, rawLink.weight, rawLink.relationType || rawLink.relation_type || 'semantic')
    }

    // Add cluster anchors so categories appear as visible hubs even without many edges.
    for(const categoryNode of categoryNodes){
      addLink(categoryNode.id, categoryNode.id, 0, 'cluster_anchor')
    }

    const linkList = Array.from(linkMap.values()).filter((link) => {
      return nodeMap.has(String(link.source)) && nodeMap.has(String(link.target))
    })

    const clusterMap = new Map()
    for(const node of nodesList){
      const clusterKey = node.kind === 'category'
        ? node.id
        : (Array.isArray(node.category) && node.category.length ? `cat:${node.category[0]}` : 'uncategorized')
      if(!clusterMap.has(clusterKey)) clusterMap.set(clusterKey, [])
      clusterMap.get(clusterKey).push(node)
    }

    return {
      nodes: nodesList,
      links: linkList,
      clusters: Array.from(clusterMap.entries()).map(([key, clusterNodes]) => ({
        key,
        nodes: clusterNodes
      }))
    }
  }, [entries, categories, links, persistedNodes])

  const motionProfile = useMemo(() => getCategoryMotionProfile(categories), [categories])

  useEffect(()=>{
    if(!ref.current) return

    const { nodes, links: semanticLinks } = semanticModel
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const width = 560
    const height = 640
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    if(!nodes.length){
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .style('font-size', '14px')
        .text('No semantic data yet.')
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', '#888')
        .style('font-size', '12px')
        .text('Seed entries, visitor contributions, and categories appear here after data is available.')
      return
    }

    const clusterColor = d3.scaleOrdinal([
      '#ff7a18',
      '#8e8a84',
      '#b9b4ad',
      '#60656b',
      '#d6d1ca',
      '#2a2a2a'
    ])
    const clusterByNodeId = new Map()
    semanticModel.clusters.forEach((cluster, index) => {
      cluster.nodes.forEach((node) => clusterByNodeId.set(node.id, { key: cluster.key, index }))
    })

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const filteredLinks = semanticLinks.filter((link) => {
      const source = String(link.source)
      const target = String(link.target)
      return source !== target && nodeById.has(source) && nodeById.has(target)
    })

    const clusterCenters = new Map()
    semanticModel.clusters.forEach((cluster, index) => {
      const angle = (index / Math.max(1, semanticModel.clusters.length)) * Math.PI * 2
      clusterCenters.set(cluster.key, {
        x: width / 2 + Math.cos(angle) * 140,
        y: height / 2 + Math.sin(angle) * 120
      })
    })

    const simNodes = nodes.map((node) => ({
      ...node,
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0
    }))

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(filteredLinks).id((d) => d.id).distance((d) => d.relationType === 'classified_as' ? 42 : 72).strength(0.8))
      .force('charge', d3.forceManyBody().strength((d) => d.kind === 'category' ? -220 : -120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d) => d.kind === 'category' ? 26 : 18).iterations(2))
      .force('x', d3.forceX((d) => {
        const cluster = clusterByNodeId.get(d.id)
        return clusterCenters.get(cluster?.key)?.x || width / 2
      }).strength(0.12))
      .force('y', d3.forceY((d) => {
        const cluster = clusterByNodeId.get(d.id)
        return clusterCenters.get(cluster?.key)?.y || height / 2
      }).strength(0.12))

    const clusterLayer = svg.append('g').attr('opacity', 0.22)
    semanticModel.clusters.forEach((cluster, index) => {
      const [x, y] = [clusterCenters.get(cluster.key)?.x || width / 2, clusterCenters.get(cluster.key)?.y || height / 2]
      const points = cluster.nodes.map((node) => {
        const jitter = node.kind === 'category' ? 26 : 18
        return [x + (Math.random() - 0.5) * jitter, y + (Math.random() - 0.5) * jitter]
      })
      if(points.length < 3) return
      const hull = d3.polygonHull(points)
      if(!hull) return
      clusterLayer.append('path')
        .attr('d', `M${hull.map((point) => point.join(',')).join('L')}Z`)
        .attr('fill', clusterColor(index))
        .attr('stroke', clusterColor(index))
        .attr('stroke-width', 1)
        .attr('filter', 'blur(6px)')
    })

    const linkLayer = svg.append('g')
    const link = linkLayer.selectAll('line').data(filteredLinks).enter().append('line')
      .attr('stroke', (d) => d.relationType === 'classified_as' ? '#ff7a18' : '#8f8b86')
      .attr('stroke-opacity', (d) => d.relationType === 'semantic_similarity' ? 0.55 : 0.75)
      .attr('stroke-width', (d) => d.relationType === 'semantic_similarity' ? Math.max(1, Math.min(3, 1 + d.weight * 2)) : 1.1)
      .attr('stroke-dasharray', (d) => d.relationType === 'semantic_similarity' ? '0' : '4 5')

    const nodeLayer = svg.append('g')
    const node = nodeLayer.selectAll('g.node').data(simNodes).enter().append('g')
      .attr('class', 'node')
      .attr('data-node-id', (d) => d.id)

    node.append('circle')
      .attr('r', (d) => d.kind === 'category' ? 14 : (d.is_seed ? 11 : 9))
      .attr('fill', (d) => {
        if(d.kind === 'category') return '#1b1b1b'
        if(d.is_seed) return '#ff7a18'
        return '#dedbd6'
      })
      .attr('stroke', (d) => d.kind === 'category' ? '#f5f1ec' : '#b8b2ab')
      .attr('stroke-width', (d) => d.kind === 'category' ? 1.4 : 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d){
        d3.select(this).transition().duration(120).attr('r', (d.kind === 'category' ? 18 : (d.is_seed ? 13 : 11)))
        link
          .attr('stroke-opacity', (linkDatum) => {
            const source = typeof linkDatum.source === 'object' ? linkDatum.source.id : linkDatum.source
            const target = typeof linkDatum.target === 'object' ? linkDatum.target.id : linkDatum.target
            return source === d.id || target === d.id ? 1 : 0.12
          })
          .attr('stroke', (linkDatum) => {
            const source = typeof linkDatum.source === 'object' ? linkDatum.source.id : linkDatum.source
            const target = typeof linkDatum.target === 'object' ? linkDatum.target.id : linkDatum.target
            return source === d.id || target === d.id ? '#ff7a18' : '#8f8b86'
          })
      })
      .on('mouseleave', function(){
        d3.select(this).transition().duration(120).attr('r', (d) => d.kind === 'category' ? 14 : (d.is_seed ? 11 : 9))
        link
          .attr('stroke-opacity', (d) => d.relationType === 'semantic_similarity' ? 0.55 : 0.75)
          .attr('stroke', (d) => d.relationType === 'classified_as' ? '#ff7a18' : '#8f8b86')
      })

    node.append('title').text((d) => {
      const prefix = d.kind === 'category' ? 'Category' : (d.is_seed ? 'Seed entry' : 'Visitor entry')
      return `${prefix}: ${d.text}`
    })

    node.append('text')
      .text((d) => {
        const max = d.kind === 'category' ? 18 : 22
        return String(d.text || '').slice(0, max)
      })
      .attr('x', 16)
      .attr('y', 4)
      .style('font-size', '11px')
      .style('fill', '#1a1a1a')
      .style('pointer-events', 'none')

    const clusterLegend = svg.append('g').attr('transform', 'translate(14, 18)')
    clusterLegend.append('text')
      .text('Semantic clusters')
      .attr('fill', '#666')
      .style('font-size', '12px')
      .style('font-weight', 600)

    const legendItems = clusterLegend.selectAll('g.legend-item').data(semanticModel.clusters.slice(0, 5)).enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (_, index) => `translate(0, ${18 + index * 18})`)

    legendItems.append('circle')
      .attr('r', 5)
      .attr('fill', (_, index) => clusterColor(index))

    legendItems.append('text')
      .attr('x', 10)
      .attr('y', 4)
      .style('font-size', '11px')
      .style('fill', '#444')
      .text((cluster) => cluster.key.replace(/^cat:/, ''))

    sim.on('tick', ()=>{
      link
        .attr('x1', (d) => (d.source && d.source.x != null) ? d.source.x : 0)
        .attr('y1', (d) => (d.source && d.source.y != null) ? d.source.y : 0)
        .attr('x2', (d) => (d.target && d.target.x != null) ? d.target.x : 0)
        .attr('y2', (d) => (d.target && d.target.y != null) ? d.target.y : 0)
      node.attr('transform', (d) => `translate(${Number.isFinite(d.x) ? d.x : width / 2},${Number.isFinite(d.y) ? d.y : height / 2})`)
    })

    return ()=> sim.stop()
  },[semanticModel])

  /* WebGL nucleus: three.js scene with PBR-like material and parallax */
  useEffect(()=>{
    let mounted = true
    let renderer, scene, camera, frameId
    let roomGroup, nucleusGroup, floorMat, wallMat, ceilingMat, slabMat, glowMat
    let handleMove = null
    let handleDevice = null
    let onResize = null

    // Skip if user prefers reduced motion
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if(!threeRef.current || prefersReduced) return

    let THREE
    import('three').then((t)=>{
      if(!mounted) return
      THREE = t
      const container = threeRef.current
      const width = container.clientWidth || 800
      const height = container.clientHeight || 600

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height)
      renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputEncoding
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      scene.fog = new THREE.Fog(0x06070a, 34, 145)

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
      camera.position.set(0, 4, 54)
      camera.lookAt(0, 2, 0)

      const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x050608, 0.44)
      scene.add(hemi)
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
      keyLight.position.set(-12, 18, 18)
      keyLight.castShadow = true
      keyLight.shadow.mapSize.set(1024, 1024)
      scene.add(keyLight)

      const orangeLight = new THREE.PointLight(0xff7a18, 1.35, 120, 2)
      orangeLight.position.set(0, -6, 14)
      scene.add(orangeLight)

      const cyanLight = new THREE.PointLight(0x3dbbff, 1.7, 160, 2)
      cyanLight.position.set(20, 2, 8)
      scene.add(cyanLight)

      const rimLight = new THREE.DirectionalLight(0x7aa4ff, 0.4)
      rimLight.position.set(18, 8, -10)
      scene.add(rimLight)

      const loader = new THREE.TextureLoader()
      const baseTex = loader.load('/images/concrete.jpg', ()=> renderer && renderer.render(scene, camera))
      baseTex.wrapS = baseTex.wrapT = THREE.RepeatWrapping
      baseTex.repeat.set(2.25, 2.25)
      baseTex.colorSpace = THREE.SRGBColorSpace || baseTex.encoding

      const noiseTex = buildNoiseTexture(THREE)
      if(noiseTex) noiseTex.needsUpdate = true

      const concreteMaterial = new THREE.MeshStandardMaterial({
        map: baseTex,
        roughness: 0.98,
        metalness: 0.02,
        color: 0xc7c4be,
        bumpMap: noiseTex || null,
        bumpScale: 0.35,
        emissive: 0x000000,
        emissiveIntensity: 0,
        envMapIntensity: 0.15,
        toneMapped: true
      })

      const darkMaterial = new THREE.MeshStandardMaterial({
        color: 0x111316,
        roughness: 0.88,
        metalness: 0.12,
        map: baseTex,
        bumpMap: noiseTex || null,
        bumpScale: 0.12,
        envMapIntensity: 0.08,
        toneMapped: true
      })

      const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x090909,
        emissive: 0x3dbbff,
        emissiveIntensity: 1.4,
        roughness: 0.22,
        metalness: 0.88,
        toneMapped: false
      })

      roomGroup = new THREE.Group()
      scene.add(roomGroup)

      const floor = new THREE.Mesh(new THREE.BoxGeometry(120, 2.2, 120), concreteMaterial)
      floor.position.set(0, -14, 0)
      floor.receiveShadow = true
      roomGroup.add(floor)

      const ceiling = new THREE.Mesh(new THREE.BoxGeometry(120, 2.2, 120), darkMaterial)
      ceiling.position.set(0, 24, -10)
      ceiling.receiveShadow = true
      roomGroup.add(ceiling)

      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 50, 120), concreteMaterial)
      leftWall.position.set(-22, 4, 0)
      leftWall.rotation.z = 0.012
      roomGroup.add(leftWall)

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 50, 120), darkMaterial)
      rightWall.position.set(22, 4, -4)
      rightWall.rotation.z = -0.014
      roomGroup.add(rightWall)

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(120, 50, 2.2), darkMaterial)
      backWall.position.set(0, 3, -42)
      roomGroup.add(backWall)

      const slabMaterial = new THREE.MeshStandardMaterial({
        color: 0x1b1c1f,
        roughness: 0.82,
        metalness: 0.18,
        map: baseTex,
        bumpMap: noiseTex || null,
        bumpScale: 0.18,
        emissive: 0x000000,
        envMapIntensity: 0.24,
        toneMapped: true
      })

      const slabPositions = [
        [-14, -3, -8, 0.26],
        [12, 2, -18, -0.18],
        [-8, 8, -30, 0.12],
        [15, -1, -36, -0.08]
      ]
      slabPositions.forEach(([x, y, z, rot]) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 6), slabMaterial)
        slab.position.set(x, y, z)
        slab.rotation.y = rot
        slab.castShadow = true
        slab.receiveShadow = true
        roomGroup.add(slab)
      })

      const edgeStripGeometry = new THREE.BoxGeometry(0.45, 0.45, 28)
      const leftEdge = new THREE.Mesh(edgeStripGeometry, glowMaterial)
      leftEdge.position.set(-18, -9.5, -6)
      roomGroup.add(leftEdge)

      const rightEdge = new THREE.Mesh(edgeStripGeometry, glowMaterial.clone())
      rightEdge.material = glowMaterial.clone()
      rightEdge.material.color = new THREE.Color(0x090909)
      rightEdge.material.emissive = new THREE.Color(0xff7a18)
      rightEdge.material.emissiveIntensity = 1.1
      rightEdge.position.set(18, -9.5, -6)
      roomGroup.add(rightEdge)

      const ceilingStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 34), glowMaterial.clone())
      ceilingStrip.material = glowMaterial.clone()
      ceilingStrip.material.emissive = new THREE.Color(0x3dbbff)
      ceilingStrip.material.emissiveIntensity = 1.5
      ceilingStrip.position.set(0, 20.5, -16)
      roomGroup.add(ceilingStrip)

      nucleusGroup = new THREE.Group()
      roomGroup.add(nucleusGroup)

      const nucleusCore = new THREE.Mesh(
        new THREE.BoxGeometry(16, 12, 12),
        concreteMaterial.clone()
      )
      nucleusCore.material.color = new THREE.Color(0xbab4aa)
      nucleusCore.material.roughness = 0.94
      nucleusCore.material.bumpScale = 0.28
      nucleusCore.position.set(0, -1, 0)
      nucleusCore.castShadow = true
      nucleusCore.receiveShadow = true
      nucleusGroup.add(nucleusCore)

      const nucleusCap = new THREE.Mesh(
        new THREE.BoxGeometry(18, 2, 14),
        darkMaterial.clone()
      )
      nucleusCap.position.set(0, 7.8, 0)
      nucleusCap.castShadow = true
      nucleusGroup.add(nucleusCap)

      const orangeRail = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.6, 0.6),
        glowMaterial.clone()
      )
      orangeRail.material.emissive = new THREE.Color(0xff7a18)
      orangeRail.material.emissiveIntensity = 1.7
      orangeRail.position.set(0, -7.8, 6.4)
      nucleusGroup.add(orangeRail)

      const blueRail = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.6, 0.6),
        glowMaterial.clone()
      )
      blueRail.material.emissive = new THREE.Color(0x3dbbff)
      blueRail.material.emissiveIntensity = 1.75
      blueRail.position.set(0, -7.8, -6.4)
      nucleusGroup.add(blueRail)

      const centralVoid = new THREE.Mesh(
        new THREE.BoxGeometry(7.4, 8, 7.4),
        darkMaterial.clone()
      )
      centralVoid.position.set(0, -1, 0)
      nucleusGroup.add(centralVoid)

      const motionBoost = 1 + motionProfile.system * 0.35 + motionProfile.social * 0.12
      const weightBoost = 1 + motionProfile.material * 0.42
      const stabilityBoost = 1 + motionProfile.introspective * 0.24

      const onResize = ()=>{
        const w = container.clientWidth || 800
        const h = container.clientHeight || 600
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }

      let targetX = 0
      let targetY = 0
      let currentX = 0
      let currentY = 0

      // declare handlers so we can remove them cleanly
      handleMove = (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1
        const y = -(e.clientY / window.innerHeight) * 2 + 1
        targetX = x * 0.16 * motionBoost
        targetY = y * 0.14 * stabilityBoost
      }

      handleDevice = (ev) => {
        const gamma = ev.gamma || 0
        const beta = ev.beta || 0
        targetX = THREE.MathUtils.clamp(gamma / 45, -1, 1) * 0.12 * motionBoost
        targetY = THREE.MathUtils.clamp(beta / 45, -1, 1) * 0.12 * stabilityBoost
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('deviceorientation', handleDevice)
      window.addEventListener('resize', onResize)

      const tick = ()=>{
        currentX += (targetX - currentX) * 0.08
        currentY += (targetY - currentY) * 0.08

        if(roomGroup){
          roomGroup.rotation.y += 0.0008 + currentX * 0.01
          roomGroup.rotation.x = THREE.MathUtils.clamp(currentY * 0.03, -0.08, 0.08)
        }

        if(nucleusGroup){
          nucleusGroup.rotation.y += 0.0016 + currentX * 0.014
          nucleusGroup.position.y = Math.sin(Date.now() * 0.0014) * 0.25
        }

        if(camera){
          camera.position.x += (currentX * 4.2 - camera.position.x) * 0.02
          camera.position.y += ((4 + currentY * 2.5) - camera.position.y) * 0.02
          camera.lookAt(0, 2, -8)
        }

        if(keyLight) keyLight.position.x = -12 + currentX * 8
        if(orangeLight) orangeLight.position.z = 14 + currentY * 4
        if(cyanLight) cyanLight.position.y = 2 + currentY * 3

        renderer.render(scene, camera)
        frameId = requestAnimationFrame(tick)
      }
      tick()
    }).catch(()=>{})

    return ()=>{
      mounted = false
      if(frameId) cancelAnimationFrame(frameId)
      try{ window.removeEventListener('mousemove', handleMove) }catch(e){}
      try{ window.removeEventListener('deviceorientation', handleDevice) }catch(e){}
      try{ window.removeEventListener('resize', onResize) }catch(e){}
      if(renderer && renderer.domElement && threeRef.current) threeRef.current.removeChild(renderer.domElement)
      // dispose three resources if possible
      try{
        roomGroup?.traverse((object) => {
          if(object.geometry) object.geometry.dispose()
          if(object.material){
            if(Array.isArray(object.material)){
              object.material.forEach((material) => material?.dispose?.())
            }else{
              object.material.dispose()
            }
          }
        })
        if(renderer) renderer.dispose()
      }catch(e){}
    }
  }, [latestEntry, motionProfile])

    const hasAnyData = semanticModel.nodes.length > 0
  const visibleSeeds = semanticModel.nodes.filter((node) => node.is_seed).length
  const visibleVisitorEntries = semanticModel.nodes.filter((node) => node.kind === 'visitor_entry').length
  const nucleusText = latestEntry?.text || entries?.[0]?.text || 'Art is'

  return (
    <div className="cell-field">
      <div className="cell-field__header">
        <div>
          <div className="cell-field__label">SEMANTIC CELL</div>
          <p className="cell-field__intro">A nucleus-driven field where inputs, categories and relations condense into one living system.</p>
        </div>
        <div className="cell-field__stats">
          <span>Nodes {semanticModel.nodes.length}</span>
          <span>Links {semanticModel.links.length}</span>
          <span>Clusters {semanticModel.clusters.length}</span>
          <span>Seeds {visibleSeeds}</span>
          <span>Visitors {visibleVisitorEntries}</span>
        </div>
      </div>

      {categoryTags.length > 0 && (
        <div className="cell-field__tags">
          {categoryTags.map((category) => (
            <span key={category.category_key} className="cell-field__tag">
              {category.label} · {category.usage_count}
            </span>
          ))}
        </div>
      )}

      <div className="cell-stage">
        <div className="cell-stage__background">
          <div className="cell-stage__halo cell-stage__halo--one" />
          <div className="cell-stage__halo cell-stage__halo--two" />
          <div className="cell-stage__grid" />
        </div>

        <div className="cell-stage__shader">
          <div ref={threeRef} className="cell-network-webgl" />
        </div>

        <div className="cell-stage__network">
          <svg ref={ref} className="cell-network-svg" />
        </div>

        <div className="cell-stage__ui">
          <div className="cell-nucleus">
            <div className="cell-nucleus__kicker">ART IS</div>
            <div className="cell-nucleus__title">Art is</div>
            <div className="cell-nucleus__sub">{nucleusText}</div>
          </div>
        </div>
      </div>

      {!hasAnyData && (
        <div className="cell-empty-state">
          <div className="cell-empty-state__title">No semantic data yet.</div>
          <div className="cell-empty-state__copy">Seed entries, visitor contributions and category links will appear once the cell starts receiving input.</div>
        </div>
      )}
    </div>
  )
}
