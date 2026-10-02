import { connections, frames, strokes, tags, teleports } from '@corkspace/db/schema'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { publicTokenContext } from '../middleware/board'
import { type BoardAccess, visibleEntryExists } from '../services/board-access'
import { getEffectiveBoardSettings } from '../services/board-service'
import { getEntryContent, listEntryMetaWithTags } from '../services/entry-service'
import { serveAssetForAccess } from './assets'

/**
 * External, account-less read tree at /api/public/:token/*. GET-only by construction — there is no
 * mutation handler here, so an external link can NEVER write. publicTokenContext resolves the token
 * to viewer access (public-only) on exactly one board; private entries never leak.
 */
export function publicRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  r.use('/:token/*', publicTokenContext(deps))

  r.get('/:token/board', async (c) => {
    const boardId = c.get('boardId') as string
    return c.json({ boardId, effectiveSettings: await getEffectiveBoardSettings(db, boardId) })
  })

  r.get('/:token/entries', async (c) => {
    const access = c.get('access') as BoardAccess
    return c.json(await listEntryMetaWithTags(db, access))
  })

  r.get('/:token/entries/:id/content', async (c) => {
    const access = c.get('access') as BoardAccess
    const row = await getEntryContent(db, access, c.req.param('id'))
    return row ? c.json(row) : c.json({ error: 'Not found' }, 404)
  })

  r.get('/:token/connections', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    return c.json(
      await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.boardId, boardId),
            visibleEntryExists(db, connections.fromEntryId, access),
            visibleEntryExists(db, connections.toEntryId, access),
          ),
        ),
    )
  })

  r.get('/:token/strokes', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    const entryVisible = visibleEntryExists(db, strokes.entryId, access)
    const cond = access.canSeeFurniture ? or(isNull(strokes.entryId), entryVisible) : entryVisible
    return c.json(
      await db
        .select()
        .from(strokes)
        .where(and(eq(strokes.boardId, boardId), cond)),
    )
  })

  r.get('/:token/frames', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    if (!access.canSeeFurniture) {
      return c.json([])
    }
    return c.json(await db.select().from(frames).where(eq(frames.boardId, boardId)))
  })

  r.get('/:token/teleports', async (c) => {
    const access = c.get('access') as BoardAccess
    const boardId = c.get('boardId') as string
    if (!access.canSeeFurniture) {
      return c.json([])
    }
    return c.json(await db.select().from(teleports).where(eq(teleports.boardId, boardId)))
  })

  r.get('/:token/tags', async (c) => {
    const boardId = c.get('boardId') as string
    return c.json(await db.select().from(tags).where(eq(tags.boardId, boardId)))
  })

  r.get('/:token/assets/:id', async (c) => {
    const access = c.get('access') as BoardAccess
    return serveAssetForAccess(c, deps, c.req.param('id'), access)
  })

  return r
}
