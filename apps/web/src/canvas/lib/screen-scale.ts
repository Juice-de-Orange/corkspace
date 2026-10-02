/**
 * Scale a screen-pixel measurement into world units for a zoom-true overlay. `--px` (= 1/zoom, one
 * screen pixel expressed in world units) is written imperatively onto the overlay each camera frame,
 * so `sc(4)` reads as "4 screen pixels wide at any zoom". Shared by the selection, frame and tag
 * overlays (was copied verbatim into each).
 */
export const sc = (n: number): string => `calc(${n}px * var(--px, 1))`

/**
 * Like `sc`, but the base size comes from a CSS custom property (in px) so it can grow on coarse
 * (touch) pointers via a `@media (pointer: coarse)` override. E.g. `scv('--sel-hit')` →
 * `calc(var(--sel-hit) * var(--px, 1))`.
 */
export const scv = (varName: string): string => `calc(var(${varName}) * var(--px, 1))`
