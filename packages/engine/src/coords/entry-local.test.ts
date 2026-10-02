import { describe, expect, it } from 'vitest'
import {
  distancePointToSegment,
  entryLocalToWorld,
  pointInRotatedRect,
  worldToEntryLocal,
} from './entry-local'

const rect = { x: 100, y: 200, w: 240, h: 160 }

describe('worldToEntryLocal / entryLocalToWorld', () => {
  it('round-trips at various rotations', () => {
    const p = { x: 173, y: 251.5 }
    for (const deg of [0, 33, 90, -45, 180, 359]) {
      const local = worldToEntryLocal(p, rect, deg)
      const back = entryLocalToWorld(local, rect, deg)
      expect(back.x).toBeCloseTo(p.x, 9)
      expect(back.y).toBeCloseTo(p.y, 9)
    }
  })

  it('reduces to plain subtraction at rotation 0', () => {
    expect(worldToEntryLocal({ x: 130, y: 250 }, rect, 0)).toEqual({ x: 30, y: 50 })
    expect(entryLocalToWorld({ x: 30, y: 50 }, rect, 0)).toEqual({ x: 130, y: 250 })
  })

  it('maps the entry centre to (w/2, h/2) under any rotation', () => {
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
    for (const deg of [0, 17, 90, -120]) {
      const local = worldToEntryLocal(centre, rect, deg)
      expect(local.x).toBeCloseTo(rect.w / 2, 9)
      expect(local.y).toBeCloseTo(rect.h / 2, 9)
    }
  })

  it('rotates about the centre: a corner maps consistently at 90°', () => {
    // At 90° the world point that lands on local top-left is the unrotated top-right
    // corner rotated 90° about the centre.
    const local = worldToEntryLocal({ x: 260, y: 210 }, rect, 90)
    const back = entryLocalToWorld(local, rect, 90)
    expect(back.x).toBeCloseTo(260, 9)
    expect(back.y).toBeCloseTo(210, 9)
  })
})

describe('pointInRotatedRect', () => {
  it('matches plain containment at rotation 0', () => {
    expect(pointInRotatedRect({ x: 100, y: 200 }, rect, 0)).toBe(true)
    expect(pointInRotatedRect({ x: 340, y: 360 }, rect, 0)).toBe(true)
    expect(pointInRotatedRect({ x: 99, y: 200 }, rect, 0)).toBe(false)
    expect(pointInRotatedRect({ x: 341, y: 360 }, rect, 0)).toBe(false)
  })

  it('rotation flips containment near a corner', () => {
    // 126 world px right of the centre: outside the unrotated half-width (120)…
    const p = { x: rect.x + rect.w + 6, y: rect.y + rect.h / 2 }
    expect(pointInRotatedRect(p, rect, 0)).toBe(false)
    // …but a 30° spin puts it near the corner diagonal, where the rect reaches ~144.
    expect(pointInRotatedRect(p, rect, 30)).toBe(true)
    // At 45° the reach along that direction shrinks to ~113 — outside again.
    expect(pointInRotatedRect(p, rect, 45)).toBe(false)
  })

  it('is exact on edges (inclusive)', () => {
    expect(pointInRotatedRect({ x: rect.x, y: rect.y + 10 }, rect, 0)).toBe(true)
  })
})

describe('distancePointToSegment', () => {
  it('projects onto the segment interior', () => {
    expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
  })

  it('clamps to the nearest endpoint beyond the ends', () => {
    expect(distancePointToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
    expect(distancePointToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
  })

  it('handles a zero-length segment as point distance', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5)
  })
})
