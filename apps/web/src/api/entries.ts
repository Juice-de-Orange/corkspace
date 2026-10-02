import type { CreateEntryInput, PatchEntryInput } from '@corkspace/shared'
import type { EntryMeta } from '../canvas/state/entry-store'
import { boardApi } from './board-context'

interface EntryMetaResponse {
  id: string
  type: EntryMeta['type']
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  visibility: 'public' | 'private'
  color: string | null
  imageAssetId: string | null
  tagIds?: string[]
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

function toMeta(r: EntryMetaResponse): EntryMeta {
  return {
    id: r.id,
    type: r.type,
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    rotation: r.rotation,
    zIndex: r.zIndex,
    visibility: r.visibility,
    tagIds: r.tagIds ?? [],
    ...(r.color ? { color: r.color } : {}),
    ...(r.imageAssetId ? { imageAssetId: r.imageAssetId } : {}),
  }
}

export async function fetchEntryMetas(): Promise<EntryMeta[]> {
  const rows = await asJson<EntryMetaResponse[]>(
    await fetch(boardApi('/entries'), { credentials: 'include' }),
  )
  return rows.map(toMeta)
}

export async function apiCreateEntry(input: CreateEntryInput): Promise<EntryMeta> {
  return toMeta(
    await asJson<EntryMetaResponse>(
      await fetch(boardApi('/entries'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    ),
  )
}

export async function apiPatchEntry(id: string, patch: PatchEntryInput): Promise<EntryMeta> {
  return toMeta(
    await asJson<EntryMetaResponse>(
      await fetch(boardApi(`/entries/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    ),
  )
}

export async function apiDuplicateEntry(id: string): Promise<EntryMeta> {
  return toMeta(
    await asJson<EntryMetaResponse>(
      await fetch(boardApi(`/entries/${id}/duplicate`), { method: 'POST', credentials: 'include' }),
    ),
  )
}

export async function apiDeleteEntry(id: string): Promise<void> {
  const res = await fetch(boardApi(`/entries/${id}`), { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new Error(`delete failed: ${res.status}`)
  }
}

/**
 * Lazy-load an entry's heavy content. `rev` is a content-revision cache-buster: pass a bumped
 * value (see `entryContentRevAtom`) to bypass any HTTP cache after the body changed out-of-band
 * (e.g. a version restore). The server ignores the extra query param.
 */
export async function apiGetContent(id: string, rev = 0): Promise<unknown> {
  const url = boardApi(`/entries/${id}/content`) + (rev > 0 ? `?v=${rev}` : '')
  const r = await asJson<{ content: unknown }>(await fetch(url, { credentials: 'include' }))
  return r.content
}
