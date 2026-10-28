import { useEffect, useState } from 'react'
import { fetchConnections } from '../../api/connections'
import { fetchEntryMetas, RequestError } from '../../api/entries'
import { fetchFrames } from '../../api/frames'
import { fetchStrokes } from '../../api/strokes'
import { fetchTags } from '../../api/tags'
import { fetchTeleports } from '../../api/teleports'
import { loadConnections } from '../state/connection-store'
import { loadEntries } from '../state/entry-store'
import { loadFrames } from '../state/frame-store'
import { loadStrokes } from '../state/stroke-store'
import { loadTags } from '../state/tag-store'
import { loadTeleports } from '../state/teleport-store'

const RETRY_MIN_MS = 1000
/** Ceiling of the exponential backoff. */
const RETRY_MAX_MS = 30_000
/** Ceiling of a server-given wait (the demo's rate-limit window is one minute). */
const RETRY_AFTER_MAX_MS = 60_000

/** Milliseconds until the next attempt, or null when another one cannot help (signed out, no
 *  access, board gone): the server's `Retry-After` (a public demo answers 429 once an address
 *  sends too many requests), otherwise exponential backoff — as for entry content. */
function retryDelay(failures: number, error: unknown): number | null {
  if (error instanceof RequestError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return null
    }
    if (error.retryAfterMs !== null) {
      return Math.min(Math.max(error.retryAfterMs, RETRY_MIN_MS), RETRY_AFTER_MAX_MS)
    }
  }
  return Math.min(RETRY_MIN_MS * 2 ** failures, RETRY_MAX_MS)
}

/**
 * Load entries, connections, strokes, teleports, frames and tags once the board is ready. A failed
 * load is retried until it succeeds or the board changes; returns true while a retry is pending,
 * so the board can say so instead of looking empty.
 */
export function useLoadEntries(enabled: boolean): boolean {
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async (failures: number): Promise<void> => {
      try {
        const [metas, conns, strokes, teleports, frames, tags] = await Promise.all([
          fetchEntryMetas(),
          fetchConnections(),
          fetchStrokes(),
          fetchTeleports(),
          fetchFrames(),
          fetchTags(),
        ])
        if (!cancelled) {
          loadEntries(metas)
          loadConnections(conns)
          loadStrokes(strokes)
          loadTeleports(teleports)
          loadFrames(frames)
          loadTags(tags)
          setRetrying(false)
        }
      } catch (e) {
        if (cancelled) {
          return
        }
        const wait = retryDelay(failures, e)
        setRetrying(wait !== null)
        if (wait !== null) {
          timer = setTimeout(() => void load(failures + 1), wait)
        }
      }
    }
    void load(0)
    return () => {
      cancelled = true
      clearTimeout(timer)
      setRetrying(false)
    }
  }, [enabled])
  return retrying
}
