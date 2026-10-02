import type { Vec2 } from '@corkspace/shared/kernel'

export type ShapeTool = 'line' | 'arrow' | 'rect'

export const isShapeTool = (tool: string): tool is ShapeTool =>
  tool === 'line' || tool === 'arrow' || tool === 'rect'

/** SVG path `d` for a straight line segment. */
export const linePath = (a: Vec2, b: Vec2): string => `M ${a.x} ${a.y} L ${b.x} ${b.y}`

/** Closed SVG path for the axis-aligned rectangle spanned by two drag corners (any order). */
export function rectPathFromCorners(a: Vec2, b: Vec2): string {
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`
}

/** Rectangle outline as a closed 5-point polyline (first point repeated) for edge hit-testing. */
export function rectCornersToPolyline(a: Vec2, b: Vec2): number[][] {
  const x0 = Math.min(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]
}

/** Arrow from `a` to `b`: shaft plus a two-stroke open head, one path. The head scales with the
 *  stroke width but never collapses below a legible minimum; a≈b degenerates to the bare shaft. */
export function arrowPath(a: Vec2, b: Vec2, size: number): string {
  const shaft = linePath(a, b)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) {
    return shaft
  }
  const head = Math.max(4 * size, 12)
  const angle = Math.atan2(dy, dx)
  const spread = Math.PI / 6.5 // ~28° per side
  const l = {
    x: b.x - head * Math.cos(angle - spread),
    y: b.y - head * Math.sin(angle - spread),
  }
  const r = {
    x: b.x - head * Math.cos(angle + spread),
    y: b.y - head * Math.sin(angle + spread),
  }
  return `${shaft} M ${l.x} ${l.y} L ${b.x} ${b.y} L ${r.x} ${r.y}`
}
