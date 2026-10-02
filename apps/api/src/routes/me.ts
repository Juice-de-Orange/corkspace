import { user as userTable } from '@corkspace/db/schema'
import { cameraSchema } from '@corkspace/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { getOwnBoardId, listBoardsForUser } from '../services/board-service'

/**
 * Authed identity + per-user UI state (identity, boards, camera). Auth is checked inline.
 */
export function meRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()

  r.get('/', async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const [defaultBoardId, boards] = await Promise.all([
      getOwnBoardId(deps.db, user.id),
      listBoardsForUser(deps.db, user),
    ])
    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      defaultBoardId,
      boards,
    })
  })

  // Restore-last-camera. Per-user; never leaks across users.
  r.get('/camera', async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const rows = await deps.db
      .select({ camera: userTable.camera })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1)
    return c.json({ camera: rows[0]?.camera ?? null })
  })

  r.put('/camera', async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const body = await c.req.json().catch(() => null)
    const parsed = cameraSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid camera' }, 400)
    }
    await deps.db
      .update(userTable)
      .set({ camera: parsed.data, updatedAt: new Date() })
      .where(eq(userTable.id, user.id))
    return c.json({ ok: true })
  })

  return r
}
