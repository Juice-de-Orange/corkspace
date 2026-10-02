import type { Rect } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { collides, collidingIds, overlapAmount } from './collision'

const r = (x: number, y: number, w = 100, h = 100): Rect => ({ x, y, w, h })

describe('collision', () => {
  it('separate rects do not collide', () => {
    expect(collides(r(0, 0), r(200, 0))).toBe(false)
    expect(overlapAmount(r(0, 0), r(200, 0)).x).toBeLessThan(0)
  })

  it('rects sharing only an edge do NOT collide (overlap < 1px)', () => {
    // a ends at x=100, b starts at x=100 → overlap 0
    expect(collides(r(0, 0), r(100, 0))).toBe(false)
  })

  it('a 1px overlap on both axes collides', () => {
    expect(collides(r(0, 0), r(99, 99))).toBe(true)
    expect(overlapAmount(r(0, 0), r(99, 99))).toEqual({ x: 1, y: 1 })
  })

  it('overlap on one axis only does not collide', () => {
    // overlap in x but a gap in y
    expect(collides(r(0, 0), r(50, 200))).toBe(false)
  })

  it('containment collides', () => {
    expect(collides(r(0, 0, 200, 200), r(50, 50))).toBe(true)
  })

  it('collidingIds excludes self and returns overlapping candidates', () => {
    const candidates = [
      { id: 'self', rect: r(0, 0) },
      { id: 'hit', rect: r(50, 50) },
      { id: 'miss', rect: r(500, 500) },
    ]
    expect(collidingIds(r(0, 0), candidates, 'self')).toEqual(['hit'])
  })
})
