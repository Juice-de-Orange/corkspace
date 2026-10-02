import type { MiddlewareHandler } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { resolveBoardAccess, resolveShareToken } from '../services/board-access'

/**
 * Resolve the caller's access to the `:boardId` in the URL and put `{ boardId, access }` on the
 * context. 404 (not 403) when the caller has NO access — never reveal a board's existence.
 * Requires an authenticated session (mount after requireAuth).
 */
export function boardContext(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const boardId = c.req.param('boardId')
    if (!boardId) {
      return c.json({ error: 'board required' }, 400)
    }
    const access = await resolveBoardAccess(deps.db, user, boardId)
    if (access.level === 'none') {
      return c.json({ error: 'Not found' }, 404)
    }
    c.set('boardId', boardId)
    c.set('access', access)
    await next()
  }
}

/** 403 unless the caller may edit this board (owner or editor). */
export const requireBoardEditor: MiddlewareHandler<AppEnv> = async (c, next) => {
  const access = c.get('access')
  if (!access) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (!access.canEdit) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

/** 403 unless the caller owns this board (member/share management, rename, settings). */
export const requireBoardOwner: MiddlewareHandler<AppEnv> = async (c, next) => {
  const access = c.get('access')
  if (!access) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (access.level !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

/** 403 unless the caller may see private content (owner, editor, or super-admin) — the dashboard. */
export const requireBoardPrivate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const access = c.get('access')
  if (!access) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (!access.canSeePrivate) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

/**
 * External token read context (no session). Resolves `:token` → viewer access to exactly one
 * board and puts `{ boardId, access }` on the context. 404 on invalid/revoked/expired.
 */
export function publicTokenContext(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = c.req.param('token')
    if (!token) {
      return c.json({ error: 'Not found' }, 404)
    }
    const access = await resolveShareToken(deps.db, token)
    if (!access) {
      return c.json({ error: 'Not found' }, 404)
    }
    c.set('boardId', access.boardId)
    c.set('access', access)
    await next()
  }
}
