import { entries, entryTags, tags } from '@corkspace/db/schema'
import { createTagSchema, patchTagSchema, setEntryTagsSchema } from '@corkspace/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { requireBoardEditor } from '../middleware/board'

/** Mounted under /api/boards/:boardId/tags. Tags are per-board; chips show for any board access. */
export function tagsRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  r.get('/', async (c) => {
    const boardId = c.get('boardId') as string
    return c.json(await db.select().from(tags).where(eq(tags.boardId, boardId)))
  })

  r.post('/', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = createTagSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid tag', issues: parsed.error.issues }, 400)
    }
    const rows = await db
      .insert(tags)
      .values({ ...parsed.data, boardId })
      .returning()
    return c.json(rows[0], 201)
  })

  r.patch('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = patchTagSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return c.json({ error: 'invalid patch' }, 400)
    }
    const rows = await db
      .update(tags)
      .set(parsed.data)
      .where(and(eq(tags.id, c.req.param('id')), eq(tags.boardId, boardId)))
      .returning()
    return rows[0] ? c.json(rows[0]) : c.json({ error: 'not found' }, 404)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const rows = await db
      .delete(tags)
      .where(and(eq(tags.id, c.req.param('id')), eq(tags.boardId, boardId)))
      .returning({ id: tags.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Atomically replace an entry's tag set (delete + insert in one transaction). Board-scoped.
  r.put('/assign/:entryId', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const entryId = c.req.param('entryId')
    const parsed = setEntryTagsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    const found = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.boardId, boardId), isNull(entries.deletedAt)))
      .limit(1)
    if (found.length === 0) {
      return c.json({ error: 'entry not found' }, 404)
    }
    // Only tags on this board may be assigned.
    if (parsed.data.tagIds.length > 0) {
      const boardTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.boardId, boardId)))
      const allowed = new Set(boardTags.map((t) => t.id))
      if (parsed.data.tagIds.some((id) => !allowed.has(id))) {
        return c.json({ error: 'unknown tag id' }, 400)
      }
    }
    try {
      await db.transaction(async (tx) => {
        await tx.delete(entryTags).where(eq(entryTags.entryId, entryId))
        if (parsed.data.tagIds.length > 0) {
          await tx.insert(entryTags).values(parsed.data.tagIds.map((tagId) => ({ entryId, tagId })))
        }
      })
    } catch {
      return c.json({ error: 'unknown tag id' }, 400)
    }
    return c.json({ ok: true })
  })

  return r
}
