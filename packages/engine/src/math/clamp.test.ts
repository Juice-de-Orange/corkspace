import { describe, expect, it } from 'vitest'
import { clamp, clampZoom } from './clamp'

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps below min and above max', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('treats the bounds as inclusive', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('throws when min > max', () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError)
  })
})

describe('clampZoom', () => {
  it('clamps to the product zoom bounds', () => {
    expect(clampZoom(0)).toBe(0.02)
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(100)).toBe(8)
  })
})
