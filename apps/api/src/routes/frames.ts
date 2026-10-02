import { entries, frames } from '@corkspace/db/schema'
import { createFrameSchema, patchFrameSchema } from '@corkspace/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppDeps, AppEnv } from '../app'
import { requireBoardEditor } from '../middleware/board'
import type { BoardAccess } from '../services/board-access'

const moveSchema = z.object({ dx: z.number().finite(), dy: z.number().finite() }).strict()

/** Mounted under /api/boards/:boardId/frames. Frames are board "furniture". */
export function framesRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  r.get('/', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    if (!access.canSeeFurniture) {
      return c.json([])
    }
    return c.json(await db.select().from(frames).where(eq(frames.boardId, boardId)))
  })

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = createFrameSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid frame', issues: parsed.error.issues }, 400)
    }
    const rows = await db
      .insert(frames)
      .values({ ...parsed.data, boardId })
      .returning()
    return c.json(rows[0], 201)
  })

  r.patch('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = patchFrameSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return c.json({ error: 'invalid patch' }, 400)
    }
    const rows = await db
      .update(frames)
      .set(parsed.data)
      .where(and(eq(frames.id, c.req.param('id')), eq(frames.boardId, boardId)))
      .returning()
    return rows[0] ? c.json(rows[0]) : c.json({ error: 'not found' }, 404)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .delete(frames)
      .where(and(eq(frames.id, c.req.param('id')), eq(frames.boardId, boardId)))
      .returning({ id: frames.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Atomic group-move: shift the frame and every entry (on this board) whose centre is inside it.
  r.post('/:id/move', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = moveSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid move' }, 400)
    }
    const { dx, dy } = parsed.data
    const id = c.req.param('id')
    const moved = await db.transaction(async (tx) => {
      const frameRows = await tx
        .select()
        .from(frames)
        .where(and(eq(frames.id, id), eq(frames.boardId, boardId)))
        .limit(1)
      const frame = frameRows[0]
      if (!frame) {
        return null
      }
      const candidates = await tx
        .select()
        .from(entries)
        .where(and(eq(entries.boardId, boardId), isNull(entries.deletedAt)))
      const members = candidates.filter((e) => {
        const cx = e.x + e.width / 2
        const cy = e.y + e.height / 2
        return (
          cx >= frame.x &&
          cx <= frame.x + frame.width &&
          cy >= frame.y &&
          cy <= frame.y + frame.height
        )
      })
      await tx
        .update(frames)
        .set({ x: frame.x + dx, y: frame.y + dy })
        .where(eq(frames.id, id))
      for (const e of members) {
        await tx
          .update(entries)
          .set({ x: e.x + dx, y: e.y + dy })
          .where(and(eq(entries.id, e.id), isNull(entries.deletedAt)))
      }
      return { memberCount: members.length }
    })
    return moved ? c.json({ ok: true, ...moved }) : c.json({ error: 'not found' }, 404)
  })

  return r
}
