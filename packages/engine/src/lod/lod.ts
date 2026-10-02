import type { WorldSize } from '@corkspace/shared/kernel'
import { LOD_THRESHOLDS } from '@corkspace/shared/kernel'

export type LodLevel = 'full' | 'preview' | 'block'
export interface LodThresholds {
  fullPx: number
  previewPx: number
}

/** On-screen length (px) of an entry's longer edge at a given zoom. */
export const onScreenLongEdge = (world: WorldSize, zoom: number): number =>
  Math.max(world.w, world.h) * zoom

/** Bucket by on-screen long edge: `>= fullPx` → full, `>= previewPx` → preview, else block. */
export function lodForOnScreenLongEdge(
  longEdgePx: number,
  thresholds: LodThresholds = LOD_THRESHOLDS,
): LodLevel {
  if (longEdgePx >= thresholds.fullPx) {
    return 'full'
  }
  if (longEdgePx >= thresholds.previewPx) {
    return 'preview'
  }
  return 'block'
}

export const lodForEntry = (
  world: WorldSize,
  zoom: number,
  thresholds: LodThresholds = LOD_THRESHOLDS,
): LodLevel => lodForOnScreenLongEdge(onScreenLongEdge(world, zoom), thresholds)

/**
 * Hysteretic LOD: an entry only changes bucket once it crosses the threshold by `band`
 * (fractional margin), preventing re-render flicker when hovering a boundary while zooming.
 */
export function lodWithHysteresis(
  prev: LodLevel,
  longEdgePx: number,
  thresholds: LodThresholds = LOD_THRESHOLDS,
  band = 0.12,
): LodLevel {
  const fullUp = thresholds.fullPx * (1 + band)
  const fullDown = thresholds.fullPx * (1 - band)
  const prevUp = thresholds.previewPx * (1 + band)
  const prevDown = thresholds.previewPx * (1 - band)

  switch (prev) {
    case 'full':
      return longEdgePx < fullDown ? lodForOnScreenLongEdge(longEdgePx, thresholds) : 'full'
    case 'block':
      return longEdgePx > prevUp ? lodForOnScreenLongEdge(longEdgePx, thresholds) : 'block'
    case 'preview':
      if (longEdgePx >= fullUp) {
        return 'full'
      }
      if (longEdgePx < prevDown) {
        return 'block'
      }
      return 'preview'
  }
}
