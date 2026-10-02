import { atom } from 'signia'

export interface ConnMeta {
  id: string
  fromEntryId: string
  toEntryId: string
  color: string
  label: string | null
  arrowStart: boolean
  arrowEnd: boolean
}

export const connectionsAtom = atom<ReadonlyMap<string, ConnMeta>>('connections', new Map())

export function loadConnections(rows: ConnMeta[]): void {
  connectionsAtom.set(new Map(rows.map((r) => [r.id, r])))
}

export function upsertConnection(c: ConnMeta): void {
  const next = new Map(connectionsAtom.value)
  next.set(c.id, c)
  connectionsAtom.set(next)
}

export function removeConnection(id: string): void {
  const next = new Map(connectionsAtom.value)
  if (next.delete(id)) {
    connectionsAtom.set(next)
  }
}

/** True if a thread already links these two entries (either direction) — for the dedup guard. */
export function connectionExists(a: string, b: string): boolean {
  for (const c of connectionsAtom.value.values()) {
    if ((c.fromEntryId === a && c.toEntryId === b) || (c.fromEntryId === b && c.toEntryId === a)) {
      return true
    }
  }
  return false
}

/** Transient state while dragging a new thread from an entry edge to a target. */
export const connectDragAtom = atom<{ fromId: string; x: number; y: number } | null>(
  'connectDrag',
  null,
)

/** "Verbinden" tool armed (click entry A → click entry B to connect). */
export const connectToolAtom = atom<boolean>('connectTool', false)

/** First entry picked while the connect tool is armed (awaiting the second). */
export const pendingConnectFromAtom = atom<string | null>('pendingConnectFrom', null)

/** Entry currently under the pointer during a connect gesture (highlighted as the drop target). */
export const connectHoverTargetAtom = atom<string | null>('connectHoverTarget', null)

/** Nearest-edge docking point (WORLD coords) under the pointer while the Verbinden tool hovers an
 *  entry — the badge re-projects it to screen each camera frame so it never drifts on pan/zoom. */
export const connectAnchorAtom = atom<{ entryId: string; wx: number; wy: number } | null>(
  'connectAnchor',
  null,
)

/** WORLD point where the first Verbinden click docked — the thread's fixed end during the
 *  gesture. Rendered as a pinned badge; the preview line starts here. Null = nothing docked. */
export const connectSourceAnchorAtom = atom<{ entryId: string; wx: number; wy: number } | null>(
  'connectSourceAnchor',
  null,
)

/** Selected connection (opens the label/arrow/colour editor). */
export const selectedConnectionIdAtom = atom<string | null>('selectedConnection', null)
