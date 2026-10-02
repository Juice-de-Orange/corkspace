import {
  anchorOn,
  clampZoom,
  isShapeTool,
  type PanDirection,
  type ShapeTool,
  screenToWorld,
  worldToEntryLocal,
} from '@corkspace/engine'
import { screenPoint } from '@corkspace/shared'
import { type RefObject, useEffect } from 'react'
import { createConnectionCommand } from '../../commands/connection-commands'
import { moveEntryCommand } from '../../commands/entry-commands'
import { createStrokeCommand, deleteStrokeCommand } from '../../commands/stroke-commands'
import { history } from '../../history/history'
import { isUuid } from '../../lib/uuid'
import { scheduleFrame } from '../runtime/raf'
import { canEdit } from '../state/board-store'
import {
  applyArrowPan,
  applyPan,
  applyWheelZoom,
  applyZoomAround,
  getCamera,
} from '../state/camera-store'
import {
  connectAnchorAtom,
  connectDragAtom,
  connectHoverTargetAtom,
  connectionExists,
  connectSourceAnchorAtom,
  connectToolAtom,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from '../state/connection-store'
import { editingEntryIdAtom } from '../state/editor-state'
import { entriesAtom, upsertEntry } from '../state/entry-store'
import { selectedEntryIdAtom } from '../state/selection-state'
import {
  drawToolAtom,
  liveStrokeAtom,
  penColorAtom,
  penWidthAtom,
  sizeForTool,
  strokesAtom,
} from '../state/stroke-store'
import { canCreateConnection } from './connect-logic'
import {
  DRAG_THRESHOLD,
  dragWorldPos,
  eraseReach,
  MOVE_COMMIT_PX,
  type PinchState,
  pinchStep,
} from './gesture-math'
import { type AnchorSnapshot, anchorSnapshot, pickTopmostEntryAt } from './pick-entry'
import { freehandPoints, isShapeCommittable, toStoredPoints } from './stroke-commit'
import { strokeHit } from './stroke-hit'

const ARROW: Record<string, PanDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function isUiTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el?.closest('button, input, textarea, a, select, [data-no-pan]')
}

/** Floating chrome (toolbars, panels, dialogs) — the only thing that blocks a DRAW gesture.
 *  Board content (entries, frames, threads) never swallows the pen: while a draw tool is armed
 *  the world is pointer-events:none, so you can draw anywhere. */
function isChromeTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el?.closest('[data-ui-chrome]')
}

function entryIdAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  return el?.closest('[data-entry-id]')?.getAttribute('data-entry-id') ?? null
}

/** Topmost persisted (uuid) entry under a world point → its anchor snapshot; temp (pre-save)
 *  entries can't anchor a stroke (the server needs a real id). */
function topmostEntryAt(w: { x: number; y: number }): AnchorSnapshot | null {
  return anchorSnapshot(pickTopmostEntryAt(entriesAtom.value.values(), w, (e) => isUuid(e.id)))
}

interface EntryDrag {
  id: string
  el: HTMLElement
  startX: number
  startY: number
  pointerStartX: number
  pointerStartY: number
  active: boolean
}

