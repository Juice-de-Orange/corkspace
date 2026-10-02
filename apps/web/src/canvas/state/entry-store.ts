import { SpatialIndex } from '@corkspace/engine'
import { type EntryType, type WorldRect, worldRect } from '@corkspace/shared/kernel'
import { atom } from 'signia'

/** Client-side entry metadata (positions/sizes only — heavy content is fetched lazily). */
export interface EntryMeta {
  id: string
  type: EntryType
  x: number
  y: number
  w: number
  h: number
  rotation: number
  zIndex: number
  visibility: 'public' | 'private'
  color?: string
  title?: string
  imageAssetId?: string
  tagIds?: string[]
}

export const entriesAtom = atom<ReadonlyMap<string, EntryMeta>>('entries', new Map())

/**
 * Per-entry content revision counter. Content-bearing entries (sticky/doc/checklist) lazy-load
 * their body keyed on `meta.id`; bumping an id's revision forces those effects to re-fetch — used
 * when the server-side content changes out-of-band (e.g. restoring a prior version).
 */
export const entryContentRevAtom = atom<ReadonlyMap<string, number>>('entryContentRev', new Map())

export function bumpEntryContentRev(id: string): void {
  const next = new Map(entryContentRevAtom.value)
  next.set(id, (next.get(id) ?? 0) + 1)
  entryContentRevAtom.set(next)
}

/**
 * Ids created in this session. A just-created entry has known (empty) content, so it's editable
 * immediately; existing entries stay edit-gated until their content lazy-loads (content-wipe guard).
 */
export const recentlyCreatedIds = new Set<string>()

/** The spatial index mirrors `entriesAtom` and feeds viewport culling + collision. */
export const spatialIndex = new SpatialIndex()

export const entryRect = (e: EntryMeta): WorldRect => worldRect(e.x, e.y, e.w, e.h)

export function loadEntries(metas: readonly EntryMeta[]): void {
  spatialIndex.clear()
  spatialIndex.bulkLoad(metas.map((e) => ({ id: e.id, rect: entryRect(e) })))
  const map = new Map<string, EntryMeta>()
  for (const e of metas) {
    map.set(e.id, e)
  }
  entriesAtom.set(map)
}

export function upsertEntry(e: EntryMeta): void {
  const next = new Map(entriesAtom.value)
  next.set(e.id, e)
  spatialIndex.update(e.id, entryRect(e))
  entriesAtom.set(next)
}

export function removeEntry(id: string): void {
  const next = new Map(entriesAtom.value)
  if (!next.delete(id)) {
    return
  }
  spatialIndex.remove(id)
  entriesAtom.set(next)
}
