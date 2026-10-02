import { describe, expect, it } from 'vitest'
import { strokeHit, strokeHitPolyline } from './stroke-hit'

describe('strokeHitPolyline', () => {
  it('expands a rect stroke to its closed 4-edge outline', () => {
    expect(
      strokeHitPolyline({
        tool: 'rect',
        points: [
          [0, 0],
          [10, 10],
        ],
      }),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ])
  })

  it('passes non-rect strokes through unchanged', () => {
    const pts = [
      [0, 0],
      [5, 5],
      [10, 0],
    ]
    expect(strokeHitPolyline({ tool: 'pen', points: pts })).toBe(pts)
  })
})

describe('strokeHit', () => {
  it('hits within the threshold of a segment and misses beyond it', () => {
    const s = {
      tool: 'pen',
      points: [
        [0, 0],
        [10, 0],
      ],
    }
    expect(strokeHit(s, 5, 1, 2)).toBe(true)
    expect(strokeHit(s, 5, 5, 2)).toBe(false)
  })

  it('hits a single-point stroke by distance to the point', () => {
    const s = { tool: 'pen', points: [[0, 0]] }
    expect(strokeHit(s, 1, 1, 2)).toBe(true)
    expect(strokeHit(s, 3, 3, 2)).toBe(false)
  })

  it('hits a rect stroke on any edge but not its hollow interior', () => {
    const s = {
      tool: 'rect',
      points: [
        [0, 0],
        [10, 10],
      ],
    }
    expect(strokeHit(s, 5, 0, 1)).toBe(true) // top edge
    expect(strokeHit(s, 10, 5, 1)).toBe(true) // right edge
    expect(strokeHit(s, 5, 5, 1)).toBe(false) // interior
  })
})
