import type { Database } from '@corkspace/db'
import { entries, entryTags, entryVersions } from '@corkspace/db/schema'
import {
  type CreateEntryInput,
  entrySearchText,
  type PatchEntryInput,
  VERSION_RETENTION,
  validateContent,
} from '@corkspace/shared'
import { and, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import type { SessionUser } from '../app'
import { type BoardAccess, boardVisibilityWhere } from './board-access'

/** Metadata-only projection (no content / search columns) for the initial board load. */
const META = {
  id: entries.id,
  type: entries.type,
  x: entries.x,
  y: entries.y,
  width: entries.width,
  height: entries.height,
  rotation: entries.rotation,
  zIndex: entries.zIndex,
  visibility: entries.visibility,
  color: entries.color,
  imageAssetId: entries.imageAssetId,
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
}

export type EntryMetaRow = Awaited<ReturnType<typeof listEntryMeta>>[number]

export function listEntryMeta(db: Database, access: BoardAccess) {
  return db.select(META).from(entries).where(boardVisibilityWhere(access))
}

/** Board load with each entry's tag ids attached (feeds the on-board tag chips + rule styling). */
export async function listEntryMetaWithTags(db: Database, access: BoardAccess) {
  const rows = await listEntryMeta(db, access)
  if (rows.length === 0) {
    return rows.map((r) => ({ ...r, tagIds: [] as string[] }))
  }
  const tagRows = await db
    .select({ entryId: entryTags.entryId, tagId: entryTags.tagId })
    .from(entryTags)
    .where(
      inArray(
        entryTags.entryId,
        rows.map((r) => r.id),
      ),
    )
  const byEntry = new Map<string, string[]>()
  for (const t of tagRows) {
    const arr = byEntry.get(t.entryId)
    if (arr) {
      arr.push(t.tagId)
    } else {
      byEntry.set(t.entryId, [t.tagId])
    }
  }
  return rows.map((r) => ({ ...r, tagIds: byEntry.get(r.id) ?? [] }))
}

/** Single entry content, board+visibility-checked (null → caller returns 404). */
export async function getEntryContent(db: Database, access: BoardAccess, id: string) {
  const rows = await db
    .select({ content: entries.content })
    .from(entries)
    .where(and(eq(entries.id, id), boardVisibilityWhere(access)))
    .limit(1)
  return rows[0] ?? null
}

/** Batch lazy content for visible ids on this board. */
export async function getEntriesContent(db: Database, access: BoardAccess, ids: string[]) {
  if (ids.length === 0) {
    return []
  }
  return db
    .select({ id: entries.id, content: entries.content })
    .from(entries)
    .where(and(inArray(entries.id, ids), boardVisibilityWhere(access)))
}

export async function createEntry(
  db: Database,
  boardId: string,
  user: SessionUser,
  input: CreateEntryInput,
) {
  const searchText = entrySearchText(input.type, input.content)
  const rows = await db
    .insert(entries)
    .values({
      boardId,
      type: input.type,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: input.rotation,
      zIndex: input.zIndex,
      visibility: input.visibility,
      color: input.color ?? null,
      content: input.content ?? {},
      imageAssetId: input.imageAssetId ?? null,
      searchText,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning(META)
  return rows[0]
}

export type PatchResult =
  | { ok: true; row: EntryMetaRow }
  | { ok: false; reason: 'notfound' | 'invalid-content' }

/**
 * Autosave (last-write-wins). Scoped to `boardId` (an editor can only patch entries on the board
 * they may edit). On `commitVersion`, snapshot the PRIOR state into entry_versions (pruned to the
 * newest VERSION_RETENTION) within the same transaction. `updated_by` records the acting editor.
 */
export async function patchEntry(
  db: Database,
  boardId: string,
  user: SessionUser,
  id: string,
  patch: PatchEntryInput,
): Promise<PatchResult> {
  return db.transaction(async (tx): Promise<PatchResult> => {
    const current = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.boardId, boardId), isNull(entries.deletedAt)))
      .limit(1)
    const row = current[0]
    if (!row) {
      return { ok: false, reason: 'notfound' }
    }
    if (patch.content !== undefined && !validateContent(row.type, patch.content)) {
      return { ok: false, reason: 'invalid-content' }
    }

    if (patch.commitVersion) {
      await tx.insert(entryVersions).values({ entryId: id, snapshot: row })
      const keep = await tx
        .select({ id: entryVersions.id })
        .from(entryVersions)
        .where(eq(entryVersions.entryId, id))
        .orderBy(desc(entryVersions.versionAt))
        .limit(VERSION_RETENTION)
      const keepIds = keep.map((k) => k.id)
      if (keepIds.length > 0) {
        await tx
          .delete(entryVersions)
          .where(and(eq(entryVersions.entryId, id), notInArray(entryVersions.id, keepIds)))
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: user.id }
    for (const f of [
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'zIndex',
      'visibility',
      'color',
    ] as const) {
      if (patch[f] !== undefined) {
        updates[f] = patch[f]
      }
    }
    if (patch.content !== undefined) {
      updates.content = patch.content
      updates.searchText = entrySearchText(row.type, patch.content)
    }

    const updated = await tx.update(entries).set(updates).where(eq(entries.id, id)).returning(META)
    return { ok: true, row: updated[0] as EntryMetaRow }
  })
}

/** Duplicate a visible entry at a small offset (new id, same board). */
export async function duplicateEntry(
  db: Database,
  boardId: string,
  user: SessionUser,
  access: BoardAccess,
  id: string,
) {
  const src = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), boardVisibilityWhere(access)))
    .limit(1)
  const row = src[0]
  if (!row) {
    return null
  }
  const inserted = await db
    .insert(entries)
    .values({
      boardId,
      type: row.type,
      x: row.x + 24,
      y: row.y + 24,
      width: row.width,
      height: row.height,
      rotation: row.rotation,
      zIndex: row.zIndex,
      visibility: row.visibility,
      color: row.color,
      content: row.content,
      imageAssetId: row.imageAssetId,
      searchText: row.searchText,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning(META)
  return inserted[0]
}

/** Soft-delete (idempotent), scoped to the board. Returns null if already deleted / missing. */
export async function softDeleteEntry(db: Database, boardId: string, id: string) {
  const rows = await db
    .update(entries)
    .set({ deletedAt: new Date() })
    .where(and(eq(entries.id, id), eq(entries.boardId, boardId), isNull(entries.deletedAt)))
    .returning({ id: entries.id })
  return rows[0] ?? null
}
