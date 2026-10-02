import { history } from '../../history/history'
import {
  connectAnchorAtom,
  connectDragAtom,
  connectHoverTargetAtom,
  connectSourceAnchorAtom,
  loadConnections,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from './connection-store'
import { editingEntryIdAtom } from './editor-state'
import { loadEntries, recentlyCreatedIds } from './entry-store'
import { loadFrames } from './frame-store'
import { clipboardIdAtom, selectedEntryIdAtom } from './selection-state'
import { liveStrokeAtom, loadStrokes } from './stroke-store'
import { loadTags } from './tag-store'
import { loadTeleports } from './teleport-store'

/**
 * Reset every per-board / per-tenant transient CLIENT state. Called whenever the board context
 * changes (a board or account switch) and on sign-out.
 *
 * Why this is necessary: `history` (the undo/redo command stack), `recentlyCreatedIds` and the
 * selection / connect / clipboard atoms are module-level singletons. A board or account switch is
 * a client-side navigation — a React remount, **not** a page reload — so these singletons SURVIVE
 * it. Without this reset, pressing Undo after switching accounts replays the previous tenant's
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
  selectedEntryIdAtom.set(null)
  selectedConnectionIdAtom.set(null)
  clipboardIdAtom.set(null)
  editingEntryIdAtom.set(null)
  pendingConnectFromAtom.set(null)
  connectDragAtom.set(null)
  connectHoverTargetAtom.set(null)
  connectAnchorAtom.set(null)
  connectSourceAnchorAtom.set(null)
  liveStrokeAtom.set(null)
  loadEntries([])
  loadStrokes([])
  loadConnections([])
  loadFrames([])
  loadTeleports([])
  loadTags([])
}
