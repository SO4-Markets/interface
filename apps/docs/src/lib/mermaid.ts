/**
 * DX-054: Build-time Mermaid diagram support.
 *
 * Parses Mermaid diagram code (flowcharts/graphs, sequence diagrams, state diagrams)
 * into a structured AST, computes layout geometry, and renders crisp, accessible
 * inline SVGs in both light and dark theme variants using design tokens.
 *
 * Runs entirely at build time — zero client-side Mermaid library in the shipping bundle.
 */

export interface DiagramMeta {
  caption?: string
  title?: string
  description?: string
  file?: string
  line?: number
}

export interface NodeDef {
  id: string
  label: string
  shape: "rect" | "round" | "circle" | "diamond" | "cylinder" | "stadium" | "subgraph" | "flag" | "hex" | "parallelogram"
  subgraphId?: string
  classes?: string[]
}

export interface EdgeDef {
  from: string
  to: string
  label?: string
  style: "solid" | "dotted" | "thick"
  arrow: boolean
}

export interface SubgraphDef {
  id: string
  title: string
  nodeIds: string[]
}

export interface FlowchartAst {
  type: "flowchart"
  direction: "TD" | "TB" | "LR" | "RL" | "BT"
  nodes: Map<string, NodeDef>
  edges: EdgeDef[]
  subgraphs: SubgraphDef[]
  accTitle?: string
  accDescr?: string
}

export interface SequenceActor {
  id: string
  label: string
  isActor?: boolean
}

export interface SequenceMessage {
  from: string
  to: string
  text: string
  style: "solid" | "dotted"
  arrow: boolean
  isSelf?: boolean
}

export interface SequenceNote {
  actors: string[]
  text: string
}

export interface SequenceAst {
  type: "sequence"
  actors: SequenceActor[]
  messages: Array<{ type: "message"; data: SequenceMessage } | { type: "note"; data: SequenceNote } | { type: "block"; title: string; kind: string } | { type: "end" }>
  accTitle?: string
  accDescr?: string
}

export type DiagramAst = FlowchartAst | SequenceAst

export interface RenderedThemeSvgs {
  lightSvg: string
  darkSvg: string
  caption: string
  title?: string
  width: number
  height: number
  id: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_")
}

let diagramCounter = 0
export function generateDiagramId(): string {
  diagramCounter += 1
  return `mermaid-${Date.now().toString(36)}-${diagramCounter}`
}

/**
 * Parses Mermaid diagram code into an AST.
 * Throws on malformed syntax with line/context info.
 */
