import { contentBounds, minimapProjection, viewportMarker } from '@corkspace/engine'
import { ENTRY_TYPE_COLOR } from '@corkspace/shared'
import { screenSize, type WorldRect, worldRect } from '@corkspace/shared/kernel'
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { react } from 'signia'
import { useValue } from 'signia-react'
import { useT } from '../../i18n'
import { flyTo } from '../runtime/fly-to'
import { scheduleFrame } from '../runtime/raf'
import { depend } from '../runtime/signal-utils'
import { cameraAtom, viewportAtom } from '../state/camera-store'
import { connectionsAtom } from '../state/connection-store'
import { entriesAtom, entryRect } from '../state/entry-store'
import { framesAtom } from '../state/frame-store'

const W = 190
const PAD = 6
const SVGW = W - PAD * 2
const SVGH = 120
const PADDING = 0.12

// Node caps keep the SVG bounded on very large boards.
const MAX_ENTRIES = 800
const MAX_FRAMES = 200
const MAX_CONNS = 400

// Camera-independent fallback so the projection stays fixed while the board is empty.
const DEFAULT_CONTENT = worldRect(-1000, -1000, 2000, 2000)

/** Minimap: a scaled-down map of the whole board — entry rectangles (sized + typed), frame
 *  outlines, connection threads, and the current viewport marker. Click to fly there.
 *
 *  Camera moves do NOT re-render this component: only the viewport marker depends on the camera
 *  per-frame, and it is updated imperatively via a signia `react()` reactor (see PinnedAnchorBadge).
 *  Everything else (rects, lines, projection) depends on data + a fixed default rect, so it only
 *  re-renders when entries/frames/connections or the viewport size actually change. */
export function Minimap() {
  const t = useT()
  const [open, setOpen] = useState(true)
  const viewport = useValue(viewportAtom)
  const entries = useValue(entriesAtom)
  const frames = useValue(framesAtom)
  const connections = useValue(connectionsAtom)

  // The viewport marker rect is mutated imperatively; keep the latest projection in a ref so the
  // camera reactor can read it without re-subscribing when data (and thus the projection) changes.
  const markerRef = useRef<SVGRectElement>(null)

  // Recompute content bounds only when entries/frames change (not on every camera move).
  const bounds = useMemo<WorldRect | null>(
    () =>
      contentBounds([
        ...[...entries.values()].map(entryRect),
        ...[...frames.values()].map((f) => worldRect(f.x, f.y, f.w, f.h)),
      ]),
    [entries, frames],
  )

  const content = bounds ?? DEFAULT_CONTENT
  const proj = minimapProjection(content, screenSize(SVGW, SVGH), PADDING)
  const projRef = useRef(proj)
  projRef.current = proj

  // Position the viewport marker from the current camera + latest projection. No-op when the marker
  // is unmounted (minimap closed).
  const syncMarker = useCallback((): void => {
    const el = markerRef.current
    if (!el) {
      return
    }
    const marker = viewportMarker(cameraAtom.value, viewportAtom.value, projRef.current)
    el.setAttribute('x', String(Math.max(0, marker.x)))
    el.setAttribute('y', String(Math.max(0, marker.y)))
    el.setAttribute('width', String(Math.max(3, marker.w)))
    el.setAttribute('height', String(Math.max(3, marker.h)))
  }, [])

  // Follow the camera imperatively each frame (no React re-render on pan/zoom). Only while open.
  useEffect(() => {
    if (!open || !markerRef.current) {
      return
    }
    return react('minimap-viewport-marker', () => {
      depend(cameraAtom)
      depend(viewportAtom)
      scheduleFrame(syncMarker)
    })
  }, [open, syncMarker])

  // Re-sync when the projection changes (data moved) even if the camera stayed put.
  useEffect(() => {
    syncMarker()
  })

  if (!open) {
    return (
      <button
        type="button"
        data-export-ignore
        data-ui-chrome
        aria-label={t('boards.minimapShow')}
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', right: 8, top: 8 }}
      >
        🗺 {t('boards.map')}
      </button>
    )
  }

  // Inverse projection origin (see minimapProjection): ox = content.x - content.w * padding.
  const ox = content.x - content.w * PADDING
  const oy = content.y - content.h * PADDING

  const entryRects = [...entries.values()].slice(0, MAX_ENTRIES).map((e) => {
    const r = proj.project(entryRect(e))
    return { id: e.id, r, fill: e.color ?? ENTRY_TYPE_COLOR[e.type] ?? '#8a7f63' }
  })
  const frameRects = [...frames.values()].slice(0, MAX_FRAMES).map((f) => ({
    id: f.id,
    r: proj.project(worldRect(f.x, f.y, f.w, f.h)),
  }))
  const connLines = [...connections.values()]
    .slice(0, MAX_CONNS)
    .map((c) => {
      const from = entries.get(c.fromEntryId)
      const to = entries.get(c.toEntryId)
      if (!from || !to) {
        return null
      }
      const a = proj.project(entryRect(from))
      const b = proj.project(entryRect(to))
      return {
        id: c.id,
        x1: a.x + a.w / 2,
        y1: a.y + a.h / 2,
        x2: b.x + b.w / 2,
        y2: b.y + b.h / 2,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  const jump = (e: ReactMouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const wx = (e.clientX - rect.left) / proj.scale + ox
    const wy = (e.clientY - rect.top) / proj.scale + oy
    const zoom = cameraAtom.value.zoom
    flyTo({ x: viewport.w / 2 - wx * zoom, y: viewport.h / 2 - wy * zoom, zoom })
  }

  return (
    <div
      data-export-ignore
      data-ui-chrome
      className="minimap panel"
      style={{ position: 'absolute', right: 8, top: 8, width: W, padding: PAD }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
          paddingLeft: 2,
        }}
      >
        <span className="panel-title">{t('boards.map')}</span>
        <button
          type="button"
          aria-label={t('boards.minimapHide')}
          onClick={() => setOpen(false)}
          className="btn btn-ghost btn-icon"
          style={{ width: 20, height: 20, padding: 0, fontSize: 13 }}
        >
          ×
        </button>
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: minimap navigation is a mouse affordance; keyboard pan exists via arrow keys */}
      <svg
        width={SVGW}
        height={SVGH}
        role="img"
        aria-label={t('boards.minimapHint')}
        style={{ cursor: 'pointer', display: 'block', borderRadius: 6 }}
        onClick={jump}
      >
        <title>{t('boards.minimapHint')}</title>
        {connLines.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="var(--panel-muted)"
            strokeWidth={0.5}
            opacity={0.35}
          />
        ))}
        {frameRects.map((f) => (
          <rect
            key={f.id}
            x={f.r.x}
            y={f.r.y}
            width={Math.max(2, f.r.w)}
            height={Math.max(2, f.r.h)}
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeOpacity={0.5}
            strokeWidth={0.75}
            strokeDasharray="2 2"
            rx={1}
          />
        ))}
        {entryRects.map((e) => (
          <rect
            key={e.id}
            x={e.r.x}
            y={e.r.y}
            width={Math.max(1.5, e.r.w)}
            height={Math.max(1.5, e.r.h)}
            rx={0.8}
            fill={e.fill}
            opacity={0.9}
          />
        ))}
        <rect
          ref={markerRef}
          x={0}
          y={0}
          width={0}
          height={0}
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          rx={1}
        />
      </svg>
    </div>
  )
}
