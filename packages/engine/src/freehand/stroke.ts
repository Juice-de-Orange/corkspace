import type { Rect } from '@corkspace/shared/kernel'
import getStroke from 'perfect-freehand'

/** Raw input point: [x, y] or [x, y, pressure]. */
export type StrokeInputPoint = readonly number[]

export interface StrokeOptions {
  size: number
  thinning?: number
  smoothing?: number
  streamline?: number
}

// Deterministic defaults — no simulated pressure, so the same input always yields the same outline.
const BASE = { thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: false, last: true }

/** Closed outline polygon for a freehand stroke (vector — crisp at any zoom). */
export function strokeOutline(
  points: ReadonlyArray<StrokeInputPoint>,
  options: StrokeOptions,
): number[][] {
  return getStroke(points as number[][], { ...BASE, ...options })
}

/** SVG path `d` for a filled freehand stroke. */
export function strokePath(
  points: ReadonlyArray<StrokeInputPoint>,
  options: StrokeOptions,
): string {
  const outline = strokeOutline(points, options)
  if (outline.length === 0) {
    return ''
  }
  let d = ''
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i]
    if (!p) {
      continue
    }
    d += i === 0 ? `M ${p[0]} ${p[1]}` : ` L ${p[0]} ${p[1]}`
  }
  return `${d} Z`
}

/** Tight bbox of the raw input points (for the rbush stroke index). */
export function strokeBbox(points: ReadonlyArray<StrokeInputPoint>): Rect {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of points) {
    const x = p[0] ?? 0
    const y = p[1] ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, w: 0, h: 0 }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
