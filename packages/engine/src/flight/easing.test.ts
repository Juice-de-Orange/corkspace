import { describe, expect, it } from 'vitest'
import { clamp01, easeInCubic, easeInOutCubic, easeOutCubic } from './easing'

const curves = [easeInOutCubic, easeOutCubic, easeInCubic]

describe('easing', () => {
  it('clamp01 bounds to [0,1]', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })

  it('every curve fixes the endpoints', () => {
    for (const f of curves) {
      expect(f(0)).toBeCloseTo(0, 10)
      expect(f(1)).toBeCloseTo(1, 10)
    }
  })

  it('easeInOutCubic is symmetric around 0.5', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 10)
  })

  it('every curve is monotonic non-decreasing on [0,1]', () => {
    for (const f of curves) {
      let prev = -1
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const v = f(t)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })
})
