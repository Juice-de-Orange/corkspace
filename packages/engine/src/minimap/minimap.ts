import type { Camera, Rect, ScreenSize, WorldRect } from '@corkspace/shared/kernel'
import { worldRect } from '@corkspace/shared/kernel'
import { viewportWorldRect } from '../camera/convert'

/** Bounding rect of all content (null when empty). */
export function contentBounds(rects: readonly WorldRect[]): WorldRect | null {
  if (rects.length === 0) {
    return null
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return worldRect(minX, minY, maxX - minX, maxY - minY)
}

export interface MinimapProjection {
  scale: number
  project: (r: WorldRect) => Rect
}

/** Uniform projection of world content into a minimap of `minimap` px (with fractional padding). */
export function minimapProjection(
  content: WorldRect,
  minimap: ScreenSize,
  padding = 0.1,
): MinimapProjection {
  const padW = content.w * padding
  const padH = content.h * padding
  const contentW = content.w + padW * 2 || 1
  const contentH = content.h + padH * 2 || 1
  const ox = content.x - padW
  const oy = content.y - padH
  const scale = Math.min(minimap.w / contentW, minimap.h / contentH)
  const project = (r: WorldRect): Rect => ({
    x: (r.x - ox) * scale,
    y: (r.y - oy) * scale,
    w: r.w * scale,
    h: r.h * scale,
  })
  return { scale, project }
}

/** The viewport rectangle projected into minimap space. */
export function viewportMarker(
  camera: Camera,
  viewport: ScreenSize,
  proj: MinimapProjection,
): Rect {
  return proj.project(viewportWorldRect(camera, viewport))
}