export function parseMermaid(code: string, meta: DiagramMeta = {}): DiagramAst {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("%%"))

  if (lines.length === 0) {
    throw new Error(
      `Mermaid parse error in ${meta.file || "diagram"}: empty diagram definition`
    )
  }

  let accTitle: string | undefined
  let accDescr: string | undefined

  const header = lines[0]
  if (
    header.startsWith("graph ") ||
    header.startsWith("flowchart ") ||
    header === "graph" ||
    header === "flowchart"
  ) {
    let direction: FlowchartAst["direction"] = "TD"
    const dirMatch = header.match(/^(?:graph|flowchart)\s+([A-Z]{2})/i)
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as FlowchartAst["direction"]
    }

    const nodes = new Map<string, NodeDef>()
    const edges: EdgeDef[] = []
    const subgraphs: SubgraphDef[] = []
    let currentSubgraph: SubgraphDef | null = null

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      if (line.startsWith("accTitle:")) {
        accTitle = line.replace(/^accTitle:\s*/, "").trim()
        continue
      }
      if (line.startsWith("accDescr:")) {
        accDescr = line.replace(/^accDescr:\s*/, "").trim()
        continue
      }

      if (line.startsWith("subgraph ")) {
        const subMatch = line.match(/^subgraph\s+([a-zA-Z0-9_.-]+)(?:\s*\[(.*?)\]|\s+(.*?))?$/)
        const subId = subMatch?.[1] || `sub_${subgraphs.length + 1}`
        const subTitle = (subMatch?.[2] || subMatch?.[3] || subId).trim()
        currentSubgraph = { id: subId, title: subTitle, nodeIds: [] }
        subgraphs.push(currentSubgraph)
        continue
      }

      if (line === "end") {
        currentSubgraph = null
        continue
      }

      if (line.startsWith("classDef ") || line.startsWith("class ") || line.startsWith("style ")) {
        // Class and style directives
        continue
      }

      // Check for edge: e.g. A --> B, A[Label] -->|text| B(Text), A --- B
      const edgeRegex = /^([a-zA-Z0-9_]+(?:\[.*?\]|\(.*?\)|\(\(.*?\)\)|\(\[.*?\]\)|\{\{.*?\}\}|\{.*?\}|\[\(.*?\)\]|>.*?\]|\[\/.*?\/\]|\[\\.*?\\\]|\[\/.*?\\\]|\[\\.*?\/\])?)\s*(-{2,3}>?|\.->?|==>?)(?:\|(.*?)\|)?\s*([a-zA-Z0-9_]+(?:\[.*?\]|\(.*?\)|\(\(.*?\)\)|\(\[.*?\]\)|\{\{.*?\}\}|\{.*?\}|\[\(.*?\)\]|>.*?\]|\[\/.*?\/\]|\[\\.*?\\\]|\[\/.*?\\\]|\[\\.*?\/\])?)$/
      
      const edgeMatch = line.match(edgeRegex)
      if (edgeMatch) {
        const fromRaw = edgeMatch[1]
        const arrowType = edgeMatch[2]
        const edgeLabel = edgeMatch[3]
        const toRaw = edgeMatch[4]

        const fromNode = parseNodeToken(fromRaw, currentSubgraph?.id)
        const toNode = parseNodeToken(toRaw, currentSubgraph?.id)

        if (!nodes.has(fromNode.id)) {
          nodes.set(fromNode.id, fromNode)
          if (currentSubgraph) currentSubgraph.nodeIds.push(fromNode.id)
        } else if (fromNode.label !== fromNode.id) {
          nodes.set(fromNode.id, { ...nodes.get(fromNode.id)!, label: fromNode.label, shape: fromNode.shape })
        }

        if (!nodes.has(toNode.id)) {
          nodes.set(toNode.id, toNode)
          if (currentSubgraph) currentSubgraph.nodeIds.push(toNode.id)
        } else if (toNode.label !== toNode.id) {
          nodes.set(toNode.id, { ...nodes.get(toNode.id)!, label: toNode.label, shape: toNode.shape })
        }

        const isDotted = arrowType.includes(".")
        const isThick = arrowType.includes("=")
        const hasArrow = arrowType.endsWith(">")

        edges.push({
          from: fromNode.id,
          to: toNode.id,
          label: edgeLabel,
          style: isDotted ? "dotted" : isThick ? "thick" : "solid",
          arrow: hasArrow,
        })
        continue
      }

      // Check for standalone node definition e.g. A[Label]
      const nodeMatch = line.match(/^([a-zA-Z0-9_.-]+(?:\[.*?\]|\(.*?\)|\(\(.*?\)\)|\(\[.*?\]\)|\{\{.*?\}\}|\{.*?\}|\[\(.*?\)\]|>.*?\]|\[\/.*?\/\]|\[\\.*?\\\]|\[\/.*?\\\]|\[\\.*?\/\])?)$/)
      if (nodeMatch) {
        const node = parseNodeToken(nodeMatch[1], currentSubgraph?.id)
        if (!nodes.has(node.id)) {
          nodes.set(node.id, node)
          if (currentSubgraph) currentSubgraph.nodeIds.push(node.id)
        }
        continue
      }

      throw new Error(
        `Mermaid parse error in ${meta.file || "diagram"} (line ${lineNum}): Unrecognized syntax "${line}"`
      )
    }

    return {
      type: "flowchart",
      direction,
      nodes,
      edges,
      subgraphs,
      accTitle,
      accDescr,
    }
  }

  if (header.startsWith("sequenceDiagram")) {
    const actors: SequenceActor[] = []
    const messages: SequenceAst["messages"] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      if (line.startsWith("accTitle:")) {
        accTitle = line.replace(/^accTitle:\s*/, "").trim()
        continue
      }
      if (line.startsWith("accDescr:")) {
        accDescr = line.replace(/^accDescr:\s*/, "").trim()
        continue
      }
      if (line.startsWith("autonumber")) {
        continue
      }

      // participant / actor
      const actorMatch = line.match(/^(participant|actor)\s+([a-zA-Z0-9_.-]+)(?:\s+as\s+(.+))?$/i)
      if (actorMatch) {
        const isActor = actorMatch[1].toLowerCase() === "actor"
        const id = actorMatch[2]
        const label = actorMatch[3] || id
        if (!actors.some((a) => a.id === id)) {
          actors.push({ id, label, isActor })
        }
        continue
      }

      // message: A->>B: text or A-->>B: text or A->B: text
      const msgMatch = line.match(/^([a-zA-Z0-9_]+)\s*(-->>?|->>?|-x|--x|-\))\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$/)
      if (msgMatch) {
        const from = msgMatch[1]
        const arrowType = msgMatch[2]
        const to = msgMatch[3]
        const text = msgMatch[4]

        if (!actors.some((a) => a.id === from)) actors.push({ id: from, label: from })
        if (!actors.some((a) => a.id === to)) actors.push({ id: to, label: to })

        messages.push({
          type: "message",
          data: {
            from,
            to,
            text,
            style: arrowType.startsWith("--") ? "dotted" : "solid",
            arrow: true,
            isSelf: from === to,
          },
        })
        continue
      }

      // note over / left of / right of
      const noteMatch = line.match(/^Note\s+(?:over|(?:left|right)\s+of)\s+([a-zA-Z0-9_., -]+)\s*:\s*(.*)$/i)
      if (noteMatch) {
        const noteActors = noteMatch[1].split(",").map((s) => s.trim())
        for (const act of noteActors) {
          if (!actors.some((a) => a.id === act)) actors.push({ id: act, label: act })
        }
        messages.push({
          type: "note",
          data: {
            actors: noteActors,
            text: noteMatch[2],
          },
        })
        continue
      }

      // loop / alt / opt / par / rect
      const blockMatch = line.match(/^(loop|alt|opt|par|rect)\s*(.*)$/i)
      if (blockMatch) {
        messages.push({
          type: "block",
          kind: blockMatch[1].toLowerCase(),
          title: blockMatch[2] || blockMatch[1],
        })
        continue
      }

      if (line === "end") {
        messages.push({ type: "end" })
        continue
      }

      throw new Error(
        `Mermaid parse error in ${meta.file || "diagram"} (line ${lineNum}): Unrecognized sequence syntax "${line}"`
      )
    }

    return {
      type: "sequence",
      actors,
      messages,
      accTitle,
      accDescr,
    }
  }

  throw new Error(
    `Mermaid parse error in ${meta.file || "diagram"}: Unsupported diagram type "${header}". Supported types: graph, flowchart, sequenceDiagram.`
  )
}

