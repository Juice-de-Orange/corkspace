import { describe, expect, it } from 'vitest'
import {
  rectBottom,
  rectCenter,
  rectContainsPoint,
  rectCorners,
  rectFromPoints,
  rectInflate,
  rectRight,
  rectsIntersect,
} from './rect'

const r = { x: 10, y: 20, w: 100, h: 50 }

describe('rect helpers', () => {
  it('computes center, right and bottom edges', () => {
    expect(rectCenter(r)).toEqual({ x: 60, y: 45 })
    expect(rectRight(r)).toBe(110)
    expect(rectBottom(r)).toBe(70)
  })

  it('lists corners clockwise from top-left', () => {
    expect(rectCorners(r)).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ])
  })

  it('tests point containment inclusive of edges', () => {
    expect(rectContainsPoint(r, { x: 10, y: 20 })).toBe(true)
    expect(rectContainsPoint(r, { x: 60, y: 45 })).toBe(true)
    expect(rectContainsPoint(r, { x: 9, y: 45 })).toBe(false)
  })

  it('detects strict overlap (touching edges do not intersect)', () => {
    expect(rectsIntersect(r, { x: 50, y: 40, w: 10, h: 10 })).toBe(true)
    expect(rectsIntersect(r, { x: 110, y: 20, w: 10, h: 10 })).toBe(false) // shares right edge
    expect(rectsIntersect(r, { x: 200, y: 200, w: 10, h: 10 })).toBe(false)
  })

  it('inflates a rect symmetrically', () => {
    expect(rectInflate(r, 5)).toEqual({ x: 5, y: 15, w: 110, h: 60 })
  })

  it('builds an axis-aligned rect spanning two points', () => {
    expect(rectFromPoints({ x: 30, y: 5 }, { x: 10, y: 25 })).toEqual({ x: 10, y: 5, w: 20, h: 20 })
  })
})
