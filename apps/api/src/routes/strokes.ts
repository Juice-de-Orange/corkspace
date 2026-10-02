import { entries, strokes } from '@corkspace/db/schema'
import { createStrokeSchema, strokePointsBbox } from '@corkspace/shared'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireBoardEditor } from '../middleware/board'
import { type BoardAccess, visibleEntryExists } from '../services/board-access'

/** Mounted under /api/boards/:boardId/strokes. */
export function strokesRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // Board-layer strokes (entry_id null) are "furniture" — shown only if the caller may see it.
  // Entry strokes follow their entry's visibility.
  r.get('/', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    const entryVisible = visibleEntryExists(db, strokes.entryId, access)
    const cond = access.canSeeFurniture ? or(isNull(strokes.entryId), entryVisible) : entryVisible
    const rows = await db
      .select()
      .from(strokes)
      .where(and(eq(strokes.boardId, boardId), cond))
    return c.json(rows)
  })

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = createStrokeSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid stroke', issues: parsed.error.issues }, 400)
    }
    const { entryId, points, color, size, tool } = parsed.data
    if (entryId) {
      const found = await db
        .select({ id: entries.id })
        .from(entries)
        .where(
          and(eq(entries.id, entryId), eq(entries.boardId, boardId), isNull(entries.deletedAt)),
        )
        .limit(1)
      if (found.length === 0) {
        return c.json({ error: 'entry not found' }, 404)
      }
    }
    const bbox = strokePointsBbox(points) // server-computed; never trusted from the client
    const user = c.get('user') as SessionUser
    const rows = await db
      .insert(strokes)
      .values({
        boardId,
        entryId: entryId ?? null,
        points,
        color,
        size,
        tool,
        minX: bbox.minX,
        minY: bbox.minY,
        maxX: bbox.maxX,
        maxY: bbox.maxY,
        createdBy: user.id,
      })
      .returning()
    return c.json(rows[0], 201)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .delete(strokes)
      .where(and(eq(strokes.id, c.req.param('id')), eq(strokes.boardId, boardId)))
      .returning({ id: strokes.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  return r
}
