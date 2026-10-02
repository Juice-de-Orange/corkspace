import { anchorOn, bezierPath, bezierPoint, rectCenter, routeConnection } from '@corkspace/engine'
import { type ReactNode, useEffect, useRef } from 'react'
import { react } from 'signia'
import { useValue } from 'signia-react'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { boardAccessAtom } from '../state/board-store'
import { cameraAtom } from '../state/camera-store'
import {
  connectDragAtom,
  connectHoverTargetAtom,
  connectionsAtom,
  connectSourceAnchorAtom,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from '../state/connection-store'
import { type EntryMeta, entriesAtom } from '../state/entry-store'

const rectOf = (e: EntryMeta) => ({ x: e.x, y: e.y, w: e.w, h: e.h })

/** SVG overlay (inside the world container) drawing every red-thread connection as a bézier with
 *  optional arrowheads + a midpoint label, plus the connect-gesture feedback (source/target
 *  highlights, live preview). Threads are clickable (admin) to open the label/arrow/colour editor.
 *
 *  Stroke widths are zoom-true WITHOUT vector-effect="non-scaling-stroke": current Chromium
 *  simply does not paint such paths inside these tiny-viewport overlay svgs (proven on the live
 *  board). Instead `--px` (= 1/zoom — one screen pixel in world units) is written onto the svg
 *  imperatively per camera frame and the stylesheet multiplies all widths by it. */
export function ConnectionsLayer() {
  const svgRef = useRef<SVGSVGElement>(null)
  const conns = useValue(connectionsAtom)
  const entries = useValue(entriesAtom)
  const dragging = useValue(connectDragAtom)
  const access = useValue(boardAccessAtom)
  const selectedId = useValue(selectedConnectionIdAtom)
  const pendingFrom = useValue(pendingConnectFromAtom)
  const hoverTarget = useValue(connectHoverTargetAtom)
  const sourceAnchor = useValue(connectSourceAnchorAtom)
  const canEdit = access?.canEdit ?? false

  useEffect(() => {
    const el = svgRef.current
    if (!el) {
      return
    }
    const frame = (): void => {
      el.style.setProperty('--px', String(1 / cameraAtom.value.zoom))
    }
    return react('connections-px', () => {
      depend(cameraAtom)
      scheduleFrame(frame)
    })
  }, [])

  const items: ReactNode[] = []

  // Connect-gesture highlights: the picked source + the hovered drop target.
  for (const [id, kind] of [
    [pendingFrom, 'from'],
    [hoverTarget, 'target'],
  ] as const) {
    const e = id ? entries.get(id) : undefined
    if (!e) {
      continue
    }
    items.push(
      <rect
        key={`hl-${kind}`}
        className={kind === 'target' ? 'conn-highlight conn-highlight-target' : 'conn-highlight'}
        x={e.x - 4}
        y={e.y - 4}
        width={e.w + 8}
        height={e.h + 8}
        rx={10}
        fill="none"
        stroke="var(--accent)"
        opacity={0.9}
      />,
    )
  }

  for (const c of conns.values()) {
    const from = entries.get(c.fromEntryId)
    const to = entries.get(c.toEntryId)
    if (!from || !to) {
      continue
    }
    // Wool-yarn look: gravity sag + three passes (drop shadow, coloured core, light twist glints).
    const route = routeConnection(rectOf(from), rectOf(to), { sagFactor: 0.1 })
    const d = bezierPath(route)
    const mid = bezierPoint(route, 0.5)
    const selected = c.id === selectedId
    items.push(
      <g key={c.id}>
        {selected && <path className="conn-glow" d={d} fill="none" stroke="var(--accent-ring)" />}
        <path className="conn-shadow" d={d} fill="none" />
        <path
          className="conn-line"
          d={d}
          fill="none"
          stroke={c.color}
          markerEnd={c.arrowEnd ? 'url(#conn-arrow)' : undefined}
          markerStart={c.arrowStart ? 'url(#conn-arrow)' : undefined}
        />
        <path className="conn-twist" d={d} fill="none" />
        {c.label && (
          <text className="conn-label" x={mid.x} y={mid.y} textAnchor="middle">
            {c.label}
          </text>
        )}
        {canEdit && (
          // biome-ignore lint/a11y/noStaticElementInteractions: SVG thread affordance; edited via the connection panel
          <path
            className="conn-hit"
            d={d}
            fill="none"
            stroke="transparent"
            pointerEvents="stroke"
            data-no-pan
            data-connection-id={c.id}
            style={{ cursor: 'pointer' }}
            onClick={() => selectedConnectionIdAtom.set(c.id)}
          />
        )}
      </g>,
    )
  }

  if (dragging) {
    const from = entries.get(dragging.fromId)
    if (from) {
      // Start at the DOCKED point (where the first click landed); snap the end onto the
      // hovered target's edge. Fallback: the source's nearest edge toward the pointer.
      const start =
        sourceAnchor && sourceAnchor.entryId === dragging.fromId
          ? { x: sourceAnchor.wx, y: sourceAnchor.wy }
          : anchorOn(rectOf(from), { x: dragging.x, y: dragging.y }).point
      const target = hoverTarget ? entries.get(hoverTarget) : undefined
      const end = target
        ? anchorOn(rectOf(target), rectCenter(rectOf(from))).point
        : { x: dragging.x, y: dragging.y }
      items.push(
        <line
          key="connect-preview"
          className="connect-preview"
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#6050DC"
        />,
      )
    }
  }

  return (
    <svg
      ref={svgRef}
      className="connections-layer"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        // 1×1, NOT 0×0: Chromium never paints a zero-size svg root (see StrokesLayer).
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1_450_000,
      }}
    >
      <title>Verbindungen</title>
      <defs>
        <marker
          id="conn-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {items}
    </svg>
  )
}
