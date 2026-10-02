import { createFlight } from '@corkspace/engine'
import { screenSize } from '@corkspace/shared'
import { getCamera, setCamera, viewportAtom } from '../state/camera-store'

let cancelActive: (() => void) | null = null

/** Animate the camera to a target {x,y,zoom} via the engine's van-Wijk flight tween
 *  (reduced-motion aware). Cancels any in-flight tween. */
export function flyTo(target: { x: number; y: number; zoom: number }): void {
  cancelActive?.()
  const vp = viewportAtom.value
  const reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const flight = createFlight(getCamera(), target, {
    screenSize: screenSize(vp.w, vp.h),
    reducedMotion,
  })
  const start = performance.now()
  let raf = 0
  const step = (): void => {
    const t = performance.now() - start
    setCamera(flight.at(Math.min(t, flight.durationMs)))
    if (t < flight.durationMs) {
      raf = requestAnimationFrame(step)
    } else {
      cancelActive = null
    }
  }
  cancelActive = () => cancelAnimationFrame(raf)
  raf = requestAnimationFrame(step)
}
