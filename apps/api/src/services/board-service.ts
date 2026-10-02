import { randomBytes } from 'node:crypto'
import type { Database } from '@corkspace/db'
import { appSettings, boardMembers, boardShares, boards, user } from '@corkspace/db/schema'
import {
  type CreateShareInput,
  type PartialSettings,
  type PatchBoardInput,
  type PatchMemberInput,
  resolveEffectiveSettings,
  type Settings,
} from '@corkspace/shared'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { SessionUser } from '../app'

export interface BoardSummary {
  id: string
  name: string
  ownerId: string
  ownerName: string
  level: 'owner' | 'editor' | 'viewer'
}

/** My owned board + boards shared with me. Super-admin additionally sees every board. */
export async function listBoardsForUser(
  db: Database,
  sessionUser: SessionUser,
): Promise<BoardSummary[]> {
  const owned = await db
    .select({ id: boards.id, name: boards.name, ownerId: boards.ownerId, ownerName: user.name })
    .from(boards)
    .innerJoin(user, eq(user.id, boards.ownerId))
    .where(eq(boards.ownerId, sessionUser.id))
  const shared = await db
    .select({
      id: boards.id,
      name: boards.name,
      ownerId: boards.ownerId,
      ownerName: user.name,
      role: boardMembers.role,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .innerJoin(user, eq(user.id, boards.ownerId))
    .where(eq(boardMembers.userId, sessionUser.id))

  const out: BoardSummary[] = [
    ...owned.map((b) => ({ ...b, level: 'owner' as const })),
    ...shared.map((b) => ({
      id: b.id,
      name: b.name,
      ownerId: b.ownerId,
      ownerName: b.ownerName,
      level: b.role,
    })),
  ]

  if (sessionUser.role === 'admin') {
    const seen = new Set(out.map((b) => b.id))
    const all = await db
      .select({ id: boards.id, name: boards.name, ownerId: boards.ownerId, ownerName: user.name })
      .from(boards)
      .innerJoin(user, eq(user.id, boards.ownerId))
    for (const b of all) {
      if (!seen.has(b.id)) {
        out.push({ ...b, level: 'viewer' })
      }
    }
  }
  return out
}

/** The user's own personal board id (each user owns exactly one). */
export async function getOwnBoardId(db: Database, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.ownerId, userId))
    .limit(1)
  return rows[0]?.id ?? null
}

async function getGlobalDefaults(db: Database): Promise<PartialSettings> {
  const rows = await db
    .select({ defaults: appSettings.defaults })
    .from(appSettings)
    .where(eq(appSettings.id, 'global'))
    .limit(1)
  return (rows[0]?.defaults ?? {}) as PartialSettings
}

export interface BoardMeta {
  id: string
  name: string
  ownerId: string
  rawSettings: PartialSettings
  globalDefaults: PartialSettings
  effectiveSettings: Settings
}

export async function getBoardMeta(db: Database, boardId: string): Promise<BoardMeta | null> {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      ownerId: boards.ownerId,
      settings: boards.settings,
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
  const b = rows[0]
  if (!b) {
    return null
  }
  const raw = (b.settings ?? {}) as PartialSettings
  const globalDefaults = await getGlobalDefaults(db)
  return {
    id: b.id,
    name: b.name,
    ownerId: b.ownerId,
    rawSettings: raw,
    globalDefaults,
    effectiveSettings: resolveEffectiveSettings(globalDefaults, raw),
  }
}

/** Effective settings only (for the external/public token read path). */
export async function getEffectiveBoardSettings(db: Database, boardId: string): Promise<Settings> {
  const rows = await db
    .select({ settings: boards.settings })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
  const raw = (rows[0]?.settings ?? {}) as PartialSettings
  return resolveEffectiveSettings(await getGlobalDefaults(db), raw)
}

export async function patchBoard(
  db: Database,
  boardId: string,
  patch: PatchBoardInput,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) {
    updates.name = patch.name
  }
  if (patch.settings !== undefined) {
    updates.settings = patch.settings
  }
  await db.update(boards).set(updates).where(eq(boards.id, boardId))
}

// ---- Members ---------------------------------------------------------------

export interface MemberRow {
  userId: string
  email: string
  name: string
  role: 'editor' | 'viewer'
  showFurniture: boolean
}

