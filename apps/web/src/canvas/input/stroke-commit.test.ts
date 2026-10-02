import { describe, expect, it } from 'vitest'
import { freehandPoints, isShapeCommittable, toStoredPoints } from './stroke-commit'

describe('freehandPoints', () => {
  it('expands a single point into a tiny 2-point dot', () => {
    const out = freehandPoints([[3, 4]])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual([3, 4])
    expect(out[1]).toEqual([3.01, 4.01])
  })

  it('leaves multi-point strokes unchanged', () => {
    const pts = [
      [0, 0],
      [1, 1],
    ]
    expect(freehandPoints(pts)).toBe(pts)
  })
})

describe('toStoredPoints', () => {
  it('returns world points unchanged when there is no anchor', () => {
    const pts = [
      [1, 2],
      [3, 4],
    ]
    expect(toStoredPoints(pts, null)).toBe(pts)
  })

  it('maps points into the anchor entry-local space', () => {
    // anchor at origin, no rotation → entry-local coincides with world here
    const stored = toStoredPoints([[10, 20]], {
      id: 'a',
      rect: { x: 0, y: 0, w: 100, h: 100 },
      rotation: 0,
    })
    expect(stored[0]?.[0]).toBeCloseTo(10)
    expect(stored[0]?.[1]).toBeCloseTo(20)
  })
})

describe('isShapeCommittable', () => {
  it('is true for a drag of at least 2 screen px and false below', () => {
    expect(isShapeCommittable([0, 0], [10, 0], 1)).toBe(true)
    expect(isShapeCommittable([0, 0], [1, 0], 1)).toBe(false)
    expect(isShapeCommittable([0, 0], [1, 0], 4)).toBe(true) // threshold shrinks with zoom
  })
})