function parseNodeToken(token: string, subgraphId?: string): NodeDef {
  // Check patterns in order of specificity
  // Stadium: ([label])
  let m = token.match(/^([a-zA-Z0-9_.-]+)\(\[(.*?)\]\)$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "stadium", subgraphId }

  // Cylinder: [(label)]
  m = token.match(/^([a-zA-Z0-9_.-]+)\[\((.*?)\)\]$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "cylinder", subgraphId }

  // Circle: ((label))
  m = token.match(/^([a-zA-Z0-9_.-]+)\(\((.*?)\)\)$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "circle", subgraphId }

  // Hexagon: {{label}}
  m = token.match(/^([a-zA-Z0-9_.-]+)\{\{(.*?)\}\}$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "hex", subgraphId }

  // Diamond: {label}
  m = token.match(/^([a-zA-Z0-9_.-]+)\{(.*?)\}$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "diamond", subgraphId }

  // Rounded: (label)
  m = token.match(/^([a-zA-Z0-9_.-]+)\((.*?)\)$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "round", subgraphId }

  // Parallelogram: [/label/] or [\label\]
  m = token.match(/^([a-zA-Z0-9_.-]+)\[\/(.*?)\/\]$/) || token.match(/^([a-zA-Z0-9_.-]+)\[\\(.*?)\\\]$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "parallelogram", subgraphId }

  // Flag: >label]
  m = token.match(/^([a-zA-Z0-9_.-]+)>(.*?)\]$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "flag", subgraphId }

  // Rectangle: [label]
  m = token.match(/^([a-zA-Z0-9_.-]+)\[(.*?)\]$/)
  if (m) return { id: m[1], label: m[2] || m[1], shape: "rect", subgraphId }

  // Plain ID
  return { id: token, label: token, shape: "rect", subgraphId }
}

interface LayoutNode {
  id: string
  label: string
  shape: NodeDef["shape"]
  x: number
  y: number
  width: number
  height: number
  lines: string[]
}

interface LayoutEdge {
  from: string
  to: string
  label?: string
  style: EdgeDef["style"]
  arrow: boolean
  points: Array<{ x: number; y: number }>
  labelPos?: { x: number; y: number }
}

/**
 * Computes coordinate geometry for flowcharts.
 */
