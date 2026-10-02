import { createEntrySchema, patchEntrySchema } from '@corkspace/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireBoardEditor } from '../middleware/board'
import type { BoardAccess } from '../services/board-access'
import {
  createEntry,
  duplicateEntry,
  getEntriesContent,
  getEntryContent,
  listEntryMetaWithTags,
  patchEntry,
  softDeleteEntry,
} from '../services/entry-service'

const idsSchema = z.object({ ids: z.array(z.string().uuid()).max(500) })

/** Mounted under /api/boards/:boardId/entries — boardContext has set { boardId, access }. */
export function entriesRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // Initial board load: metadata + positions only (no heavy content).
  r.get('/', async (c) => {
    const access = c.get('access') as BoardAccess
    return c.json(await listEntryMetaWithTags(db, access))
  })

  // Lazy content for one / many entries (visibility-checked).
  r.get('/:id/content', async (c) => {
    const access = c.get('access') as BoardAccess
    const row = await getEntryContent(db, access, c.req.param('id'))
    return row ? c.json(row) : c.json({ error: 'Not found' }, 404)
  })

  r.post('/content', async (c) => {
    const access = c.get('access') as BoardAccess
    const parsed = idsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Invalid body' }, 400)
    }
    return c.json(await getEntriesContent(db, access, parsed.data.ids))
  })

  r.post('/', requireBoardEditor, async (c) => {
    const user = c.get('user') as SessionUser
    const boardId = c.get('boardId') as string
    const parsed = createEntrySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Invalid entry' }, 400)
    }
    return c.json(await createEntry(db, boardId, user, parsed.data), 201)
  })

  r.patch('/:id', requireBoardEditor, async (c) => {
    const user = c.get('user') as SessionUser
    const boardId = c.get('boardId') as string
    const parsed = patchEntrySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'Invalid patch' }, 400)
    }
    const result = await patchEntry(db, boardId, user, c.req.param('id'), parsed.data)
    if (!result.ok) {
      return result.reason === 'notfound'
        ? c.json({ error: 'Not found' }, 404)
        : c.json({ error: 'Invalid content' }, 400)
    }
    return c.json(result.row)
  })

  // Unload-flush (navigator.sendBeacon). Best-effort; response is ignored by the browser.
  r.post('/:id/beacon', requireBoardEditor, async (c) => {
    const user = c.get('user') as SessionUser
    const boardId = c.get('boardId') as string
    const parsed = patchEntrySchema.safeParse(await c.req.json().catch(() => null))
    if (parsed.success) {
      await patchEntry(db, boardId, user, c.req.param('id'), parsed.data)
    }
    return c.body(null, 204)
  })

  r.post('/:id/duplicate', requireBoardEditor, async (c) => {
    const user = c.get('user') as SessionUser
    const boardId = c.get('boardId') as string
    const access = c.get('access') as BoardAccess
    const row = await duplicateEntry(db, boardId, user, access, c.req.param('id'))
    return row ? c.json(row, 201) : c.json({ error: 'Not found' }, 404)
  })

  r.delete('/:id', requireBoardEditor, async (c) => {
    const boardId = c.get('boardId') as string
    const row = await softDeleteEntry(db, boardId, c.req.param('id'))
    return row ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404)
  })

  return r
}
