import { connections, entries } from '@corkspace/db/schema'
import { createConnectionSchema, patchConnectionSchema } from '@corkspace/shared'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireBoardEditor } from '../middleware/board'
import { type BoardAccess, visibleEntryExists } from '../services/board-access'

/** Mounted under /api/boards/:boardId/connections. */
export function connectionsRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // A connection is visible only when it belongs to the board AND both endpoints are visible.
  r.get('/', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    const rows = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.boardId, boardId),
          visibleEntryExists(db, connections.fromEntryId, access),
          visibleEntryExists(db, connections.toEntryId, access),
        ),
      )
    return c.json(rows)
  })

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = createConnectionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid connection', issues: parsed.error.issues }, 400)
    }
    const { fromEntryId, toEntryId } = parsed.data
    // Both endpoints must exist, not be deleted, AND belong to this board (no cross-board threads).
    const found = await db
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(
          inArray(entries.id, [fromEntryId, toEntryId]),
          eq(entries.boardId, boardId),
          isNull(entries.deletedAt),
        ),
      )
    if (found.length < 2) {
      return c.json({ error: 'both entries must exist on this board' }, 400)
    }
    const user = c.get('user') as SessionUser
    const rows = await db
      .insert(connections)
      .values({ ...parsed.data, boardId, createdBy: user.id })
      .returning()
    return c.json(rows[0], 201)
  })

  r.patch('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = patchConnectionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return c.json({ error: 'invalid patch' }, 400)
    }
    const rows = await db
      .update(connections)
      .set(parsed.data)
      .where(and(eq(connections.id, c.req.param('id')), eq(connections.boardId, boardId)))
      .returning()
    return rows[0] ? c.json(rows[0]) : c.json({ error: 'not found' }, 404)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .delete(connections)
      .where(and(eq(connections.id, c.req.param('id')), eq(connections.boardId, boardId)))
      .returning({ id: connections.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  return r
}
