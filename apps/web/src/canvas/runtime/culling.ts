import type { SpatialIndex } from '@corkspace/engine'
import { type Camera, OVERSCAN_PX, type ScreenSize } from '@corkspace/shared/kernel'

export interface MountResult {
  /** Entries to keep MOUNTED (viewport + overscan ring). */
  mount: Set<string>
  /** Entries strictly inside the viewport (shown; the ring is display:none). */
  visible: Set<string>
}

/**
 * Beyond this many strictly-visible entries the overscan ring is skipped: at extreme zoom-out the
 * ring (`overscanScreenPx / zoom` world units) explodes and would mount an unbounded set in one
 * React pass. The visible entries still all render — we just drop the pre-mount ring (and its second
 * rbush search) once we are clearly zoomed far out.
 */
const OVERSCAN_SKIP_THRESHOLD = 1200

/** Windowed culling: mount the viewport + an overscan ring, show only the strict viewport.
 *  `extraOverscanScreenPx` widens the pre-mount ring for one frame (used during fast zoom-out to
 *  pre-mount the annulus about to be revealed, so entries entering the viewport paint immediately
 *  instead of blanking for a frame). Still bounded by OVERSCAN_SKIP_THRESHOLD. */
export function computeMountSet(
  index: SpatialIndex,
  camera: Camera,
  viewport: ScreenSize,
  overscanScreenPx = OVERSCAN_PX,
  extraOverscanScreenPx = 0,
): MountResult {
  const visible = new Set(index.visibleIds(camera, viewport, 0))
  if (visible.size >= OVERSCAN_SKIP_THRESHOLD) {
    return { mount: new Set(visible), visible }
  }
  return {
    mount: new Set(index.visibleIds(camera, viewport, overscanScreenPx + extraOverscanScreenPx)),
    visible,
  }
}

export function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const x of a) {
    if (!b.has(x)) {
      return false
    }
  }
  return true
}