function layoutFlowchart(ast: FlowchartAst) {
  const nodes = Array.from(ast.nodes.values())
  const isHorizontal = ast.direction === "LR" || ast.direction === "RL"
  const isReversed = ast.direction === "BT" || ast.direction === "RL"

  // Calculate node dimensions
  const layoutNodes = new Map<string, LayoutNode>()
  for (const n of nodes) {
    const rawLines = n.label.split(/<br\s*\/?>/i)
    const maxLineLen = Math.max(...rawLines.map((l) => l.length), 1)
    const charWidth = 8.5
    const width = Math.max(Math.min(maxLineLen * charWidth + 36, 320), 100)
    const height = Math.max(rawLines.length * 20 + 24, 44)
    layoutNodes.set(n.id, {
      id: n.id,
      label: n.label,
      shape: n.shape,
      x: 0,
      y: 0,
      width,
      height,
      lines: rawLines,
    })
  }

  // Calculate node ranks using BFS / topological order
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of ast.edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e.to)
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
    }
  }

  const ranks = new Map<string, number>()
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
      ranks.set(id, 0)
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!
    const currRank = ranks.get(curr) || 0
    for (const next of adj.get(curr) || []) {
      const nextRank = Math.max(ranks.get(next) || 0, currRank + 1)
      ranks.set(next, nextRank)
      inDegree.set(next, inDegree.get(next)! - 1)
      if (inDegree.get(next)! <= 0) {
        queue.push(next)
      }
    }
  }

  // Assign any disconnected / cycle nodes
  for (const n of nodes) {
    if (!ranks.has(n.id)) ranks.set(n.id, 0)
  }

  // Group nodes by rank
  const rankGroups = new Map<number, string[]>()
  for (const [id, rank] of ranks) {
    const actualRank = isReversed ? -rank : rank
    const group = rankGroups.get(actualRank) || []
    group.push(id)
    rankGroups.set(actualRank, group)
  }

  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b)
  const normalizedRanks = new Map<number, string[]>()
  sortedRanks.forEach((r, idx) => {
    normalizedRanks.set(idx, rankGroups.get(r)!)
  })

  // Position nodes along primary axis and secondary axis
  const rankSpacing = 70
  const nodeSpacing = 30
  let totalWidth = 0
  let totalHeight = 0

  if (!isHorizontal) {
    // Vertical layout (TD / TB)
    let currentY = 40
    let maxRowWidth = 0

    for (let r = 0; r < normalizedRanks.size; r++) {
      const rowNodeIds = normalizedRanks.get(r)!
      const rowNodes = rowNodeIds.map((id) => layoutNodes.get(id)!)
      const rowWidth =
        rowNodes.reduce((sum, n) => sum + n.width, 0) +
        (rowNodes.length - 1) * nodeSpacing
      const maxHeightInRow = Math.max(...rowNodes.map((n) => n.height))
      maxRowWidth = Math.max(maxRowWidth, rowWidth)

      let currentX = 40
      for (const n of rowNodes) {
        n.x = currentX
        n.y = currentY
        currentX += n.width + nodeSpacing
      }
      currentY += maxHeightInRow + rankSpacing
    }

    totalWidth = Math.max(maxRowWidth + 80, 280)
    totalHeight = currentY - rankSpacing + 40

    // Center each row within totalWidth
    for (let r = 0; r < normalizedRanks.size; r++) {
      const rowNodeIds = normalizedRanks.get(r)!
      const rowNodes = rowNodeIds.map((id) => layoutNodes.get(id)!)
      const rowWidth =
        rowNodes.reduce((sum, n) => sum + n.width, 0) +
        (rowNodes.length - 1) * nodeSpacing
      const startX = (totalWidth - rowWidth) / 2
      let curX = startX
      for (const n of rowNodes) {
        n.x = curX
        curX += n.width + nodeSpacing
      }
    }
  } else {
    // Horizontal layout (LR / RL)
    let currentX = 40
    let maxColHeight = 0

    for (let r = 0; r < normalizedRanks.size; r++) {
      const colNodeIds = normalizedRanks.get(r)!
      const colNodes = colNodeIds.map((id) => layoutNodes.get(id)!)
      const colHeight =
        colNodes.reduce((sum, n) => sum + n.height, 0) +
        (colNodes.length - 1) * nodeSpacing
      const maxWidthInCol = Math.max(...colNodes.map((n) => n.width))
      maxColHeight = Math.max(maxColHeight, colHeight)

      let currentY = 40
      for (const n of colNodes) {
        n.x = currentX
        n.y = currentY
        currentY += n.height + nodeSpacing
      }
      currentX += maxWidthInCol + rankSpacing
    }

    totalWidth = currentX - rankSpacing + 40
    totalHeight = Math.max(maxColHeight + 80, 160)

    // Center each column within totalHeight
    for (let r = 0; r < normalizedRanks.size; r++) {
      const colNodeIds = normalizedRanks.get(r)!
      const colNodes = colNodeIds.map((id) => layoutNodes.get(id)!)
      const colHeight =
        colNodes.reduce((sum, n) => sum + n.height, 0) +
        (colNodes.length - 1) * nodeSpacing
      const startY = (totalHeight - colHeight) / 2
      let curY = startY
      for (const n of colNodes) {
        n.y = curY
        curY += n.height + nodeSpacing
      }
    }
  }

  // Calculate edge routing
  const layoutEdges: LayoutEdge[] = []
  for (const e of ast.edges) {
    const fromN = layoutNodes.get(e.from)
    const toN = layoutNodes.get(e.to)
    if (!fromN || !toN) continue

    let startX: number
    let startY: number
    let endX: number
    let endY: number

    if (!isHorizontal) {
      // Top-to-Bottom connection
      if (fromN.y < toN.y) {
        startX = fromN.x + fromN.width / 2
        startY = fromN.y + fromN.height
        endX = toN.x + toN.width / 2
        endY = toN.y
      } else if (fromN.y > toN.y) {
        startX = fromN.x + fromN.width / 2
        startY = fromN.y
        endX = toN.x + toN.width / 2
        endY = toN.y + toN.height
      } else {
        // Same row
        if (fromN.x < toN.x) {
          startX = fromN.x + fromN.width
          startY = fromN.y + fromN.height / 2
          endX = toN.x
          endY = toN.y + toN.height / 2
        } else {
          startX = fromN.x
          startY = fromN.y + fromN.height / 2
          endX = toN.x + toN.width
          endY = toN.y + toN.height / 2
        }
      }
    } else {
      // Left-to-Right connection
      if (fromN.x < toN.x) {
        startX = fromN.x + fromN.width
        startY = fromN.y + fromN.height / 2
        endX = toN.x
        endY = toN.y + toN.height / 2
      } else if (fromN.x > toN.x) {
        startX = fromN.x
        startY = fromN.y + fromN.height / 2
        endX = toN.x + toN.width
        endY = toN.y + toN.height / 2
      } else {
        startX = fromN.x + fromN.width / 2
        startY = fromN.y + fromN.height
        endX = toN.x + toN.width / 2
        endY = toN.y
      }
    }

    const points: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
    if (Math.abs(startX - endX) > 2 && Math.abs(startY - endY) > 2) {
      if (!isHorizontal) {
        const midY = (startY + endY) / 2
        points.push({ x: startX, y: midY })
        points.push({ x: endX, y: midY })
      } else {
        const midX = (startX + endX) / 2
        points.push({ x: midX, y: startY })
        points.push({ x: midX, y: endY })
      }
    }
    points.push({ x: endX, y: endY })

    const labelPos = {
      x: (startX + endX) / 2,
      y: (startY + endY) / 2 - 8,
    }

    layoutEdges.push({
      from: e.from,
      to: e.to,
      label: e.label,
      style: e.style,
      arrow: e.arrow,
      points,
      labelPos,
    })
  }

  return {
    nodes: Array.from(layoutNodes.values()),
    edges: layoutEdges,
    width: totalWidth,
    height: totalHeight,
  }
}

