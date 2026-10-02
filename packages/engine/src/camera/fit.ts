import type { Camera, Rect, ScreenSize } from '@corkspace/shared/kernel'
import { clampZoom } from '../math/clamp'

/** Camera that centers `rect` in the viewport, zoomed to fit it with a margin factor (≥1). */
export function cameraForRect(rect: Rect, viewport: ScreenSize, margin = 1.5): Camera {
  const fit = Math.min(viewport.w / (rect.w * margin), viewport.h / (rect.h * margin))
  const zoom = clampZoom(Number.isFinite(fit) && fit > 0 ? fit : 1)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return { x: viewport.w / 2 - cx * zoom, y: viewport.h / 2 - cy * zoom, zoom }
}
