import { atom } from 'signia'
import type { BoardSummary } from '../../api/boards'

/** Instance-level role: 'admin' = the super-admin (runs /admin), else a regular 'user'. */
export type Role = 'admin' | 'user'

/** Current user's instance role, loaded from /api/me. Board-level edit rights come from
 *  `boardAccessAtom.canEdit` (see board-store), NOT this — this only gates the /admin surface. */
export const userRoleAtom = atom<Role | null>('userRole', null)

/** The user's own board id (from /api/me) — the landing board. */
export const defaultBoardIdAtom = atom<string | null>('defaultBoardId', null)

/** The user's boards (owned + shared-with-me) for the header switcher. */
export const myBoardsAtom = atom<BoardSummary[]>('myBoards', [])