/** Pan, entry drag-to-move, wheel zoom-to-cursor, arrow pan, pinch/two-finger, draw, erase, connect. */
export function usePointerInput(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const pointers = new Map<number, { x: number; y: number }>()
    let panning = false
    let panMoved = false
    let emptyClickCandidate = false
    let pinchPrev: PinchState | null = null
    let drag: EntryDrag | null = null
    let draw: {
      points: number[][]
      color: string
      size: number
      tool: 'pen' | 'marker'
      anchor: AnchorSnapshot | null
    } | null = null
    let shape: {
      start: number[]
      end: number[]
      color: string
      size: number
      tool: ShapeTool
      anchor: AnchorSnapshot | null
    } | null = null
    let erasing = false
    const erasedIds = new Set<string>()
    let dragPending: { id: string; x: number; y: number } | null = null
    let connectPress: { fromId: string; x0: number; y0: number; moved: boolean } | null = null

    const flushDragPos = (): void => {
      if (!dragPending) {
        return
      }
      const meta = entriesAtom.value.get(dragPending.id)
      if (meta) {
        upsertEntry({ ...meta, x: dragPending.x, y: dragPending.y })
      }
      dragPending = null
    }

    const localPoint = (clientX: number, clientY: number) => {
      const rect = root.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }
    const worldPoint = (clientX: number, clientY: number) => {
      const p = localPoint(clientX, clientY)
      return screenToWorld(screenPoint(p.x, p.y), getCamera())
    }

    const eraseAt = (clientX: number, clientY: number): void => {
      const w = worldPoint(clientX, clientY)
      const reach = eraseReach(getCamera().zoom)
      for (const s of strokesAtom.value.values()) {
        if (erasedIds.has(s.id)) {
          continue
        }
        let q: { x: number; y: number } = w
        if (s.entryId) {
          const e = entriesAtom.value.get(s.entryId)
          if (!e) {
            continue
          }
          // Entry strokes are stored in entry-local space; rotation is rigid, so the reach holds.
          q = worldToEntryLocal(w, { x: e.x, y: e.y, w: e.w, h: e.h }, e.rotation)
        }
        if (strokeHit(s, q.x, q.y, reach + s.size / 2)) {
          erasedIds.add(s.id)
          void history.execute(deleteStrokeCommand(s))
        }
      }
    }

    /** Docking cue: nearest-edge point of `entryId` in the pointer's direction, in screen px. */
    const setConnectAnchor = (entryId: string | null, toward: { x: number; y: number }): void => {
      const meta = entryId ? entriesAtom.value.get(entryId) : undefined
      if (!entryId || !meta) {
        if (connectAnchorAtom.value) {
          connectAnchorAtom.set(null)
        }
        return
      }
      const a = anchorOn({ x: meta.x, y: meta.y, w: meta.w, h: meta.h }, toward)
      // Store WORLD coords; the badge re-projects to screen each frame so it never drifts on zoom.
      connectAnchorAtom.set({ entryId, wx: a.point.x, wy: a.point.y })
    }

    const cancelEntryDrag = (): void => {
      if (drag) {
        drag.el.style.left = `${drag.startX}px`
        drag.el.style.top = `${drag.startY}px`
        const meta = entriesAtom.value.get(drag.id)
        if (meta) {
          upsertEntry({ ...meta, x: drag.startX, y: drag.startY })
        }
        drag = null
        dragPending = null
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (isChromeTarget(e.target)) {
        return
      }

      // A second finger down abandons any entry drag/draw and hands off to pan/pinch (touch).
      if (pointers.size >= 1 && (drag || draw || shape)) {
        cancelEntryDrag()
        if (draw || shape) {
          liveStrokeAtom.set(null)
          draw = null
          shape = null
        }
      }

      const tool = drawToolAtom.value

      if (tool === 'eraser') {
        root.setPointerCapture(e.pointerId)
        erasing = true
        erasedIds.clear()
        eraseAt(e.clientX, e.clientY)
        return
      }
      if (tool === 'pen' || tool === 'marker') {
        const w = worldPoint(e.clientX, e.clientY)
        draw = {
          points: [[w.x, w.y]],
          color: penColorAtom.value,
          // World width = picked width ÷ zoom, so the ink is always pen-sized ON SCREEN while
          // drawing (the entries' reference÷zoom law) — not a hairline when zoomed out.
          size: sizeForTool(tool, penWidthAtom.value) / getCamera().zoom,
          tool,
          // Starting over an entry anchors the stroke to it → it moves/rotates with the entry.
          anchor: topmostEntryAt(w),
        }
        liveStrokeAtom.set({ points: draw.points, color: draw.color, size: draw.size, tool })
        root.setPointerCapture(e.pointerId)
        return
      }
      if (tool && isShapeTool(tool)) {
        const w = worldPoint(e.clientX, e.clientY)
        shape = {
          start: [w.x, w.y],
          end: [w.x, w.y],
          color: penColorAtom.value,
          size: sizeForTool(tool, penWidthAtom.value) / getCamera().zoom,
          tool,
          anchor: topmostEntryAt(w),
        }
        liveStrokeAtom.set({
          points: [shape.start, shape.end],
          color: shape.color,
          size: shape.size,
          tool,
        })
        root.setPointerCapture(e.pointerId)
        return
      }

      // Interactive board content (inputs, links, handles) blocks only the NON-draw gestures.
      if (isUiTarget(e.target)) {
        return
      }

      const entryEl = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-entry-id]')

      // Connect tool: click docks the source (pinned edge point), a second click on another
      // entry creates the thread — or press-drag-release in one gesture.
      if (connectToolAtom.value && entryEl) {
        const id = entryEl.dataset.entryId
        if (id) {
          const pending = pendingConnectFromAtom.value
          if (!pending) {
            pendingConnectFromAtom.set(id)
            const meta = entriesAtom.value.get(id)
            if (meta) {
              const a = anchorOn(
                { x: meta.x, y: meta.y, w: meta.w, h: meta.h },
                worldPoint(e.clientX, e.clientY),
              )
              connectSourceAnchorAtom.set({ entryId: id, wx: a.point.x, wy: a.point.y })
            }
            connectPress = { fromId: id, x0: e.clientX, y0: e.clientY, moved: false }
            root.setPointerCapture(e.pointerId)
          } else if (pending !== id) {
            if (canCreateConnection(pending, id, connectionExists)) {
              void history.execute(createConnectionCommand(pending, id))
            }
            pendingConnectFromAtom.set(null)
            connectDragAtom.set(null)
            connectHoverTargetAtom.set(null)
            connectSourceAnchorAtom.set(null)
          } else {
            pendingConnectFromAtom.set(null)
            connectDragAtom.set(null)
            connectSourceAnchorAtom.set(null)
          }
        }
        return
      }

      if (entryEl) {
        const id = entryEl.dataset.entryId
        const meta = id ? entriesAtom.value.get(id) : undefined
        if (id) {
          selectedEntryIdAtom.set(id)
          selectedConnectionIdAtom.set(null)
        }
        if (id && meta && editingEntryIdAtom.value !== id && canEdit()) {
          drag = {
            id,
            el: entryEl,
            startX: meta.x,
            startY: meta.y,
            pointerStartX: e.clientX,
            pointerStartY: e.clientY,
            active: false,
          }
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }) // enable pinch handoff (D5)
        }
        return // entries handle their own click/dblclick; drag begins only past the threshold
      }

      // Empty space → pan (and track a click candidate to deselect on a clean click).
      setConnectAnchor(null, { x: 0, y: 0 }) // a stale docking badge must not survive a pan
      root.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      panning = pointers.size === 1
      if (pointers.size === 1) {
        emptyClickCandidate = true
        panMoved = false
      }
      if (pointers.size === 2) {
        pinchPrev = null
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      // Drag-connect: preview thread + drop-target highlight + docking badge while held.
      if (connectPress) {
        if (!connectPress.moved) {
          if (
            Math.hypot(e.clientX - connectPress.x0, e.clientY - connectPress.y0) < DRAG_THRESHOLD
          ) {
            return
          }
          connectPress.moved = true
        }
        const w = worldPoint(e.clientX, e.clientY)
        connectDragAtom.set({ fromId: connectPress.fromId, x: w.x, y: w.y })
        const tgt = entryIdAt(e.clientX, e.clientY)
        const target = tgt && tgt !== connectPress.fromId ? tgt : null
        connectHoverTargetAtom.set(target)
        setConnectAnchor(target, w)
        return
      }

      // Connect tool, button up: click-click preview keeps following; hovering any entry shows
      // the nearest-edge docking badge (the "hier andocken" cue). While a source is docked, the
      // moving badge only appears on OTHER entries (the source shows the pinned badge).
      if (connectToolAtom.value && e.buttons === 0) {
        const w = worldPoint(e.clientX, e.clientY)
        const pending = pendingConnectFromAtom.value
        const hoverId = entryIdAt(e.clientX, e.clientY)
        if (pending) {
          connectDragAtom.set({ fromId: pending, x: w.x, y: w.y })
          connectHoverTargetAtom.set(hoverId && hoverId !== pending ? hoverId : null)
        }
        setConnectAnchor(pending && hoverId === pending ? null : hoverId, w)
        return
      }

      if (erasing) {
        eraseAt(e.clientX, e.clientY)
        return
      }
      if (draw) {
        const w = worldPoint(e.clientX, e.clientY)
        draw.points.push([w.x, w.y])
        liveStrokeAtom.set({
          points: [...draw.points],
          color: draw.color,
          size: draw.size,
          tool: draw.tool,
        })
        return
      }
      if (shape) {
        const w = worldPoint(e.clientX, e.clientY)
        shape.end = [w.x, w.y]
        liveStrokeAtom.set({
          points: [shape.start, shape.end],
          color: shape.color,
          size: shape.size,
          tool: shape.tool,
        })
        return
      }
      if (drag) {
        const dx = e.clientX - drag.pointerStartX
        const dy = e.clientY - drag.pointerStartY
        if (!drag.active) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
            return
          }
          drag.active = true
          root.setPointerCapture(e.pointerId)
        }
        const to = dragWorldPos(
          { x: drag.startX, y: drag.startY },
          { x: drag.pointerStartX, y: drag.pointerStartY },
          { x: e.clientX, y: e.clientY },
          getCamera().zoom,
        )
        drag.el.style.left = `${to.x}px`
        drag.el.style.top = `${to.y}px`
        // Update the store (throttled to rAF) so threads/selection/tags/collision follow the drag.
        dragPending = { id: drag.id, x: to.x, y: to.y }
        scheduleFrame(flushDragPos)
        return
      }

      const prev = pointers.get(e.pointerId)
      if (!prev) {
        return
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.size === 1 && panning) {
        panMoved = true
        emptyClickCandidate = false
        applyPan(e.clientX - prev.x, e.clientY - prev.y)
        return
      }

      if (pointers.size === 2) {
        emptyClickCandidate = false
        const [a, b] = [...pointers.values()]
        if (!a || !b) {
          return
        }
        const { next, action } = pinchStep(
          pinchPrev,
          localPoint(a.x, a.y),
          localPoint(b.x, b.y),
          getCamera().zoom,
        )
        if (action) {
          applyPan(action.panDx, action.panDy)
          if (action.zoom !== null) {
            applyZoomAround(action.midX, action.midY, clampZoom(action.zoom))
          }
        }
        pinchPrev = next
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (erasing) {
        erasing = false
        erasedIds.clear()
        if (root.hasPointerCapture(e.pointerId)) {
          root.releasePointerCapture(e.pointerId)
        }
        return
      }
      if (draw) {
        if (root.hasPointerCapture(e.pointerId)) {
          root.releasePointerCapture(e.pointerId)
        }
        const committed = draw
        draw = null
        liveStrokeAtom.set(null)
        if (committed.points.length >= 1) {
          // A tap (single point) becomes a dot; anchored strokes store entry-local points.
          const stored = toStoredPoints(freehandPoints(committed.points), committed.anchor)
          void history.execute(
            createStrokeCommand({
              entryId: committed.anchor?.id ?? null,
              points: stored,
              color: committed.color,
              size: committed.size,
              tool: committed.tool,
            }),
          )
        }
        return
      }
      if (shape) {
        if (root.hasPointerCapture(e.pointerId)) {
          root.releasePointerCapture(e.pointerId)
        }
        const committed = shape
        shape = null
        liveStrokeAtom.set(null)
        // Sub-2-screen-px drags are accidental taps — no degenerate shape rows.
        if (isShapeCommittable(committed.start, committed.end, getCamera().zoom)) {
          const stored = toStoredPoints([committed.start, committed.end], committed.anchor)
          void history.execute(
            createStrokeCommand({
              entryId: committed.anchor?.id ?? null,
              points: stored,
              color: committed.color,
              size: committed.size,
              tool: committed.tool,
            }),
          )
        }
        return
      }
      if (connectPress) {
        if (root.hasPointerCapture(e.pointerId)) {
          root.releasePointerCapture(e.pointerId)
        }
        const press = connectPress
        connectPress = null
        if (press.moved) {
          const tgt = entryIdAt(e.clientX, e.clientY)
          if (tgt && tgt !== press.fromId && isUuid(press.fromId) && isUuid(tgt)) {
            if (canCreateConnection(press.fromId, tgt, connectionExists)) {
              void history.execute(createConnectionCommand(press.fromId, tgt))
            }
            pendingConnectFromAtom.set(null)
            connectHoverTargetAtom.set(null)
            connectSourceAnchorAtom.set(null)
            setConnectAnchor(null, { x: 0, y: 0 })
          }
          // Released over empty board: the source stays docked — a follow-up click connects.
          connectDragAtom.set(null)
        }
        return
      }
      if (drag) {
        flushDragPos()
        const zoom = getCamera().zoom
        const net = Math.hypot(e.clientX - drag.pointerStartX, e.clientY - drag.pointerStartY)
        const meta = entriesAtom.value.get(drag.id)
        if (drag.active && net >= MOVE_COMMIT_PX && meta) {
          const to = {
            x: drag.startX + (e.clientX - drag.pointerStartX) / zoom,
            y: drag.startY + (e.clientY - drag.pointerStartY) / zoom,
          }
          upsertEntry({ ...meta, x: to.x, y: to.y })
          void history.execute(
            moveEntryCommand(
              { ...meta, x: drag.startX, y: drag.startY },
              { x: drag.startX, y: drag.startY },
              to,
            ),
          )
        } else if (meta) {
          // Below the commit threshold (e.g. a jittery double-click) → snap back, no undo step.
          drag.el.style.left = `${drag.startX}px`
          drag.el.style.top = `${drag.startY}px`
          upsertEntry({ ...meta, x: drag.startX, y: drag.startY })
        }
        if (root.hasPointerCapture(e.pointerId)) {
          root.releasePointerCapture(e.pointerId)
        }
        pointers.delete(e.pointerId)
        drag = null
        return
      }

      const wasCandidate = emptyClickCandidate
      pointers.delete(e.pointerId)
      if (root.hasPointerCapture(e.pointerId)) {
        root.releasePointerCapture(e.pointerId)
      }
      if (pointers.size < 2) {
        pinchPrev = null
      }
      if (pointers.size === 0) {
        panning = false
        // A clean click on empty space (no pan) clears the selection.
        if (wasCandidate && !panMoved) {
          selectedEntryIdAtom.set(null)
          selectedConnectionIdAtom.set(null)
        }
        emptyClickCandidate = false
        panMoved = false
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = localPoint(e.clientX, e.clientY)
      applyWheelZoom(p.x, p.y, e.deltaY)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isUiTarget(e.target)) {
        return
      }
      const dir = ARROW[e.key]
      if (dir) {
        e.preventDefault()
        applyArrowPan(dir)
      }
    }

    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointermove', onPointerMove)
    root.addEventListener('pointerup', onPointerUp)
    root.addEventListener('pointercancel', onPointerUp)
    root.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
      root.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [rootRef])
}
