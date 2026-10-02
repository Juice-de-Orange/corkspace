import type { Database } from '@corkspace/db'
import { boardMembers, boardShares, boards, entries } from '@corkspace/db/schema'
import { type AnyColumn, and, eq, exists, isNull, type SQL, sql } from 'drizzle-orm'
import type { SessionUser } from '../app'

/**
 * The single board-scoped access model (M2) — replaces the old global `visibilityWhere(user)`.
 * Every content read/mutation is authorized through a `BoardAccess`, and every read predicate is
 * built by `boardVisibilityWhere`. Ownership lives on `boards.owner_id`; invited registered users
 * are `board_members` (editor|viewer); account-less external links are `board_shares` (viewer,
 * public-only). Private entries reach only owner/editor/super-admin; viewers/external see public.
 */

export type AccessLevel = 'owner' | 'editor' | 'viewer' | 'none'

export interface BoardAccess {
  boardId: string
  level: AccessLevel
  isSuperAdmin: boolean
  /** owner || editor — may create/patch/delete content on this board. */
  canEdit: boolean
  /** owner || editor || super-admin — sees private entries. */
  canSeePrivate: boolean
  /** owner || editor || super-admin || (viewer/external with the share/member toggle on). */
  canSeeFurniture: boolean
}

function none(boardId: string): BoardAccess {
  return {
    boardId,
    level: 'none',
    isSuperAdmin: false,
    canEdit: false,
    canSeePrivate: false,
    canSeeFurniture: false,
  }
}

/** Resolve a session user's access to a specific board id. */
export async function resolveBoardAccess(
  db: Database,
  user: SessionUser,
  boardId: string,
): Promise<BoardAccess> {
  const rows = await db
    .select({ ownerId: boards.ownerId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
  const board = rows[0]
  if (!board) {
    return none(boardId)
  }
  const isSuperAdmin = user.role === 'admin'

  if (board.ownerId === user.id) {
    return {
      boardId,
      level: 'owner',
      isSuperAdmin,
      canEdit: true,
      canSeePrivate: true,
      canSeeFurniture: true,
    }
  }

  const mem = await db
    .select({ role: boardMembers.role, showFurniture: boardMembers.showFurniture })
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, user.id)))
    .limit(1)
  const m = mem[0]
  if (m) {
    if (m.role === 'editor') {
      return {
        boardId,
        level: 'editor',
        isSuperAdmin,
        canEdit: true,
        canSeePrivate: true,
        canSeeFurniture: true,
      }
    }
    return {
      boardId,
      level: 'viewer',
      isSuperAdmin,
      canEdit: false,
      canSeePrivate: false,
      canSeeFurniture: m.showFurniture,
    }
  }

  if (isSuperAdmin) {
    // Super-admin sees any board (incl. private) for moderation, but edits only boards they own.
    return {
      boardId,
      level: 'viewer',
      isSuperAdmin: true,
      canEdit: false,
      canSeePrivate: true,
      canSeeFurniture: true,
    }
  }

  return none(boardId)
}

/** Resolve an external share token → viewer access to exactly one board (public-only). */
export async function resolveShareToken(
  db: Database,
  token: string,
  now: Date = new Date(),
): Promise<BoardAccess | null> {
  const rows = await db
    .select({
      boardId: boardShares.boardId,
      showFurniture: boardShares.showFurniture,
      revokedAt: boardShares.revokedAt,
      expiresAt: boardShares.expiresAt,
    })
    .from(boardShares)
    .where(eq(boardShares.token, token))
    .limit(1)
  const s = rows[0]
  if (!s || s.revokedAt !== null || (s.expiresAt !== null && s.expiresAt <= now)) {
    return null
  }
  return {
    boardId: s.boardId,
    level: 'viewer',
    isSuperAdmin: false,
    canEdit: false,
    canSeePrivate: false,
    canSeeFurniture: s.showFurniture,
  }
}

/**
 * The board-scoped entry read predicate — pins board_id + not-deleted, and (unless the caller may
 * see private) restricts to public. Reused by entry-service, connections, strokes, assets.
 */
export function boardVisibilityWhere(access: BoardAccess): SQL {
  const base = and(eq(entries.boardId, access.boardId), isNull(entries.deletedAt)) as SQL
  if (access.canSeePrivate) {
    return base
  }
  return and(base, eq(entries.visibility, 'public')) as SQL
}

/**
 * SQL predicate: the entry referenced by `idCol` exists AND is visible to `access` (board-scoped,
 * not deleted, public-unless-canSeePrivate). The single source for connection/stroke read filters
 * on both the authed and public-token paths — a security-sensitive check that must not drift.
 */
export function visibleEntryExists(db: Database, idCol: AnyColumn, access: BoardAccess) {
  return exists(
    db
      .select({ n: sql`1` })
      .from(entries)
      .where(and(eq(entries.id, idCol), boardVisibilityWhere(access))),
  )
}

/** Idempotently ensure a user owns a personal board; returns its id. */
export async function ensurePersonalBoard(
  db: Database,
  userId: string,
  name = 'My board',
): Promise<string> {
  await db
    .insert(boards)
    .values({ ownerId: userId, name })
    .onConflictDoNothing({ target: boards.ownerId })
  const rows = await db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.ownerId, userId))
    .limit(1)
  // The row exists now (either pre-existing or just inserted).
  return rows[0]?.id as string
}
