import { pointInRotatedRect } from '@corkspace/engine'
import type { EntryMeta } from '../state/entry-store'

/** A snapshot of an entry's pose taken at stroke/gesture start — the unrotated frame + rotation,
 *  enough to convert world points into the entry's local space (so anchored strokes follow it). */
export interface AnchorSnapshot {
  id: string
  rect: { x: number; y: number; w: number; h: number }
  rotation: number
}

/**
 * The topmost (highest z-index) eligible entry whose ROTATED frame contains the world point `w`,
 * or null. Visual stacking wins. `isEligible` filters candidates (e.g. only persisted uuid entries
 * can anchor a stroke — the server needs a real id). Pure.
 */
export function pickTopmostEntryAt(
  entries: Iterable<EntryMeta>,
  w: { x: number; y: number },
  isEligible: (e: EntryMeta) => boolean,
): EntryMeta | null {
  let best: EntryMeta | null = null
  for (const e of entries) {
    if (!isEligible(e)) {
      continue
    }
    if (!pointInRotatedRect(w, { x: e.x, y: e.y, w: e.w, h: e.h }, e.rotation)) {
      continue
    }
    if (!best || e.zIndex > best.zIndex) {
      best = e
    }
  }
  return best
}

/** Snapshot an entry's anchor pose (or null for no anchor). */
export function anchorSnapshot(e: EntryMeta | null): AnchorSnapshot | null {
  return e ? { id: e.id, rect: { x: e.x, y: e.y, w: e.w, h: e.h }, rotation: e.rotation } : null
}
