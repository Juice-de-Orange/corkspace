// --- Connection graph shaping (dashboard graph view) ---

export interface GraphNodeInput {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export interface GraphEdge {
  id: string
  from: string
  to: string
}

export interface GraphNode extends GraphNodeInput {
  /** Number of connections touching this node (drives node size / orphan highlighting). */
  degree: number
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Shape raw entry/connection rows into a render-ready graph: drop edges whose endpoint is not a
 * live node (e.g. a connection to a soft-deleted entry) and annotate each node with its degree.
 * Pure — unit-tested; the force layout that consumes it lives in the web GraphView.
 */
export function buildGraph(nodes: GraphNodeInput[], edges: GraphEdge[]): Graph {
  const ids = new Set(nodes.map((n) => n.id))
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  const degree = new Map<string, number>()
  for (const e of valid) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  return {
    nodes: nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })),
    edges: valid,
  }
}
