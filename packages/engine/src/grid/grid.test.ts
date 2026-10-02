import { camera } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { gridBackground, gridStep } from './grid'

describe('gridStep', () => {
  it('keeps on-screen spacing within the legible band across the whole zoom range', () => {
    for (const zoom of [0.02, 0.1, 0.5, 1, 3, 8]) {
      const { screenStep, worldStep } = gridStep(zoom)
      expect(screenStep).toBeGreaterThanOrEqual(24)
      expect(screenStep).toBeLessThanOrEqual(96)
      expect(worldStep).toBeGreaterThan(0)
    }
  })

  it('throws for a non-positive zoom', () => {
    expect(() => gridStep(0)).toThrow(RangeError)
  })
})

describe('gridBackground', () => {
  const MAX_OPACITY = 0.55 // must match gridBackground's default

  it('produces two octave layers with positive sizes and origin-aligned wrapped offsets', () => {
    const bg = gridBackground(camera(130, -50, 1))
    for (const layer of [bg.fine, bg.coarse]) {
      expect(layer.sizePx).toBeGreaterThan(0)
      expect(layer.offsetXPx).toBeGreaterThanOrEqual(0)
      expect(layer.offsetXPx).toBeLessThan(layer.sizePx)
      expect(layer.offsetYPx).toBeGreaterThanOrEqual(0)
      expect(layer.offsetYPx).toBeLessThan(layer.sizePx)
      expect(layer.opacity).toBeGreaterThanOrEqual(0)
      expect(layer.opacity).toBeLessThanOrEqual(MAX_OPACITY + 1e-9)
    }
    // Coarse octave is exactly double the fine octave.
    expect(bg.coarse.sizePx).toBeCloseTo(bg.fine.sizePx * 2, 6)
  })

  it('throws for a non-positive zoom', () => {
    expect(() => gridBackground(camera(0, 0, 0))).toThrow(RangeError)
  })

  it('cross-fades continuously across octave boundaries (no "pop")', () => {
    // Dense multiplicative sweep across the whole zoom range (crosses many octave flips).
    const samples: { max: number; sum: number }[] = []
    const steps = 400
    for (let i = 0; i <= steps; i++) {
      const zoom = 0.02 * (8 / 0.02) ** (i / steps) // 0.02 → 8, log-spaced
      const bg = gridBackground(camera(37, -19, zoom))
      // Coarse is always double the fine octave, offsets stay wrapped.
      expect(bg.coarse.sizePx).toBeCloseTo(bg.fine.sizePx * 2, 6)
      const sum = bg.fine.opacity + bg.coarse.opacity
      const max = Math.max(bg.fine.opacity, bg.coarse.opacity)
      // Total ink is constant → no whole-grid brightness pop.
      expect(sum).toBeCloseTo(MAX_OPACITY, 6)
      // The dominant line never dims below half strength → the grid never blinks at a boundary.
      expect(max).toBeGreaterThanOrEqual(MAX_OPACITY / 2 - 1e-9)
      samples.push({ max, sum })
    }
    // No abrupt jump in the dominant-line opacity between adjacent (close) zoom samples.
    for (let i = 1; i < samples.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: indices are in-range by construction
      expect(Math.abs(samples[i]!.max - samples[i - 1]!.max)).toBeLessThan(0.1)
    }
  })
})
