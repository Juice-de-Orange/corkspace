import { worldToEntryLocal } from '@corkspace/engine'
import type { AnchorSnapshot } from './pick-entry'

/** Freehand commit: a single-point tap becomes a tiny 2-point dot, because perfect-freehand needs
 *  at least two points to produce an outline. Multi-point strokes pass through unchanged. */
export function freehandPoints(points: number[][]): number[][] {
  const first = points[0]
  return points.length === 1 && first
    ? [first, [(first[0] ?? 0) + 0.01, (first[1] ?? 0) + 0.01]]
    : points
}

/** Map world points to the points to STORE: entry-local when the stroke is anchored to an entry
 *  (so it survives the entry's move/rotate/resize), or the world points unchanged otherwise. */
export function toStoredPoints(worldPts: number[][], anchor: AnchorSnapshot | null): number[][] {
  if (!anchor) {
    return worldPts
  }
  return worldPts.map((p) => {
    const l = worldToEntryLocal({ x: p[0] ?? 0, y: p[1] ?? 0 }, anchor.rect, anchor.rotation)
    return [l.x, l.y]
  })
}

/** A shape drag is worth committing only if it spans at least 2 screen px; smaller drags are
 *  accidental taps (and a 2-point degenerate shape must never reach perfect-freehand). */
export function isShapeCommittable(start: number[], end: number[], zoom: number): boolean {
  const dx = (end[0] ?? 0) - (start[0] ?? 0)
  const dy = (end[1] ?? 0) - (start[1] ?? 0)
  return Math.hypot(dx, dy) >= 2 / zoom
}