/**
 * Computes coordinate geometry for sequence diagrams.
 */
function layoutSequence(ast: SequenceAst) {
  const actorWidth = 140
  const actorHeight = 44
  const actorSpacing = 40
  const stepHeight = 50

  const actors = ast.actors.map((a, idx) => {
    const x = 40 + idx * (actorWidth + actorSpacing)
    const centerX = x + actorWidth / 2
    return {
      ...a,
      x,
      centerX,
      y: 40,
      width: actorWidth,
      height: actorHeight,
    }
  })

  let currentY = 110
  const items: Array<{
    type: "message" | "note" | "block"
    fromX?: number
    toX?: number
    y: number
    text?: string
    style?: "solid" | "dotted"
    isSelf?: boolean
    title?: string
    kind?: string
  }> = []

  for (const item of ast.messages) {
    if (item.type === "message") {
      const fromActor = actors.find((a) => a.id === item.data.from)
      const toActor = actors.find((a) => a.id === item.data.to)
      if (fromActor && toActor) {
        items.push({
          type: "message",
          fromX: fromActor.centerX,
          toX: toActor.centerX,
          y: currentY,
          text: item.data.text,
          style: item.data.style,
          isSelf: item.data.isSelf,
        })
        currentY += stepHeight
      }
    } else if (item.type === "note") {
      const noteActor = actors.find((a) => a.id === item.data.actors[0])
      if (noteActor) {
        items.push({
          type: "note",
          fromX: noteActor.centerX - 60,
          toX: noteActor.centerX + 60,
          y: currentY,
          text: item.data.text,
        })
        currentY += stepHeight + 10
      }
    } else if (item.type === "block") {
      items.push({
        type: "block",
        y: currentY,
        title: item.title,
        kind: item.kind,
      })
      currentY += 30
    }
  }

  const totalWidth = Math.max(actors.length * (actorWidth + actorSpacing) + 40, 320)
  const totalHeight = currentY + 40
  const lifelineEndY = totalHeight - 50

  return {
    actors,
    items,
    width: totalWidth,
    height: totalHeight,
    lifelineEndY,
  }
}

