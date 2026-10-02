import type {
  Camera,
  ScreenPoint,
  ScreenSize,
  WorldPoint,
  WorldRect,
  WorldSize,
} from '@corkspace/shared/kernel'
import { screenPoint, screenSize, worldPoint, worldRect, worldSize } from '@corkspace/shared/kernel'

/**
 * The single tested boundary that converts between World and Screen coordinate spaces.
 * Model: `screen = camera.{x,y} + zoom * world`  (camera offset is in screen px).
 */
export const worldToScreen = (p: WorldPoint, c: Camera): ScreenPoint =>
  screenPoint(c.x + p.x * c.zoom, c.y + p.y * c.zoom)

export const screenToWorld = (p: ScreenPoint, c: Camera): WorldPoint =>
  worldPoint((p.x - c.x) / c.zoom, (p.y - c.y) / c.zoom)

export const worldSizeToScreen = (s: WorldSize, c: Camera): ScreenSize =>
  screenSize(s.w * c.zoom, s.h * c.zoom)

export const screenSizeToWorld = (s: ScreenSize, c: Camera): WorldSize =>
  worldSize(s.w / c.zoom, s.h / c.zoom)

/** The world-space rectangle currently visible for a screen viewport of `viewport`. */
export function viewportWorldRect(c: Camera, viewport: ScreenSize): WorldRect {
  const topLeft = screenToWorld(screenPoint(0, 0), c)
  return worldRect(topLeft.x, topLeft.y, viewport.w / c.zoom, viewport.h / c.zoom)
}
