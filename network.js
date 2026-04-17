/**
 * network.js — D3 force-graph renderer for FUTUR ONE Living Glossary
 * Called by script.js via window.FuturNetwork.render(svgId, data)
 */
(function () {
  const CATEGORY_COLORS = {
    concept: '#FFD700',
    movement: '#FFFFFF',
    medium: '#a0a0a0',
    theory: '#f4de7f',
    institution: '#f5f5f5',
    person: '#ffe066'
  };

  function render(svgId, data) {
    if (!window.d3) {
      return false;
    }

    const graphEl = document.getElementById(svgId);
    if (!graphEl) {
      return false;
    }

    const width = graphEl.clientWidth || 900;
    const height = 460;
    const definitions = (data.definitions || []).slice(0, 80);
    const definitionIds = new Set(definitions.map(function (d) { return d.id; }));
    const links = (data.connections || [])
      .filter(function (e) { return definitionIds.has(e.source) && definitionIds.has(e.target); })
      .slice(0, 180);

    const svg = d3.select(`#${svgId}`).attr('viewBox', [0, 0, width, height].join(' '));
    svg.selectAll('*').remove();

    const root = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.45, 4])
        .on('zoom', function (event) { root.attr('transform', event.transform); })
    );

    root.append('g')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-opacity', 0.8)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', function (d) { return Math.min(4.5, 0.6 + d.weight * 0.35); });

    root.append('g')
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .selectAll('circle')
      .data(definitions)
      .join('circle')
      .attr('r', function (d) { return Math.max(4, Math.min(14, 4 + Math.log2((d.importance || 1) + 1))); })
      .attr('fill', function (d) { return CATEGORY_COLORS[d.category] || CATEGORY_COLORS.concept; })
      .call(makeDrag())
      .append('title')
      .text(function (d) { return `${d.title}\n${d.definition}`; });

    root.append('g')
      .selectAll('text')
      .data(definitions)
      .join('text')
      .attr('fill', '#FFFFFF')
      .attr('font-size', 10)
      .attr('dx', 8)
      .attr('dy', 3)
      .text(function (d) { return d.title.length > 24 ? `${d.title.slice(0, 24)}\u2026` : d.title; });

    const simulation = d3.forceSimulation(definitions)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(58))
      .force('charge', d3.forceManyBody().strength(-115))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(function (d) {
        return Math.max(8, Math.min(16, 6 + Math.log2((d.importance || 1) + 1)));
      }));

    simulation.on('tick', function () {
      root.selectAll('line')
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

      root.selectAll('circle')
        .attr('cx', function (d) { return d.x; })
        .attr('cy', function (d) { return d.y; });

      root.selectAll('text')
        .attr('x', function (d) { return d.x; })
        .attr('y', function (d) { return d.y; });
    });

    function makeDrag() {
      return d3.drag()
        .on('start', function (event) {
          if (!event.active) { simulation.alphaTarget(0.3).restart(); }
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on('drag', function (event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on('end', function (event) {
          if (!event.active) { simulation.alphaTarget(0); }
          event.subject.fx = null;
          event.subject.fy = null;
        });
    }

    return true;
  }

  window.FuturNetwork = { render };
})();
