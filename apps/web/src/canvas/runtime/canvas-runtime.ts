import { collides, type LodLevel, lodWithHysteresis } from '@corkspace/engine'
import type { Camera } from '@corkspace/shared/kernel'
import { atom, react } from 'signia'
import { cameraAtom, viewportAtom } from '../state/camera-store'
import { editingEntryIdAtom } from '../state/editor-state'
import { entriesAtom, spatialIndex } from '../state/entry-store'
import { computeMountSet, setsEqual } from './culling'
import { IDLE_SNAP_MS, interactingAtom } from './gesture-state'
import { scheduleFrame } from './raf'
import { depend } from './signal-utils'

/** Entries currently MOUNTED in React (viewport + overscan ring). Updated only when the
 *  membership actually changes, so a small camera pan triggers no React re-render. */
export const mountSetAtom = atom<ReadonlySet<string>>('mountSet', new Set())

/** id → current LOD bucket. Updated only when some entry's bucket actually changes, so panning
 *  (constant zoom) leaves it untouched and zooming re-renders only entries crossing a threshold. */
export const lodMapAtom = atom<ReadonlyMap<string, LodLevel>>('lodMap', new Map())

/** id → mounted DOM element, for imperative display:none toggling of the overscan ring. */
const registry = new Map<string, HTMLElement>()

const COLLISION_OUTLINE = '2px solid #eab308'

/** Last-computed colliding set. Kept so a DOM node RE-created after the last applyCollisions run
 *  (an LOD block↔full swap, or a fresh mount via pan) can re-apply its outline on register — the
 *  collisions reactor only re-runs on entry-geometry changes, not on camera moves, so otherwise the
 *  fresh node (outline:'') would silently lose its yellow border while still overlapping. */
const collidingIds = new Set<string>()

export function registerEntryEl(id: string, el: HTMLElement | null): void {
  if (el) {
    registry.set(id, el)
    // A fresh node starts with outline:''; restore the collision border immediately if it collides.
    el.style.outline = collidingIds.has(id) ? COLLISION_OUTLINE : ''
  } else {
    registry.delete(id)
  }
}

/**
 * Build the world container's CSS transform. During a gesture we write the EXACT fractional
 * translate so motion is perfectly smooth; when idle we snap the translate to the device-pixel grid
 * so static text stays crisp. The camera atom always keeps the exact value — only the DOM transform
 * is rounded, so there is no drift/accumulation. Pure + exported for unit testing the snap gating.
 */
export function worldTransformString(
  camera: Camera,
  opts: { interacting: boolean; dpr: number },
): string {
  let { x, y } = camera
  if (!opts.interacting) {
    const dpr = opts.dpr || 1
    x = Math.round(x * dpr) / dpr
    y = Math.round(y * dpr) / dpr
  }
  return `translate(${x}px, ${y}px) scale(${camera.zoom})`
}

function applyWorldTransform(worldEl: HTMLElement): void {
  const c = cameraAtom.value
  const interacting = interactingAtom.value
  worldEl.style.transform = worldTransformString(c, {
    interacting,
    dpr: window.devicePixelRatio || 1,
  })
  // Screen-constant sizing for overlays inside the scaled world: an element sized `calc(Npx *
  // var(--px))` renders at a constant N screen px at any zoom (--px = 1/zoom).
  worldEl.style.setProperty('--px', String(1 / c.zoom))
  // While the camera moves, entries render a cheap single-layer shadow and drop their box-shadow
  // transition (one CSS-var flip for all visible entries — see `.canvas-world.is-zooming`), so the
  // scaled layer re-rasters light. Full-fidelity shadow returns at rest.
  worldEl.classList.toggle('is-zooming', interacting)
}

/** Previous frame's zoom, to detect zoom-OUT (viewport growing in world units) and pre-mount the
 *  about-to-be-revealed ring so entries entering the viewport don't blank for a frame. */
let lastCullZoom = 1

function applyCulling(): void {
  const camera = cameraAtom.value
  const viewport = viewportAtom.value
  const ratio = lastCullZoom / camera.zoom // > 1 while zooming out
  lastCullZoom = camera.zoom
  const diag = Math.hypot(viewport.w, viewport.h)
  // Pre-mount the annulus about to be revealed on zoom-out; capped at ~2 viewports so a pathological
  // one-shot zoom jump can't mount an unbounded set in one React pass (normal wheel frames are tiny).
  const extra = ratio > 1 ? Math.min(diag * (ratio - 1), diag * 2) : 0
  const { mount, visible } = computeMountSet(spatialIndex, camera, viewport, undefined, extra)
  if (!setsEqual(mount, mountSetAtom.value)) {
    mountSetAtom.set(mount)
  }
  for (const [id, el] of registry) {
    const display = visible.has(id) ? '' : 'none'
    if (el.style.display !== display) {
      el.style.display = display
    }
  }
}