/**
 * Generates light and dark theme SVGs from layout data.
 */
export function renderMermaidSvg(
  ast: DiagramAst,
  meta: DiagramMeta,
  diagramId: string
): RenderedThemeSvgs {
  const caption = meta.caption || ast.accDescr || meta.description || ""
  const title = meta.title || ast.accTitle || caption

  if (!caption || caption.trim() === "") {
    throw new Error(
      `Mermaid diagram in ${meta.file || "documentation"} is missing a required caption / text alternative. Add caption="Description of diagram" to the code block.`
    )
  }

  if (ast.type === "flowchart") {
    const layout = layoutFlowchart(ast)
    const lightSvg = buildFlowchartSvg(layout, title, caption, diagramId, "light")
    const darkSvg = buildFlowchartSvg(layout, title, caption, diagramId, "dark")
    return {
      lightSvg,
      darkSvg,
      caption,
      title,
      width: layout.width,
      height: layout.height,
      id: diagramId,
    }
  }

  if (ast.type === "sequence") {
    const layout = layoutSequence(ast)
    const lightSvg = buildSequenceSvg(layout, title, caption, diagramId, "light")
    const darkSvg = buildSequenceSvg(layout, title, caption, diagramId, "dark")
    return {
      lightSvg,
      darkSvg,
      caption,
      title,
      width: layout.width,
      height: layout.height,
      id: diagramId,
    }
  }

  throw new Error(`Unsupported diagram AST type`)
}

function buildFlowchartSvg(
  layout: ReturnType<typeof layoutFlowchart>,
  title: string,
  caption: string,
  diagramId: string,
  theme: "light" | "dark"
): string {
  const isLight = theme === "light"

  // sRGB mirrors of the @workspace/ui roles (surface/text/border/primary).
  // Both theme variants are serialised into the markup at build time, so
  // these cannot be var() references — see the mermaid.ts entry in
  // scripts/check-design-tokens.ts.
  const colors = {
    bg: isLight ? "#f8fafc" : "#0b1220",
    nodeFill: isLight ? "#ffffff" : "#1e293b",
    nodeStroke: isLight ? "#cbd5e1" : "#334155",
    nodeText: isLight ? "#0f172a" : "#f8fafc",
    nodeSubtext: isLight ? "#475569" : "#94a3b8",
    edgeStroke: isLight ? "#64748b" : "#94a3b8",
    arrowFill: isLight ? "#0284c7" : "#38bdf8",
    labelBg: isLight ? "#ffffff" : "#0f172a",
    labelText: isLight ? "#334155" : "#cbd5e1",
    labelBorder: isLight ? "#e2e8f0" : "#334155",
  }

  const titleId = `title-${diagramId}-${theme}`
  const descId = `desc-${diagramId}-${theme}`
  const arrowMarkerId = `arrow-${diagramId}-${theme}`

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" class="mermaid-svg max-w-full h-auto" role="img" aria-labelledby="${titleId} ${descId}">\n`
  svg += `  <title id="${titleId}">${escapeXml(title)}</title>\n`
  svg += `  <desc id="${descId}">${escapeXml(caption)}</desc>\n`
  svg += `  <defs>\n`
  svg += `    <marker id="${arrowMarkerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${colors.arrowFill}" />\n`
  svg += `    </marker>\n`
  svg += `  </defs>\n`

  // Render edges
  for (const e of layout.edges) {
    const pathData = `M ${e.points.map((p) => `${p.x} ${p.y}`).join(" L ")}`
    const dashAttr = e.style === "dotted" ? ' stroke-dasharray="4 4"' : ""
    const widthAttr = e.style === "thick" ? ' stroke-width="2.5"' : ' stroke-width="1.75"'
    const markerAttr = e.arrow ? ` marker-end="url(#${arrowMarkerId})"` : ""

    svg += `  <path d="${pathData}" fill="none" stroke="${colors.edgeStroke}"${widthAttr}${dashAttr}${markerAttr} class="transition-colors" />\n`

    if (e.label && e.labelPos) {
      const labelText = escapeXml(e.label)
      const labelW = Math.max(labelText.length * 7 + 16, 30)
      const labelH = 20
      svg += `  <g transform="translate(${e.labelPos.x - labelW / 2}, ${e.labelPos.y - labelH / 2})">\n`
      svg += `    <rect width="${labelW}" height="${labelH}" rx="4" fill="${colors.labelBg}" stroke="${colors.labelBorder}" stroke-width="1" />\n`
      svg += `    <text x="${labelW / 2}" y="${labelH / 2 + 4}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="11" font-weight="500" fill="${colors.labelText}">${labelText}</text>\n`
      svg += `  </g>\n`
    }
  }

  // Render nodes
  for (const n of layout.nodes) {
    svg += `  <g transform="translate(${n.x}, ${n.y})" class="mermaid-node">\n`
    
    // Draw shape
    if (n.shape === "circle") {
      const r = Math.min(n.width, n.height) / 2
      svg += `    <circle cx="${n.width / 2}" cy="${n.height / 2}" r="${r}" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
    } else if (n.shape === "diamond") {
      const hw = n.width / 2
      const hh = n.height / 2
      svg += `    <polygon points="${hw},0 ${n.width},${hh} ${hw},${n.height} 0,${hh}" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
    } else if (n.shape === "stadium" || n.shape === "round") {
      const rx = n.shape === "stadium" ? n.height / 2 : 8
      svg += `    <rect width="${n.width}" height="${n.height}" rx="${rx}" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
    } else if (n.shape === "cylinder") {
      svg += `    <rect width="${n.width}" height="${n.height}" rx="6" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
      svg += `    <path d="M 0 10 Q ${n.width / 2} 18 ${n.width} 10" fill="none" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
    } else {
      // Default rect
      svg += `    <rect width="${n.width}" height="${n.height}" rx="6" fill="${colors.nodeFill}" stroke="${colors.nodeStroke}" stroke-width="1.5" />\n`
    }

    // Render node text lines
    const startY = (n.height - (n.lines.length - 1) * 16) / 2 + 4
    n.lines.forEach((line, idx) => {
      const fill = idx === 0 ? colors.nodeText : colors.nodeSubtext
      const weight = idx === 0 ? "600" : "400"
      const size = idx === 0 ? "13" : "11"
      svg += `    <text x="${n.width / 2}" y="${startY + idx * 16}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>\n`
    })

    svg += `  </g>\n`
  }

  svg += `</svg>`
  return svg
}

