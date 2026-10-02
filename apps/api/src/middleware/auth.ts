import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'

/** 401 if there is no authenticated user. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

/**
 * 401 if unauthenticated, 403 if the user is not the instance super-admin (`user.role === 'admin'`).
 * Named to distinguish it from the board-level guards (requireBoardEditor/Owner/…): this gates the
 * central /admin surface, NOT per-board editing.
 */
export const requireSuperAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