/** Recompute the colliding set (1px AABB, rbush broad-phase) and paint the yellow border. This is
 *  the SOLE writer of `el.style.outline` (avoids the multi-owner flicker). */
function applyCollisions(): void {
  const entries = entriesAtom.value
  const next = new Set<string>()
  for (const [id, e] of entries) {
    const rect = { x: e.x, y: e.y, w: e.w, h: e.h }
    for (const otherId of spatialIndex.searchRect(rect)) {
      if (otherId === id) {
        continue
      }
      const o = entries.get(otherId)
      if (o && collides(rect, { x: o.x, y: o.y, w: o.w, h: o.h })) {
        next.add(id)
        next.add(otherId)
      }
    }
  }
  for (const [id, el] of registry) {
    const outline = next.has(id) ? COLLISION_OUTLINE : ''
    if (el.style.outline !== outline) {
      el.style.outline = outline
    }
  }
  // Remember the set so re-created nodes (LOD swap / pan-in) re-apply the border on register.
  collidingIds.clear()
  for (const id of next) {
    collidingIds.add(id)
  }
}

function applyLod(): void {
  const zoom = cameraAtom.value.zoom
  const entries = entriesAtom.value
  const editingId = editingEntryIdAtom.value
  const prev = lodMapAtom.value
  const next = new Map<string, LodLevel>()
  for (const id of mountSetAtom.value) {
    const e = entries.get(id)
    if (!e) {
      continue
    }
    if (id === editingId) {
      // Never drop the entry being edited to a lighter tier — the live editor must stay mounted.
      next.set(id, 'full')
      continue
    }
    const longEdge = Math.max(e.w, e.h) * zoom
    next.set(id, lodWithHysteresis(prev.get(id) ?? 'full', longEdge))
  }
  let changed = next.size !== prev.size
  if (!changed) {
    for (const [id, lod] of next) {
      if (prev.get(id) !== lod) {
        changed = true
        break
      }
    }
  }
  if (changed) {
    lodMapAtom.set(next)
  }
}

/**
 * Drive the board imperatively: a single signia reactor subscribes to camera/viewport/entries
 * and, per rAF, writes the world transform and recomputes culling. The React entry tree is
 * NOT re-rendered on camera move.
 */
export function startCanvasRuntime(worldEl: HTMLElement): () => void {
  const frame = (): void => {
    applyWorldTransform(worldEl)
    applyCulling()
    applyLod()
  }
  const stopMain = react('canvas-runtime', () => {
    depend(cameraAtom)
    depend(viewportAtom)
    depend(entriesAtom)
    depend(editingEntryIdAtom)
    // Re-run (and thus re-snap the transform) when the gesture settles.
    depend(interactingAtom)
    scheduleFrame(frame)
  })
  // Mark the camera as actively moving on any camera change and re-snap once it has been still for
  // IDLE_SNAP_MS. Depends ONLY on cameraAtom so entry/viewport edits while idle stay crisp. Setting
  // interactingAtom to its current value is a signia no-op, so a continuous gesture doesn't churn.
  // The flip is deferred to a microtask: signia forbids setting an atom while a reaction runs, and
  // a camera change on an idle board (every fly-to starts from idle) would otherwise throw inside
  // the caller — which ended flights after their first frame.
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const stopGesture = react('camera-gesture', () => {
    depend(cameraAtom)
    queueMicrotask(() => interactingAtom.set(true))
    if (idleTimer) {
      clearTimeout(idleTimer)
    }
    idleTimer = setTimeout(() => interactingAtom.set(false), IDLE_SNAP_MS)
  })
  // Collisions depend only on entry geometry — recompute when entries change, not on camera move.
  const stopCollisions = react('collisions', () => {
    depend(entriesAtom)
    scheduleFrame(applyCollisions)
  })
  return () => {
    stopMain()
    stopGesture()
    stopCollisions()
    if (idleTimer) {
      clearTimeout(idleTimer)
    }
    interactingAtom.set(false)
  }
}
