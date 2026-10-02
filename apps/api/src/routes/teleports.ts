import { teleports } from '@corkspace/db/schema'
import { createTeleportSchema } from '@corkspace/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppDeps, AppEnv } from '../app'
import { requireBoardEditor } from '../middleware/board'
import type { BoardAccess } from '../services/board-access'

const patchTeleportSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isBoardButton: z.boolean().optional(),
    icon: z.string().max(32).nullable().optional(),
    color: z.string().max(32).nullable().optional(),
  })
  .strict()

/** Mounted under /api/boards/:boardId/teleports. Teleports are board "furniture". */
export function teleportsRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  r.get('/', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    if (!access.canSeeFurniture) {
      return c.json([])
    }
    return c.json(await db.select().from(teleports).where(eq(teleports.boardId, boardId)))
  })

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = createTeleportSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid teleport', issues: parsed.error.issues }, 400)
    }
    const rows = await db
      .insert(teleports)
      .values({ ...parsed.data, boardId })
      .returning()
    return c.json(rows[0], 201)
  })

  r.patch('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = patchTeleportSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return c.json({ error: 'invalid patch' }, 400)
    }
    const rows = await db
      .update(teleports)
      .set(parsed.data)
      .where(and(eq(teleports.id, c.req.param('id')), eq(teleports.boardId, boardId)))
      .returning()
    return rows[0] ? c.json(rows[0]) : c.json({ error: 'not found' }, 404)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .delete(teleports)
      .where(and(eq(teleports.id, c.req.param('id')), eq(teleports.boardId, boardId)))
      .returning({ id: teleports.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  return r
}
