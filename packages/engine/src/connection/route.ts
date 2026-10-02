import type { Rect, Vec2 } from '@corkspace/shared/kernel'
import { rectCenter } from '../coords/rect'

export interface Anchor {
  point: Vec2
  /** Outward unit normal of the edge the ray exits through. */
  normal: Vec2
}

/** Point where a ray from the rect centre toward `toward` exits the rect, plus the outward
 *  unit normal of the edge it exits through. */
export function anchorOn(rect: Rect, toward: Vec2): Anchor {
  const c = rectCenter(rect)
  const dx = toward.x - c.x
  const dy = toward.y - c.y || (dx === 0 ? 1 : 0)
  const hw = rect.w / 2
  const hh = rect.h / 2
  const sx = dx === 0 ? Number.POSITIVE_INFINITY : hw / Math.abs(dx)
  const sy = dy === 0 ? Number.POSITIVE_INFINITY : hh / Math.abs(dy)
  const s = Math.min(sx, sy)
  const point = { x: c.x + dx * s, y: c.y + dy * s }
  const normal = sx <= sy ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
  return { point, normal }
}

export interface BezierRoute {
  a1: Vec2
  c1: Vec2
  c2: Vec2
  a2: Vec2
}

export interface RouteOptions {
  /** Gravity for a hanging-yarn look: both control points drop by `min(90, dist * sagFactor)`
   *  world units. 0 (default) keeps the classic straight routing. */
  sagFactor?: number
}

/** Route a connection between two rects as a cubic bézier that leaves each box along its edge
 *  normal (so the thread visibly exits the nearest edge), optionally sagging like real yarn. */
export function routeConnection(from: Rect, to: Rect, opts: RouteOptions = {}): BezierRoute {
  const af = anchorOn(from, rectCenter(to))
  const at = anchorOn(to, rectCenter(from))
  const dist = Math.hypot(at.point.x - af.point.x, at.point.y - af.point.y)
  const k = Math.max(40, Math.min(200, dist * 0.4))
  const sag = Math.min(90, dist * (opts.sagFactor ?? 0))
  return {
    a1: af.point,
    c1: { x: af.point.x + af.normal.x * k, y: af.point.y + af.normal.y * k + sag },
    c2: { x: at.point.x + at.normal.x * k, y: at.point.y + at.normal.y * k + sag },
    a2: at.point,
  }
}

export const bezierPath = (r: BezierRoute): string =>
  `M ${r.a1.x} ${r.a1.y} C ${r.c1.x} ${r.c1.y} ${r.c2.x} ${r.c2.y} ${r.a2.x} ${r.a2.y}`

/** Cubic bézier point at parameter t∈[0,1] (label/arrowhead placement). */
export function bezierPoint(r: BezierRoute, t: number): Vec2 {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * r.a1.x + w1 * r.c1.x + w2 * r.c2.x + w3 * r.a2.x,
    y: w0 * r.a1.y + w1 * r.c1.y + w2 * r.c2.y + w3 * r.a2.y,
  }
}
