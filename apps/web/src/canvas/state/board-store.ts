import type { Settings } from '@corkspace/shared'
import { atom } from 'signia'

/** The caller's access to the current board (from GET /api/boards/:id or a public token). */
export interface BoardAccess {
  level: 'owner' | 'editor' | 'viewer' | 'none'
  canEdit: boolean
  canSeePrivate: boolean
  canSeeFurniture: boolean
  isSuperAdmin: boolean
}

/** Read-only (public token) access — no session, viewer, public-only. */
export const PUBLIC_ACCESS: BoardAccess = {
  level: 'viewer',
  canEdit: false,
  canSeePrivate: false,
  canSeeFurniture: true,
  isSuperAdmin: false,
}

export const boardAccessAtom = atom<BoardAccess | null>('boardAccess', null)
export const boardSettingsAtom = atom<Settings | null>('boardSettings', null)
export const boardMetaAtom = atom<{ id: string; name: string } | null>('boardMeta', null)

/** May the current user mutate the current board? Drives every create/edit/draw affordance. */
export const canEdit = (): boolean => boardAccessAtom.value?.canEdit ?? false
