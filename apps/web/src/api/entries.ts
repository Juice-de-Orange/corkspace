import type { CreateEntryInput, PatchEntryInput } from '@corkspace/shared'
import type { EntryMeta } from '../canvas/state/entry-store'
import { boardApi } from './board-context'
import { queueEntryPatch } from './entry-save-queue'

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

/** A request the server answered with an error status. `retryAfterMs` carries the `Retry-After`
 *  header (a public demo answers 429 with one when an address sends too many requests). */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`request failed: ${status}`)
  }
}

function retryAfterMs(res: Response): number | null {
  const seconds = Number(res.headers.get('retry-after') ?? Number.NaN)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new RequestError(res.status, retryAfterMs(res))
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

// Browsers cap the bodies of all in-flight keepalive requests at 64 KiB together; a larger save is
// sent as a normal request (it still completes while the page is only hidden, not when it closes).
const KEEPALIVE_MAX_BYTES = 60_000

/** Save a change to an entry. Queued per entry, so the newest change always reaches the server last. */
export function apiPatchEntry(id: string, patch: PatchEntryInput): Promise<EntryMeta> {
  return queueEntryPatch(id, patch, async (body, keepalive) => {
    const json = JSON.stringify(body)
    return toMeta(
      await asJson<EntryMetaResponse>(
        await fetch(boardApi(`/entries/${id}`), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: json,
          keepalive: keepalive && new TextEncoder().encode(json).length <= KEEPALIVE_MAX_BYTES,
        }),
      ),
    )
  })
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
 * Lazy-load an entry's heavy content. Entry components go through `loadEntryContent`
 * (entry-content-loader.ts), which batches and retries. `rev` is a content-revision cache-buster: pass a bumped
 * value (see `entryContentRevAtom`) to bypass any HTTP cache after the body changed out-of-band
 * (e.g. a version restore). The server ignores the extra query param.
 */
export async function apiGetContent(id: string, rev = 0): Promise<unknown> {
  const url = boardApi(`/entries/${id}/content`) + (rev > 0 ? `?v=${rev}` : '')
  const r = await asJson<{ content: unknown }>(await fetch(url, { credentials: 'include' }))
  return r.content
}

/**
 * Lazy-load the content of several entries in one request. Only for a board opened with a session:
 * the share-link tree is GET-only. Ids that are missing on the board or not visible to the caller
 * are missing from the result.
 */
export async function apiGetContents(ids: readonly string[]): Promise<Map<string, unknown>> {
  const rows = await asJson<Array<{ id: string; content: unknown }>>(
    await fetch(boardApi('/entries/content'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
  )
  return new Map(rows.map((r) => [r.id, r.content]))
}
