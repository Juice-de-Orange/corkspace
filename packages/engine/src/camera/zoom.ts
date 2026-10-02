import type { Camera, ScreenPoint } from '@corkspace/shared/kernel'
import { clampZoom } from '../math/clamp'
import { screenToWorld } from './convert'

/**
 * Change zoom while keeping the world point currently under `cursor` fixed on screen.
 * Derivation: we need `worldToScreen(worldUnderCursor, next) === cursor`, i.e.
 * `cursor = next.{x,y} + worldUnderCursor * zoom` → `next.{x,y} = cursor - worldUnderCursor * zoom`.
 */
export function zoomToCursor(c: Camera, cursor: ScreenPoint, nextZoom: number): Camera {
  const zoom = clampZoom(nextZoom)
  const worldUnderCursor = screenToWorld(cursor, c)
  return {
    x: cursor.x - worldUnderCursor.x * zoom,
    y: cursor.y - worldUnderCursor.y * zoom,
    zoom,
  }
}

/** Convert a wheel deltaY into a smooth multiplicative zoom (clamped to bounds). */
export function wheelToZoom(currentZoom: number, deltaY: number, intensity = 0.0015): number {
  return clampZoom(currentZoom * Math.exp(-deltaY * intensity))
}

export { clampZoom }
