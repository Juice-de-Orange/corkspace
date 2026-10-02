import type { Rect } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { anchorOn, bezierPath, bezierPoint, routeConnection } from './route'

const box: Rect = { x: 0, y: 0, w: 100, h: 100 } // centre (50,50)

describe('connection routing', () => {
  it('anchors on the edge facing the target, with the correct outward normal', () => {
    const right = anchorOn(box, { x: 1000, y: 50 })
    expect(right.point).toEqual({ x: 100, y: 50 })
    expect(right.normal).toEqual({ x: 1, y: 0 })

    const up = anchorOn(box, { x: 50, y: -1000 })
    expect(up.point).toEqual({ x: 50, y: 0 })
    expect(up.normal).toEqual({ x: 0, y: -1 })
  })

  it('routes from the right edge of A to the left edge of B', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 }
    const b: Rect = { x: 400, y: 0, w: 100, h: 100 }
    const r = routeConnection(a, b)
    expect(r.a1).toEqual({ x: 100, y: 50 }) // right edge of A
    expect(r.a2).toEqual({ x: 400, y: 50 }) // left edge of B
    // control points pushed outward along the edge normals
    expect(r.c1.x).toBeGreaterThan(r.a1.x)
    expect(r.c2.x).toBeLessThan(r.a2.x)
  })

  it('bezierPoint hits the endpoints at t=0 and t=1; path string is well-formed', () => {
    const r = routeConnection({ x: 0, y: 0, w: 100, h: 100 }, { x: 400, y: 0, w: 100, h: 100 })
    expect(bezierPoint(r, 0)).toEqual(r.a1)
    expect(bezierPoint(r, 1)).toEqual(r.a2)
    const mid = bezierPoint(r, 0.5)
    expect(mid.x).toBeGreaterThan(r.a1.x)
    expect(mid.x).toBeLessThan(r.a2.x)
    expect(bezierPath(r)).toMatch(/^M .* C .*/)
  })

  it('sagFactor drops both control points by min(90, dist·factor); endpoints stay put', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 }
    const b: Rect = { x: 400, y: 0, w: 100, h: 100 }
    const straight = routeConnection(a, b)
    const saggy = routeConnection(a, b, { sagFactor: 0.1 })
    const dist = 300 // a1 (100,50) → a2 (400,50)
    expect(saggy.a1).toEqual(straight.a1)
    expect(saggy.a2).toEqual(straight.a2)
    expect(saggy.c1.y - straight.c1.y).toBeCloseTo(dist * 0.1, 9)
    expect(saggy.c2.y - straight.c2.y).toBeCloseTo(dist * 0.1, 9)
    // the yarn hangs BELOW the straight line at the midpoint
    expect(bezierPoint(saggy, 0.5).y).toBeGreaterThan(bezierPoint(straight, 0.5).y)

    // sag is clamped at 90 world units for very long threads
    const far: Rect = { x: 4000, y: 0, w: 100, h: 100 }
    const clamped = routeConnection(a, far, { sagFactor: 0.1 })
    const clampedStraight = routeConnection(a, far)
    expect(clamped.c1.y - clampedStraight.c1.y).toBe(90)
  })
})
