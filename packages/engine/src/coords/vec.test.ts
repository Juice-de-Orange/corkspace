import { describe, expect, it } from 'vitest'
import { add, dist, dot, len, lerp, normalize, scale, sub, vec } from './vec'

describe('vec math', () => {
  it('constructs, adds, subtracts and scales', () => {
    expect(vec(1, 2)).toEqual({ x: 1, y: 2 })
    expect(add(vec(1, 2), vec(3, 4))).toEqual({ x: 4, y: 6 })
    expect(sub(vec(3, 4), vec(1, 1))).toEqual({ x: 2, y: 3 })
    expect(scale(vec(2, 3), 2)).toEqual({ x: 4, y: 6 })
  })

  it('computes dot, length and distance', () => {
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11)
    expect(len(vec(3, 4))).toBe(5)
    expect(dist(vec(0, 0), vec(3, 4))).toBe(5)
  })

  it('lerps between two vectors', () => {
    expect(lerp(vec(0, 0), vec(10, 20), 0.5)).toEqual({ x: 5, y: 10 })
    expect(lerp(vec(0, 0), vec(10, 20), 0)).toEqual({ x: 0, y: 0 })
    expect(lerp(vec(0, 0), vec(10, 20), 1)).toEqual({ x: 10, y: 20 })
  })

  it('normalizes to a unit vector, guarding the zero vector', () => {
    const n = normalize(vec(3, 4))
    expect(len(n)).toBeCloseTo(1, 10)
    expect(normalize(vec(0, 0))).toEqual({ x: 0, y: 0 })
  })
})
