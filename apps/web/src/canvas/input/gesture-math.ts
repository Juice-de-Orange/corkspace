/** Pure pointer-gesture math extracted from `use-pointer-input` (framework-agnostic, unit-tested). */

/** Px of movement before a press becomes a drag (so clicks/dblclicks still fire). */
export const DRAG_THRESHOLD = 4
/** Net px required to commit an entry move (below → treated as a click, no undo step). */
export const MOVE_COMMIT_PX = 5

/** New world position of a dragged entry: its start + the screen delta divided by zoom
 *  (the reference÷zoom law — the entry tracks the pointer 1:1 on screen at any zoom). */
export function dragWorldPos(
  entryStart: { x: number; y: number },
  pointerStart: { x: number; y: number },
  pointerNow: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return {
    x: entryStart.x + (pointerNow.x - pointerStart.x) / zoom,
    y: entryStart.y + (pointerNow.y - pointerStart.y) / zoom,
  }
}

/** Straight-line screen distance between two pointer positions. */
export const pointerDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/** Eraser reach in WORLD units at a given zoom (a constant 12 screen px). */
export const eraseReach = (zoom: number): number => 12 / zoom

export interface PinchState {
  dist: number
  midX: number
  midY: number
}

export interface PinchAction {
  panDx: number
  panDy: number
  /** Zoom centre (same space as the input points). */
  midX: number
  midY: number
  /** Target zoom to apply around the centre, or null when there is no previous sample (or the
   *  previous finger distance was 0). The caller clamps it. */
  zoom: number | null
}

/**
 * One step of a two-finger pinch. Given the previous pinch state and the two current pointer
 * positions (in ONE consistent space, e.g. container-local), returns the pan delta of the pinch
 * midpoint and the target zoom (currentZoom × distance ratio) to apply around that midpoint, plus
 * the next state to carry forward. `action` is null on the first sample. Pure.
 */
export function pinchStep(
  prev: PinchState | null,
  a: { x: number; y: number },
  b: { x: number; y: number },
  currentZoom: number,
): { next: PinchState; action: PinchAction | null } {
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const next: PinchState = { dist, midX, midY }
  if (!prev) {
    return { next, action: null }
  }
  return {
    next,
    action: {
      panDx: midX - prev.midX,
      panDy: midY - prev.midY,
      midX,
      midY,
      zoom: prev.dist > 0 ? currentZoom * (dist / prev.dist) : null,
    },
  }
}
