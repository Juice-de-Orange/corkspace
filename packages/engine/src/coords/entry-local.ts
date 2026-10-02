import type { Rect, Vec2 } from '@corkspace/shared/kernel'

/** Entries rotate about their centre (CSS default origin); `rect` is the unrotated frame.
 *  "Entry-local" = the entry's own unrotated frame with the origin at its top-left corner,
 *  so anchored strokes survive moves (translation-free), rotations (stored pre-rotation) and
 *  top-left-fixed resizes. */

const rad = (deg: number): number => (deg * Math.PI) / 180

/** World point → entry-local point. */
export function worldToEntryLocal(p: Vec2, rect: Rect, rotationDeg: number): Vec2 {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const cos = Math.cos(-rad(rotationDeg))
  const sin = Math.sin(-rad(rotationDeg))
  const dx = p.x - cx
  const dy = p.y - cy
  return {
    x: dx * cos - dy * sin + rect.w / 2,
    y: dx * sin + dy * cos + rect.h / 2,
  }
}

/** Entry-local point → world point (inverse of `worldToEntryLocal`). */
export function entryLocalToWorld(p: Vec2, rect: Rect, rotationDeg: number): Vec2 {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const cos = Math.cos(rad(rotationDeg))
  const sin = Math.sin(rad(rotationDeg))
  const dx = p.x - rect.w / 2
  const dy = p.y - rect.h / 2
  return {
    x: dx * cos - dy * sin + cx,
    y: dx * sin + dy * cos + cy,
  }
}

/** Whether a world point lies inside the rotated entry frame. */
export function pointInRotatedRect(p: Vec2, rect: Rect, rotationDeg: number): boolean {
  const local = worldToEntryLocal(p, rect, rotationDeg)
  return local.x >= 0 && local.x <= rect.w && local.y >= 0 && local.y <= rect.h
}

/** Distance from a point to a line segment (same space for all three points). */
export function distancePointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
