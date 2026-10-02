import { ZOOM } from '@corkspace/shared/kernel'

/** Clamp `v` into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp: min (${min}) must be <= max (${max})`)
  }
  if (v < min) return min
  if (v > max) return max
  return v
}

/** Clamp a zoom factor to the product zoom bounds (0.02x – 8x). */
export function clampZoom(zoom: number): number {
  return clamp(zoom, ZOOM.min, ZOOM.max)
}
