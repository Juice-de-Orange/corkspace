import { describe, expect, it } from 'vitest'
import {
  ACCENT,
  ENTRY_TYPES,
  FONTS,
  IMAGE_LONG_EDGE_CAP,
  LOD_THRESHOLDS,
  MAX_TILT_DEG,
  REFERENCE_SIZES,
  STICKY_COLORS,
  VERSION_RETENTION,
  ZOOM,
} from './constants'

describe('product constants (spec §4 / §8 defaults)', () => {
  it('pins the Majorelle accent colour', () => {
    expect(ACCENT).toBe('#6050DC')
  })

  it('pins the zoom default and galaxy-feel bounds', () => {
    expect(ZOOM).toEqual({ default: 1, min: 0.02, max: 8 })
  })

  it('pins the reference on-screen sizes at zoom 1.0', () => {
    expect(REFERENCE_SIZES.sticky).toEqual({ w: 240, h: 240 })
    expect(REFERENCE_SIZES.doc).toEqual({ w: 400, h: 520 })
    expect(REFERENCE_SIZES.checklist).toEqual({ w: 320, h: 420 })
    expect(REFERENCE_SIZES.link).toEqual({ w: 320, h: 120 })
  })

  it('caps the image long edge at 800px', () => {
    expect(IMAGE_LONG_EDGE_CAP).toBe(800)
  })

  it('lists the six sticky colours', () => {
    expect(STICKY_COLORS).toEqual(['yellow', 'pink', 'blue', 'green', 'orange', 'purple'])
  })

  it('lists the five entry types', () => {
    expect(ENTRY_TYPES).toEqual(['sticky', 'doc', 'checklist', 'image', 'link'])
  })

  it('orders LOD thresholds full > preview', () => {
    expect(LOD_THRESHOLDS.fullPx).toBeGreaterThan(LOD_THRESHOLDS.previewPx)
  })

  it('retains the last 20 versions and tilts up to ±4°', () => {
    expect(VERSION_RETENTION).toBe(20)
    expect(MAX_TILT_DEG).toBe(4)
  })

  it('names the four curated fonts', () => {
    expect(FONTS).toEqual({
      serif: 'Source Serif 4',
      sans: 'Inter',
      mono: 'JetBrains Mono',
      hand: 'Caveat',
    })
  })
})
