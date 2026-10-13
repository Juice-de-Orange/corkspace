import { isPublicBoard } from './board-context'
import { apiGetContent, apiGetContents, RequestError } from './entries'

/**
 * Lazy content loading for mounted entries.
 *
 * A board opens with entry metadata only; each content entry asks for its body when it mounts (the
 * viewport plus the overscan ring, so the culling budget bounds the asks). Asks made in the same
 * React commit — a board opening, a pan or zoom that mounts new entries — go out together as one
 * `POST …/entries/content`, so opening a board costs one request instead of one per entry in view.
 * A share link reads the GET-only public tree, so there every entry is fetched on its own.
 *
 * A failed load is retried until it succeeds or the entry unmounts: after the server's
 * `Retry-After` (a public demo answers 429 once an address sends too many requests), otherwise with
 * exponential backoff. Without the retry, one failed request left an entry in view looking empty —
 * "double-click to edit" — until the camera happened to remount it.
 */

/** Ids per batch request: below the api's 500 and, at ~40 bytes per id, the demo's 16 KiB body
 *  limit (DEMO_MAX_BODY_BYTES). */
const BATCH_MAX = 200
const RETRY_MIN_MS = 1000
/** Ceiling of the exponential backoff. */
const RETRY_MAX_MS = 30_000
/** Ceiling of a server-given wait (the demo's rate-limit window is one minute). */
const RETRY_AFTER_MAX_MS = 60_000

interface Ask {
  id: string
  rev: number
  onLoad: (content: unknown) => void
  /** Failed attempts so far. */
  failures: number
  cancelled: boolean
}

let queued: Ask[] = []
let flushScheduled = false

function enqueue(ask: Ask): void {
  queued.push(ask)
  if (!flushScheduled) {
    flushScheduled = true
    // A microtask runs after the commit's effects, so all entries mounted together share a batch.
    queueMicrotask(flush)
  }
}

/** Milliseconds until the next attempt, or null when retrying cannot help (the entry is gone). */
function retryDelay(ask: Ask, error: unknown): number | null {
  if (error instanceof RequestError) {
    if (error.status === 404) {
      return null
    }
    if (error.retryAfterMs !== null) {
      return Math.min(Math.max(error.retryAfterMs, RETRY_MIN_MS), RETRY_AFTER_MAX_MS)
    }
  }
  return Math.min(RETRY_MIN_MS * 2 ** ask.failures, RETRY_MAX_MS)
}

/** Retry the asks of a failed request together, so they go out as one batch again, once the
 *  longest of their waits has passed. */
function retry(asks: readonly Ask[], error: unknown): void {
  const again: Ask[] = []
  let delay = 0
  for (const ask of asks) {
    const wait = ask.cancelled ? null : retryDelay(ask, error)
    if (wait !== null) {
      ask.failures += 1
      again.push(ask)
      delay = Math.max(delay, wait)
    }
  }
  if (again.length > 0) {
    setTimeout(() => {
      for (const ask of again) {
        if (!ask.cancelled) {
          enqueue(ask)
        }
      }
    }, delay)
  }
}

function deliver(ask: Ask, content: unknown): void {
  if (!ask.cancelled) {
    ask.onLoad(content)
  }
}

async function sendBatch(asks: readonly Ask[]): Promise<void> {
  try {
    const contents = await apiGetContents([...new Set(asks.map((a) => a.id))])
    // An id missing from the answer was deleted or is not visible: nothing to show or retry.
    for (const ask of asks) {
      if (contents.has(ask.id)) {
        deliver(ask, contents.get(ask.id))
      }
    }
  } catch (e) {
    retry(asks, e)
  }
}

async function sendOne(ask: Ask): Promise<void> {
  try {
    deliver(ask, await apiGetContent(ask.id, ask.rev))
  } catch (e) {
    retry([ask], e)
  }
}

function flush(): void {
  flushScheduled = false
  const asks = queued.filter((a) => !a.cancelled)
  queued = []
  if (isPublicBoard()) {
    for (const ask of asks) {
      void sendOne(ask)
    }
    return
  }
  for (let i = 0; i < asks.length; i += BATCH_MAX) {
    void sendBatch(asks.slice(i, i + BATCH_MAX))
  }
}

/**
 * Load entry `id`'s content and hand it to `onLoad` once it has arrived. `rev` is the entry's
 * content revision (`entryContentRevAtom`); an ask for a newer revision is always a new request,
 * and a share link sends it as a cache-buster. Returns the cancel function for the effect cleanup:
 * a cancelled ask is neither delivered nor retried.
 */
export function loadEntryContent(
  id: string,
  rev: number,
  onLoad: (content: unknown) => void,
): () => void {
  const ask: Ask = { id, rev, onLoad, failures: 0, cancelled: false }
  enqueue(ask)
  return () => {
    ask.cancelled = true
  }
}
