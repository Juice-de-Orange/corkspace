import { describe, expect, it } from 'vitest'
import { buildGraph, type GraphEdge, type GraphNodeInput } from './graph-dto'

const node = (id: string): GraphNodeInput => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 240,
  height: 240,
})

describe('buildGraph', () => {
  it('annotates each node with its degree', () => {
    const g = buildGraph(
      [node('a'), node('b'), node('c')],
      [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'c' },
      ],
    )
    const byId = new Map(g.nodes.map((n) => [n.id, n.degree]))
    expect(byId.get('a')).toBe(2)
    expect(byId.get('b')).toBe(1)
    expect(byId.get('c')).toBe(1)
  })

  it('drops edges whose endpoint is not a live node', () => {
    const edges: GraphEdge[] = [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'ghost' }, // endpoint missing → dropped
    ]
    const g = buildGraph([node('a'), node('b')], edges)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]?.id).toBe('e1')
    expect(g.nodes.find((n) => n.id === 'a')?.degree).toBe(1)
  })

  it('gives orphan nodes degree 0', () => {
    const g = buildGraph([node('lone')], [])
    expect(g.nodes[0]?.degree).toBe(0)
    expect(g.edges).toHaveLength(0)
  })

  it('preserves node fields', () => {
    const g = buildGraph([{ ...node('a'), x: 5, y: 7, type: 'doc' }], [])
    expect(g.nodes[0]).toMatchObject({ id: 'a', type: 'doc', x: 5, y: 7 })
  })
})
