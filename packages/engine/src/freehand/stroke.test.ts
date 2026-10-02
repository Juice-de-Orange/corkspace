import { describe, expect, it } from 'vitest'
import { strokeBbox, strokeOutline, strokePath } from './stroke'

const points = [
  [0, 0],
  [10, 5],
  [20, 0],
  [30, 10],
]

describe('freehand stroke', () => {
  it('produces a non-empty outline for a multi-point stroke', () => {
    expect(strokeOutline(points, { size: 8 }).length).toBeGreaterThan(0)
  })

  it('is deterministic (no simulated pressure)', () => {
    expect(strokeOutline(points, { size: 8 })).toEqual(strokeOutline(points, { size: 8 }))
  })

  it('strokePath is a closed SVG path', () => {
    const d = strokePath(points, { size: 8 })
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith(' Z')).toBe(true)
  })

  it('strokeBbox is the tight bound of the raw points', () => {
    expect(strokeBbox(points)).toEqual({ x: 0, y: 0, w: 30, h: 10 })
  })

  it('strokeBbox of no points is a zero rect; empty outline → empty path', () => {
    expect(strokeBbox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(strokePath([], { size: 8 })).toBe('')
  })
})
