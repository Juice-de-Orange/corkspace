import { describe, expect, it } from 'vitest'
import { createPrng, hashStringToSeed, randomInRange } from './prng'
import { randomTiltDegrees } from './tilt'

describe('createPrng (mulberry32)', () => {
  it('is deterministic for a seed', () => {
    const a = createPrng(42)
    const b = createPrng(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produces values in [0, 1)', () => {
    const p = createPrng(123)
    for (let i = 0; i < 1000; i++) {
      const v = p()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('differs across seeds', () => {
    expect(createPrng(1)()).not.toBe(createPrng(2)())
  })
})

describe('randomInRange', () => {
  it('maps into [min, max)', () => {
    const p = createPrng(7)
    for (let i = 0; i < 200; i++) {
      const v = randomInRange(p, -5, 5)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(5)
    }
  })
})

describe('hashStringToSeed', () => {
  it('is stable and case-sensitive', () => {
    expect(hashStringToSeed('entry-1')).toBe(hashStringToSeed('entry-1'))
    expect(hashStringToSeed('entry-1')).not.toBe(hashStringToSeed('entry-2'))
  })
})

describe('randomTiltDegrees', () => {
  it('is deterministic per id and within ±maxAbsDeg', () => {
    const t = randomTiltDegrees('abc')
    expect(randomTiltDegrees('abc')).toBe(t)
    expect(Math.abs(t)).toBeLessThanOrEqual(4)
  })

  it('accepts a numeric seed and respects a custom bound', () => {
    const t = randomTiltDegrees(99, 10)
    expect(Math.abs(t)).toBeLessThanOrEqual(10)
    expect(randomTiltDegrees(99, 10)).toBe(t)
  })
})
