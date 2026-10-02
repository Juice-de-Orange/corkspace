import type { Camera, ScreenSize } from '@corkspace/shared/kernel'
import { screenPoint } from '@corkspace/shared/kernel'
import { screenToWorld } from '../camera/convert'
import { clamp } from '../math/clamp'
import { clamp01, easeInOutCubic } from './easing'
import { interpolateView, type View } from './vanwijk'

export interface FlightOptions {
  screenSize: ScreenSize
  reducedMotion?: boolean
  rho?: number
  /** ms per unit of van-Wijk path length. */
  speed?: number
  minDurationMs?: number
  maxDurationMs?: number
}

export interface Flight {
  durationMs: number
  /** Camera at elapsed time `tMs` (clamped to [0, durationMs]). */
  at: (tMs: number) => Camera
}

const REDUCED_MOTION_MS = 220

/**
 * A camera flight: ease-out → pan → ease-in via van Wijk smooth zoom/pan, with duration
 * scaled by the path length. Reduced-motion uses a short, straight (no zoom-out arc) lerp.
 */
export function createFlight(from: Camera, to: Camera, opts: FlightOptions): Flight {
  const {
    screenSize,
    reducedMotion = false,
    rho = Math.SQRT2,
    speed = 1000,
    minDurationMs = 200,
    maxDurationMs = 1400,
  } = opts

  const cx = screenSize.w / 2
  const cy = screenSize.h / 2

  if (reducedMotion) {
    const durationMs = Math.min(REDUCED_MOTION_MS, maxDurationMs)
    const at = (tMs: number): Camera => {
      const t = easeInOutCubic(clamp01(durationMs === 0 ? 1 : tMs / durationMs))
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        zoom: from.zoom + (to.zoom - from.zoom) * t,
      }
    }
    return { durationMs, at }
  }

  const toView = (c: Camera): View => {
    const wc = screenToWorld(screenPoint(cx, cy), c)
    return { cx: wc.x, cy: wc.y, w: screenSize.w / c.zoom }
  }
  const fromView = toView(from)
  const interp = interpolateView(fromView, toView(to), rho)
  const durationMs = clamp(Math.abs(interp.S) * speed, minDurationMs, maxDurationMs)

  const viewToCamera = (v: View): Camera => {
    const zoom = screenSize.w / v.w
    return { x: cx - v.cx * zoom, y: cy - v.cy * zoom, zoom }
  }

  const at = (tMs: number): Camera => {
    const t = clamp01(durationMs === 0 ? 1 : tMs / durationMs)
    return viewToCamera(interp.at(t))
  }

  return { durationMs, at }
}
