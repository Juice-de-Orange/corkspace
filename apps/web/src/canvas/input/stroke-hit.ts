import { distancePointToSegment, rectCornersToPolyline } from '@corkspace/engine'
import type { StrokeMeta } from '../state/stroke-store'

/** The polyline to hit-test a stroke against: a `rect` stroke (two drag corners) expands to its
 *  closed 4-edge outline; every other stroke uses its own points. */
export function strokeHitPolyline(s: Pick<StrokeMeta, 'tool' | 'points'>): number[][] {
  const p0 = s.points[0]
  const p1 = s.points[1]
  return s.tool === 'rect' && p0 && p1
    ? rectCornersToPolyline({ x: p0[0] ?? 0, y: p0[1] ?? 0 }, { x: p1[0] ?? 0, y: p1[1] ?? 0 })
    : s.points
}

/** Whether the point (x,y) is within `thr` of the stroke's geometry. The caller supplies the
 *  coordinate space (world for board strokes, entry-local for anchored strokes). Pure. */
export function strokeHit(
  s: Pick<StrokeMeta, 'tool' | 'points'>,
  x: number,
  y: number,
  thr: number,
): boolean {
  const pts = strokeHitPolyline(s)
  if (pts.length === 1) {
    const p = pts[0]
    return !!p && Math.hypot(x - (p[0] ?? 0), y - (p[1] ?? 0)) <= thr
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (
      a &&
      b &&
      distancePointToSegment(
        { x, y },
        { x: a[0] ?? 0, y: a[1] ?? 0 },
        { x: b[0] ?? 0, y: b[1] ?? 0 },
      ) <= thr
    ) {
      return true
    }
  }
  return false
}
