import { history } from '../../history/history'
import {
  connectAnchorAtom,
  connectDragAtom,
  connectHoverTargetAtom,
  connectSourceAnchorAtom,
  connectToolAtom,
  loadConnections,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from './connection-store'
import { editingEntryIdAtom } from './editor-state'
import {
  entriesLoadedAtom,
  entryContentRevAtom,
  loadEntries,
  recentlyCreatedIds,
  stickyTextCache,
} from './entry-store'
import { loadFrames } from './frame-store'
import { clipboardIdAtom, selectedEntryIdAtom } from './selection-state'
import { drawToolAtom, liveStrokeAtom, loadStrokes } from './stroke-store'
import { loadTags } from './tag-store'
import { loadTeleports } from './teleport-store'

/**
 * Reset every per-board / per-tenant transient CLIENT state. Called whenever the board context
 * changes (a board or account switch) and on sign-out.
 *
 * Why this is necessary: `history` (the undo/redo command stack), `recentlyCreatedIds`, the
 * per-entry content caches and the selection / tool / connect / clipboard atoms are module-level
 * singletons. A board or account switch is a client-side navigation — a React remount, **not** a
 * page reload — so these singletons SURVIVE it. Without this reset, pressing Undo after switching accounts replays the previous tenant's
 * commands (e.g. `deleteEntryCommand.undo` → `apiRestore` + `upsertEntry`), injecting a foreign
 * board's entry into the current one — a ghost the server RBAC then refuses to delete.
 *
 * The board DATA (entries/strokes/connections/frames/teleports/tags + the spatial index) is ALSO
 * reset to empty here. `useLoadEntries` repopulates it, but if any of those six fetches fails on a
 * switch, the previous tenant's content would otherwise stay rendered + collidable under the new
 * board — so we clear first and let the reload repopulate.
 */
export function resetBoardClientState(): void {
  history.clear()
  recentlyCreatedIds.clear()
  // Per-entry caches would otherwise grow with every entry seen in the session.
  stickyTextCache.clear()
  entryContentRevAtom.set(new Map())
  selectedEntryIdAtom.set(null)
  selectedConnectionIdAtom.set(null)
  clipboardIdAtom.set(null)
  editingEntryIdAtom.set(null)
  // An armed tool must not carry over to the next board (which may be view-only).
  connectToolAtom.set(false)
  drawToolAtom.set(null)
  pendingConnectFromAtom.set(null)
  connectDragAtom.set(null)
  connectHoverTargetAtom.set(null)
  connectAnchorAtom.set(null)
  connectSourceAnchorAtom.set(null)
  liveStrokeAtom.set(null)
  loadEntries([])
  entriesLoadedAtom.set(false) // the next board's entries are not here yet
  loadStrokes([])
  loadConnections([])
  loadFrames([])
  loadTeleports([])
  loadTags([])
}