export async function listMembers(db: Database, boardId: string): Promise<MemberRow[]> {
  return db
    .select({
      userId: boardMembers.userId,
      email: user.email,
      name: user.name,
      role: boardMembers.role,
      showFurniture: boardMembers.showFurniture,
    })
    .from(boardMembers)
    .innerJoin(user, eq(user.id, boardMembers.userId))
    .where(eq(boardMembers.boardId, boardId))
    .orderBy(desc(boardMembers.createdAt))
}

export type InviteResult = { ok: true } | { ok: false; reason: 'notfound' | 'is-owner' }

/** Invite an ALREADY-REGISTERED user by email (no self-signup). Upserts their membership. */
export async function inviteMember(
  db: Database,
  boardId: string,
  ownerId: string,
  input: { email: string; role: 'editor' | 'viewer'; showFurniture: boolean },
): Promise<InviteResult> {
  const email = input.email.toLowerCase()
  const found = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  const target = found[0]
  if (!target) {
    return { ok: false, reason: 'notfound' }
  }
  if (target.id === ownerId) {
    return { ok: false, reason: 'is-owner' }
  }
  await db
    .insert(boardMembers)
    .values({
      boardId,
      userId: target.id,
      role: input.role,
      showFurniture: input.showFurniture,
      invitedBy: ownerId,
    })
    .onConflictDoUpdate({
      target: [boardMembers.boardId, boardMembers.userId],
      set: { role: input.role, showFurniture: input.showFurniture },
    })
  return { ok: true }
}

export async function patchMember(
  db: Database,
  boardId: string,
  userId: string,
  patch: PatchMemberInput,
): Promise<boolean> {
  const updates: Record<string, unknown> = {}
  if (patch.role !== undefined) {
    updates.role = patch.role
  }
  if (patch.showFurniture !== undefined) {
    updates.showFurniture = patch.showFurniture
  }
  if (Object.keys(updates).length === 0) {
    // Nothing to change — still report whether the member exists (parity with the update path,
    // so a no-op patch on a nonexistent member doesn't falsely 200).
    const found = await db
      .select({ userId: boardMembers.userId })
      .from(boardMembers)
      .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
      .limit(1)
    return found.length > 0
  }
  const rows = await db
    .update(boardMembers)
    .set(updates)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .returning({ userId: boardMembers.userId })
  return rows.length > 0
}

export async function removeMember(
  db: Database,
  boardId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
    .returning({ userId: boardMembers.userId })
  return rows.length > 0
}

// ---- Shares (external links) ----------------------------------------------

export interface ShareRow {
  id: string
  token: string
  label: string | null
  showFurniture: boolean
  revokedAt: Date | null
  createdAt: Date
}

export async function createShare(
  db: Database,
  boardId: string,
  createdBy: string,
  input: CreateShareInput,
): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString('base64url')
  const rows = await db
    .insert(boardShares)
    .values({
      boardId,
      token,
      label: input.label ?? null,
      showFurniture: input.showFurniture,
      createdBy,
    })
    .returning({ id: boardShares.id, token: boardShares.token })
  return rows[0] as { id: string; token: string }
}

export async function listShares(db: Database, boardId: string): Promise<ShareRow[]> {
  return db
    .select({
      id: boardShares.id,
      token: boardShares.token,
      label: boardShares.label,
      showFurniture: boardShares.showFurniture,
      revokedAt: boardShares.revokedAt,
      createdAt: boardShares.createdAt,
    })
    .from(boardShares)
    .where(and(eq(boardShares.boardId, boardId), isNull(boardShares.revokedAt)))
    .orderBy(desc(boardShares.createdAt))
}

export async function revokeShare(
  db: Database,
  boardId: string,
  shareId: string,
): Promise<boolean> {
  const rows = await db
    .update(boardShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(boardShares.id, shareId),
        eq(boardShares.boardId, boardId),
        isNull(boardShares.revokedAt),
      ),
    )
    .returning({ id: boardShares.id })
  return rows.length > 0
}

// ---- Global defaults (super-admin) ----------------------------------------

export async function getAppDefaults(db: Database): Promise<PartialSettings> {
  return getGlobalDefaults(db)
}

export async function setAppDefaults(
  db: Database,
  defaults: PartialSettings,
  updatedBy: string,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: 'global', defaults, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { defaults, updatedBy, updatedAt: new Date() },
    })
}
