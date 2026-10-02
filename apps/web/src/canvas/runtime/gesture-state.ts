import { atom } from 'signia'

/**
 * True while the camera is actively moving (pan / wheel-zoom / pinch / flight). Imperative canvas
 * reactors `depend()` on this to switch between the exact (smooth) and device-pixel-snapped (crisp)
 * world transform, so it never triggers a React re-render of the entry tree.
 *
 * Why: snapping the world translate to whole device pixels keeps STATIC text crisp, but doing it on
 * every frame while `scale` interpolates makes the whole board step by up to 1px per zoom tick on
 * dpr=1 displays (visible flicker). We therefore write the exact fractional translate DURING a
 * gesture and re-snap only once the camera has been still for `IDLE_SNAP_MS`.
 */
export const interactingAtom = atom<boolean>('interacting', false)

/** How long the camera must be still before the world transform re-snaps to the device-pixel grid.
 *  Long enough to clear a wheel-event train (~16-50ms apart), short enough that text sharpens almost
 *  immediately after the gesture ends. */
export const IDLE_SNAP_MS = 140
