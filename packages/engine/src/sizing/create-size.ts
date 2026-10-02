import type { ScreenSize, WorldSize } from '@corkspace/shared/kernel'
import { screenSize, worldSize } from '@corkspace/shared/kernel'

/**
 * World size for a newly created entry so it looks "normal" on screen at the current zoom:
 * `world = reference_screen_size / zoom`. Afterwards the entry keeps this fixed world size.
 */
export function worldSizeForNewEntry(referenceScreen: ScreenSize, zoom: number): WorldSize {
  if (zoom <= 0) {
    throw new RangeError(`worldSizeForNewEntry: zoom must be > 0 (got ${zoom})`)
  }
  return worldSize(referenceScreen.w / zoom, referenceScreen.h / zoom)
}

/** Cap the longer edge of a natural image size to `maxLongEdge`, preserving aspect ratio. */
export function capLongEdge(natural: ScreenSize, maxLongEdge: number): ScreenSize {
  const longest = Math.max(natural.w, natural.h)
  if (longest <= maxLongEdge) {
    return natural
  }
  const k = maxLongEdge / longest
  return screenSize(Math.round(natural.w * k), Math.round(natural.h * k))
}
