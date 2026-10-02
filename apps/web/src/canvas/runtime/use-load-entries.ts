import { useEffect } from 'react'
import { fetchConnections } from '../../api/connections'
import { fetchEntryMetas } from '../../api/entries'
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

/** Load entries, connections, strokes, teleports, frames and tags once the board is ready. */
export function useLoadEntries(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    void (async () => {
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
        }
      } catch {
        // unauthenticated / offline — leave the board empty
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
}
