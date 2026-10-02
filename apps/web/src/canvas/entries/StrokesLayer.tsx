import {
  arrowPath,
  isShapeTool,
  linePath,
  rectPathFromCorners,
  strokePath,
} from '@corkspace/engine'
import type { ReactNode } from 'react'
import { useValue } from 'signia-react'
import { entriesAtom } from '../state/entry-store'
import { liveStrokeAtom, strokesAtom } from '../state/stroke-store'

/** Shape strokes store [start, end] (rect: two drag corners) and render as stroked geometry. */
function shapeD(tool: string, points: number[][], size: number): string {
  const a = { x: points[0]?.[0] ?? 0, y: points[0]?.[1] ?? 0 }
  const b = { x: points[1]?.[0] ?? a.x, y: points[1]?.[1] ?? a.y }
  if (tool === 'rect') {
    return rectPathFromCorners(a, b)
  }
  if (tool === 'arrow') {
    return arrowPath(a, b, size)
  }
  return linePath(a, b)
}

function strokeNode(
  tool: string,
  points: number[][],
  size: number,
  color: string,
  opacity: number,
): ReactNode {
  if (isShapeTool(tool)) {
    return (
      <path
        d={shapeD(tool, points, size)}
        fill="none"
        stroke={color}
        strokeWidth={size}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    )
  }
  const marker = tool === 'marker'
  return (
    <path
      d={strokePath(points, { size })}
      fill={color}
      opacity={marker ? opacity * 0.4 : opacity}
      className={marker ? 'stroke-marker' : undefined}
    />
  )
}

/** SVG overlay rendering all strokes (vector outlines — crisp at any zoom) plus the in-progress
 *  live stroke. Entry-anchored strokes are stored in entry-local space and render inside a
 *  translated+rotated group so they move with their entry — they render HERE (not inside the
 *  entry DOM, which clips via overflow and unmounts at low LOD). Lifted above entries via
 *  z-index so annotations over notes show; marker strokes render as translucent highlighter. */
export function StrokesLayer() {
  const strokes = useValue(strokesAtom)
  const entries = useValue(entriesAtom)
  const live = useValue(liveStrokeAtom)

  const paths: ReactNode[] = []
  for (const s of strokes.values()) {
    let transform: string | undefined
    if (s.entryId) {
      const e = entries.get(s.entryId)
      if (!e) {
        continue // entry hidden or trashed → its annotations disappear with it
      }
      transform = `translate(${e.x} ${e.y}) rotate(${e.rotation} ${e.w / 2} ${e.h / 2})`
    }
    paths.push(
      <g key={s.id} transform={transform}>
        {strokeNode(s.tool, s.points, s.size, s.color, 1)}
      </g>,
    )
  }
  if (live && live.points.length > 0) {
    paths.push(<g key="live">{strokeNode(live.tool, live.points, live.size, live.color, 0.85)}</g>)
  }

  return (
    <svg
      className="strokes-layer"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        // 1×1, NOT 0×0: Chromium never paints a zero-size svg root — geometry/hit-testing still
        // work, so every count/bbox test passes while the ink is invisible. overflow:visible
        // lets the content paint far outside this token viewport.
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1_400_000,
      }}
    >
      <title>Zeichnungen</title>
      {paths}
    </svg>
  )
}
