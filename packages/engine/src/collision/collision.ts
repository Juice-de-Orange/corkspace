import type { Rect } from '@corkspace/shared/kernel'
import { COLLISION_PX } from '@corkspace/shared/kernel'

/** Overlap length (px) on each axis; negative means a gap on that axis. */
export function overlapAmount(a: Rect, b: Rect): { x: number; y: number } {
  return {
    x: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    y: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  }
}

/** True when two rects overlap by at least `minPx` on BOTH axes (1px AABB collision). */
export function collides(a: Rect, b: Rect, minPx: number = COLLISION_PX): boolean {
  const o = overlapAmount(a, b)
  return o.x >= minPx && o.y >= minPx
}

/** Ids of candidate rects that collide with `rect` (excluding `selfId`). Feed candidates from a
 *  broad-phase query (rbush) to keep this O(candidates). */
export function collidingIds(
  rect: Rect,
  candidates: ReadonlyArray<{ id: string; rect: Rect }>,
  selfId?: string,
  minPx: number = COLLISION_PX,
): string[] {
  const hits: string[] = []
  for (const c of candidates) {
    if (c.id !== selfId && collides(rect, c.rect, minPx)) {
      hits.push(c.id)
    }
  }
  return hits
}
