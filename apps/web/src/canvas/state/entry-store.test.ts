import { beforeEach, describe, expect, it } from 'vitest'
import {
  type EntryMeta,
  entriesAtom,
  loadEntries,
  removeEntry,
  spatialIndex,
  upsertEntry,
} from './entry-store'

const meta = (id: string, x: number, y: number): EntryMeta => ({
  id,
  type: 'sticky',
  x,
  y,
  w: 240,
  h: 240,
  rotation: 0,
  zIndex: 1,
  visibility: 'private',
})

beforeEach(() => loadEntries([]))

describe('entry-store', () => {
  it('loads entries into both the map and the spatial index', () => {
    loadEntries([meta('a', 0, 0), meta('b', 1000, 0)])
    expect(entriesAtom.value.size).toBe(2)
    expect(spatialIndex.size).toBe(2)
  })

  it('upserts an entry and moves it in the index', () => {
    loadEntries([meta('a', 0, 0)])
    upsertEntry(meta('a', 500, 500))
    expect(entriesAtom.value.get('a')?.x).toBe(500)
    expect(spatialIndex.searchRect({ x: 490, y: 490, w: 20, h: 20 })).toContain('a')
  })

  it('removes an entry from both stores; missing id is a no-op', () => {
    loadEntries([meta('a', 0, 0)])
    removeEntry('a')
    expect(entriesAtom.value.size).toBe(0)
    expect(spatialIndex.size).toBe(0)
    removeEntry('nope')
    expect(entriesAtom.value.size).toBe(0)
  })
})
