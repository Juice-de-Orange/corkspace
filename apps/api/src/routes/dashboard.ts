import { connections, entries, entryTags, entryVersions, tags } from '@corkspace/db/schema'
import {
  buildGraph,
  type EntryType,
  entrySearchText,
  normalizeSearchParams,
  searchParamsSchema,
  VERSION_RETENTION,
} from '@corkspace/shared'
import {
  and,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { requireBoardEditor, requireBoardPrivate } from '../middleware/board'

/** Mounted under /api/boards/:boardId/dashboard. All reads require canSeePrivate; mutations canEdit. */
export function dashboardRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // Every dashboard surface exposes private content → owner/editor/super-admin only.
  r.use('*', requireBoardPrivate)

  // Full-text + faceted search (board-scoped). Ranks by ts_rank_cd, snippets via ts_headline.
  r.post('/search', async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = searchParamsSchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    const p = normalizeSearchParams(parsed.data)
    const { q, types, tagIds, includeDeleted } = p
    const conds: SQL[] = [eq(entries.boardId, boardId)]
    if (!includeDeleted) {
      conds.push(isNull(entries.deletedAt))
    }
    if (q) {
      // Match on the full-text vector OR on a tag name (case-insensitive substring) so
      // searching a tag's name surfaces the entries carrying that tag on this board.
      const tsMatch = sql`${entries.searchVector} @@ websearch_to_tsquery('simple', ${q})`
      const tagMatch = exists(
        db
          .select({ n: sql`1` })
          .from(entryTags)
          .innerJoin(tags, eq(tags.id, entryTags.tagId))
          .where(
            and(
              eq(entryTags.entryId, entries.id),
              eq(tags.boardId, boardId),
              sql`${tags.name} ilike ${`%${q}%`}`,
            ),
          ),
      )
      const textCond = or(tsMatch, tagMatch)
      if (textCond) {
        conds.push(textCond)
      }
    }
    if (types) {
      conds.push(inArray(entries.type, types))
    }
    if (tagIds) {
      conds.push(
        exists(
          db
            .select({ n: sql`1` })
            .from(entryTags)
            .where(and(eq(entryTags.entryId, entries.id), inArray(entryTags.tagId, tagIds))),
        ),
      )
    }
    if (p.createdAfter) {
      conds.push(gte(entries.createdAt, new Date(p.createdAfter)))
    }
    if (p.createdBefore) {
      conds.push(lte(entries.createdAt, new Date(p.createdBefore)))
    }
    if (p.region) {
      const rg = p.region
      conds.push(
        gte(entries.x, rg.minX),
        lte(entries.x, rg.maxX),
        gte(entries.y, rg.minY),
        lte(entries.y, rg.maxY),
      )
    }
    if (p.linkStatus) {
      const linked = sql`exists (select 1 from connections cn where cn.from_entry_id = ${entries.id} or cn.to_entry_id = ${entries.id})`
      conds.push(p.linkStatus === 'linked' ? linked : sql`not ${linked}`)
    }
    const snippet = q
      ? sql<string>`ts_headline('simple', ${entries.searchText}, websearch_to_tsquery('simple', ${q}), 'MaxFragments=1,MaxWords=14,MinWords=3')`
      : sql<string>`left(${entries.searchText}, 80)`
    const order = q
      ? desc(sql`ts_rank_cd(${entries.searchVector}, websearch_to_tsquery('simple', ${q}))`)
      : desc(entries.updatedAt)
    const rows = await db
      .select({
        id: entries.id,
        type: entries.type,
        x: entries.x,
        y: entries.y,
        width: entries.width,
        height: entries.height,
        snippet,
      })
      .from(entries)
      .where(and(...conds))
      .orderBy(order)
      .limit(100)
    return c.json(rows)
  })

  r.get('/trash', async (c) => {
    const boardId = c.get('boardId') as string
    return c.json(
      await db
        .select({
          id: entries.id,
          type: entries.type,
          deletedAt: entries.deletedAt,
          snippet: sql<string>`left(${entries.searchText}, 80)`,
        })
        .from(entries)
        .where(and(eq(entries.boardId, boardId), isNotNull(entries.deletedAt)))
        .orderBy(desc(entries.deletedAt)),
    )
  })

  r.post('/entries/:id/restore', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .update(entries)
      .set({ deletedAt: null })
      .where(
        and(
          eq(entries.id, c.req.param('id')),
          eq(entries.boardId, boardId),
          isNotNull(entries.deletedAt),
        ),
      )
      .returning({ id: entries.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  r.get('/entries/:id/versions', async (c) => {
    const boardId = c.get('boardId') as string
    const id = c.req.param('id')
    const owner = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.boardId, boardId)))
      .limit(1)
    if (owner.length === 0) {
      return c.json({ error: 'not found' }, 404)
    }
    return c.json(
      await db
        .select({ id: entryVersions.id, versionAt: entryVersions.versionAt })
        .from(entryVersions)
        .where(eq(entryVersions.entryId, id))
        .orderBy(desc(entryVersions.versionAt)),
    )
  })

  // Restore a prior version: capture the current state (pruned) then set content from the snapshot.
  r.post('/entries/:id/versions/:vid/restore', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const id = c.req.param('id')
    const vid = c.req.param('vid')
    const result = await db.transaction(async (tx) => {
      const erows = await tx
        .select()
        .from(entries)
        .where(and(eq(entries.id, id), eq(entries.boardId, boardId)))
        .limit(1)
      const current = erows[0]
      const vrows = await tx
        .select()
        .from(entryVersions)
        .where(and(eq(entryVersions.id, vid), eq(entryVersions.entryId, id)))
        .limit(1)
      const version = vrows[0]
      if (!version || !current) {
        return null
      }
      await tx.insert(entryVersions).values({ entryId: id, snapshot: current })
      const keep = await tx
        .select({ id: entryVersions.id })
        .from(entryVersions)
        .where(eq(entryVersions.entryId, id))
        .orderBy(desc(entryVersions.versionAt))
        .limit(VERSION_RETENTION)
      await tx.delete(entryVersions).where(
        and(
          eq(entryVersions.entryId, id),
          notInArray(
            entryVersions.id,
            keep.map((k) => k.id),
          ),
        ),
      )
      const snap = version.snapshot as { content: unknown; type: EntryType }
      await tx
        .update(entries)
        .set({
          content: snap.content,
          searchText: entrySearchText(snap.type, snap.content),
          updatedAt: new Date(),
        })
        .where(eq(entries.id, id))
      return { ok: true }
    })
    return result ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Connection graph (board-scoped): live entries as nodes, connections as edges.
  r.get('/graph', async (c) => {
    const boardId = c.get('boardId') as string
    const nodeRows = await db
      .select({
        id: entries.id,
        type: entries.type,
        x: entries.x,
        y: entries.y,
        width: entries.width,
        height: entries.height,
      })
      .from(entries)
      .where(and(eq(entries.boardId, boardId), isNull(entries.deletedAt)))
    const edgeRows = await db
      .select({ id: connections.id, from: connections.fromEntryId, to: connections.toEntryId })
      .from(connections)
      .where(eq(connections.boardId, boardId))
    return c.json(buildGraph(nodeRows, edgeRows))
  })

  r.get('/stats', async (c) => {
    const boardId = c.get('boardId') as string
    const count = async (extra: SQL) => {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(entries)
        .where(and(eq(entries.boardId, boardId), extra))
      return rows[0]?.n ?? 0
    }
    const conn = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(connections)
      .where(eq(connections.boardId, boardId))
    return c.json({
      entries: await count(isNull(entries.deletedAt)),
      deleted: await count(isNotNull(entries.deletedAt)),
      connections: conn[0]?.n ?? 0,
    })
  })

  // Orphans: live entries (this board) with no tag and no connection.
  r.get('/orphans', async (c) => {
    const boardId = c.get('boardId') as string
    return c.json(
      await db
        .select({
          id: entries.id,
          type: entries.type,
          x: entries.x,
          y: entries.y,
          width: entries.width,
          height: entries.height,
        })
        .from(entries)
        .where(
          and(
            eq(entries.boardId, boardId),
            isNull(entries.deletedAt),
            sql`not exists (select 1 from entry_tags et where et.entry_id = ${entries.id})`,
            sql`not exists (select 1 from connections cn where cn.from_entry_id = ${entries.id} or cn.to_entry_id = ${entries.id})`,
          ),
        ),
    )
  })

  return r
}