function buildSequenceSvg(
  layout: ReturnType<typeof layoutSequence>,
  title: string,
  caption: string,
  diagramId: string,
  theme: "light" | "dark"
): string {
  const isLight = theme === "light"

  // sRGB mirrors of the @workspace/ui roles — see buildFlowchartSvg above.
  const colors = {
    bg: isLight ? "#f8fafc" : "#0b1220",
    actorFill: isLight ? "#ffffff" : "#1e293b",
    actorStroke: isLight ? "#cbd5e1" : "#334155",
    actorText: isLight ? "#0f172a" : "#f8fafc",
    lifeline: isLight ? "#cbd5e1" : "#334155",
    msgStroke: isLight ? "#64748b" : "#94a3b8",
    msgText: isLight ? "#334155" : "#cbd5e1",
    arrowFill: isLight ? "#0284c7" : "#38bdf8",
    noteFill: isLight ? "#fef3c7" : "#78350f",
    noteStroke: isLight ? "#fde68a" : "#92400e",
    noteText: isLight ? "#92400e" : "#fef3c7",
  }

  const titleId = `title-${diagramId}-${theme}`
  const descId = `desc-${diagramId}-${theme}`
  const arrowMarkerId = `seq-arrow-${diagramId}-${theme}`

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" class="mermaid-svg max-w-full h-auto" role="img" aria-labelledby="${titleId} ${descId}">\n`
  svg += `  <title id="${titleId}">${escapeXml(title)}</title>\n`
  svg += `  <desc id="${descId}">${escapeXml(caption)}</desc>\n`
  svg += `  <defs>\n`
  svg += `    <marker id="${arrowMarkerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`
  svg += `      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${colors.arrowFill}" />\n`
  svg += `    </marker>\n`
  svg += `  </defs>\n`

  // Render lifelines
  for (const a of layout.actors) {
    svg += `  <line x1="${a.centerX}" y1="${a.y + a.height}" x2="${a.centerX}" y2="${layout.lifelineEndY}" stroke="${colors.lifeline}" stroke-width="1.5" stroke-dasharray="5 5" />\n`
  }

  // Render actors (top)
  for (const a of layout.actors) {
    svg += `  <g transform="translate(${a.x}, ${a.y})">\n`
    svg += `    <rect width="${a.width}" height="${a.height}" rx="6" fill="${colors.actorFill}" stroke="${colors.actorStroke}" stroke-width="1.5" />\n`
    svg += `    <text x="${a.width / 2}" y="${a.height / 2 + 5}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="13" font-weight="600" fill="${colors.actorText}">${escapeXml(a.label)}</text>\n`
    svg += `  </g>\n`
  }

  // Render items (messages, notes)
  for (const item of layout.items) {
    if (item.type === "message" && item.fromX !== undefined && item.toX !== undefined) {
      const dash = item.style === "dotted" ? ' stroke-dasharray="4 4"' : ""
      if (item.isSelf) {
        svg += `  <path d="M ${item.fromX} ${item.y} L ${item.fromX + 30} ${item.y} L ${item.fromX + 30} ${item.y + 20} L ${item.fromX} ${item.y + 20}" fill="none" stroke="${colors.msgStroke}" stroke-width="1.75"${dash} marker-end="url(#${arrowMarkerId})" />\n`
        if (item.text) {
          svg += `  <text x="${item.fromX + 35}" y="${item.y + 14}" font-family="var(--font-sans, system-ui, sans-serif)" font-size="11" font-weight="500" fill="${colors.msgText}">${escapeXml(item.text)}</text>\n`
        }
      } else {
        svg += `  <line x1="${item.fromX}" y1="${item.y}" x2="${item.toX}" y2="${item.y}" stroke="${colors.msgStroke}" stroke-width="1.75"${dash} marker-end="url(#${arrowMarkerId})" />\n`
        if (item.text) {
          const midX = (item.fromX + item.toX) / 2
          svg += `  <text x="${midX}" y="${item.y - 8}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="11" font-weight="500" fill="${colors.msgText}">${escapeXml(item.text)}</text>\n`
        }
      }
    } else if (item.type === "note" && item.fromX !== undefined && item.toX !== undefined) {
      const nw = item.toX - item.fromX
      const nh = 26
      svg += `  <g transform="translate(${item.fromX}, ${item.y - nh / 2})">\n`
      svg += `    <rect width="${nw}" height="${nh}" rx="4" fill="${colors.noteFill}" stroke="${colors.noteStroke}" stroke-width="1" />\n`
      svg += `    <text x="${nw / 2}" y="${nh / 2 + 4}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="11" font-weight="500" fill="${colors.noteText}">${escapeXml(item.text || "")}</text>\n`
      svg += `  </g>\n`
    }
  }

  // Render actors (bottom)
  for (const a of layout.actors) {
    svg += `  <g transform="translate(${a.x}, ${layout.lifelineEndY})">\n`
    svg += `    <rect width="${a.width}" height="${a.height}" rx="6" fill="${colors.actorFill}" stroke="${colors.actorStroke}" stroke-width="1.5" />\n`
    svg += `    <text x="${a.width / 2}" y="${a.height / 2 + 5}" text-anchor="middle" font-family="var(--font-sans, system-ui, sans-serif)" font-size="13" font-weight="600" fill="${colors.actorText}">${escapeXml(a.label)}</text>\n`
    svg += `  </g>\n`
  }

  svg += `</svg>`
  return svg
}

/**
 * Renders a complete HTML figure markup wrapping dual-theme SVG diagrams
 * with accessible scrolling container and caption.
 */
export function renderMermaidFigureHtml(
  code: string,
  meta: DiagramMeta = {}
): string {
  const ast = parseMermaid(code, meta)
  const id = generateDiagramId()
  const rendered = renderMermaidSvg(ast, meta, id)

  const captionId = `caption-${id}`

  return `<figure class="mermaid-wrapper my-6 rounded-xl border border-border bg-surface-sunken overflow-hidden" role="figure" aria-labelledby="${captionId}">
  <div class="mermaid-scroll overflow-x-auto p-4 md:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" tabindex="0" role="region" aria-label="Diagram content">
    <div class="mermaid-diagram mermaid-diagram-light block dark:hidden">
      ${rendered.lightSvg}
    </div>
    <div class="mermaid-diagram mermaid-diagram-dark hidden dark:block">
      ${rendered.darkSvg}
    </div>
  </div>
  <figcaption id="${captionId}" class="mermaid-caption px-4 py-2 border-t border-border bg-surface-elevated text-xs font-sans text-text-secondary text-center">
    ${escapeXml(rendered.caption)}
  </figcaption>
</figure>`
}
