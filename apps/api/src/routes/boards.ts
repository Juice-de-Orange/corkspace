import {
  createShareSchema,
  inviteMemberSchema,
  patchBoardSchema,
  patchMemberSchema,
} from '@corkspace/shared'
import { Hono } from 'hono'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireAuth } from '../middleware/auth'
import { boardContext, requireBoardOwner } from '../middleware/board'
import type { BoardAccess } from '../services/board-access'
import {
  createShare,
  getBoardMeta,
  inviteMember,
  listBoardsForUser,
  listMembers,
  listShares,
  patchBoard,
  patchMember,
  removeMember,
  revokeShare,
} from '../services/board-service'
import { assetsUploadRoute } from './assets'
import { connectionsRoute } from './connections'
import { dashboardRoute } from './dashboard'
import { entriesRoute } from './entries'
import { framesRoute } from './frames'
import { strokesRoute } from './strokes'
import { tagsRoute } from './tags'
import { teleportsRoute } from './teleports'

export function boardsRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // My boards: owned + shared-with-me (super-admin additionally sees all).
  r.get('/', requireAuth, async (c) => {
    const user = c.get('user') as SessionUser
    return c.json(await listBoardsForUser(db, user))
  })

  // Everything under /:boardId resolves board access once (404 if none).
  const scoped = new Hono<AppEnv>()
  scoped.use('*', requireAuth, boardContext(deps))

  // Board meta + my access + raw/global/effective settings (for the account-settings UI).
  scoped.get('/', async (c) => {
    const boardId = c.get('boardId') as string
    const access = c.get('access') as BoardAccess
    const meta = await getBoardMeta(db, boardId)
    if (!meta) {
      return c.json({ error: 'Not found' }, 404)
    }
    return c.json({
      ...meta,
      access: {
        level: access.level,
        canEdit: access.canEdit,
        canSeePrivate: access.canSeePrivate,
        canSeeFurniture: access.canSeeFurniture,
        isSuperAdmin: access.isSuperAdmin,
      },
    })
  })

  scoped.patch('/', requireBoardOwner, async (c) => {
    const boardId = c.get('boardId') as string
    const parsed = patchBoardSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    await patchBoard(db, boardId, parsed.data)
    return c.json({ ok: true })
  })

  // ---- Members (owner only) ----
  scoped.get('/members', requireBoardOwner, async (c) =>
    c.json(await listMembers(db, c.get('boardId') as string)),
  )
  scoped.post('/members', requireBoardOwner, async (c) => {
    const boardId = c.get('boardId') as string
    const user = c.get('user') as SessionUser
    const parsed = inviteMemberSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    const res = await inviteMember(db, boardId, user.id, parsed.data)
    if (!res.ok) {
      return c.json({ error: res.reason }, res.reason === 'notfound' ? 404 : 400)
    }
    return c.json({ ok: true }, 201)
  })
  scoped.patch('/members/:userId', requireBoardOwner, async (c) => {
    const parsed = patchMemberSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid' }, 400)
    }
    const ok = await patchMember(db, c.get('boardId') as string, c.req.param('userId'), parsed.data)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
  scoped.delete('/members/:userId', requireBoardOwner, async (c) => {
    const ok = await removeMember(db, c.get('boardId') as string, c.req.param('userId'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ---- Shares / external links (owner only) ----
  scoped.get('/shares', requireBoardOwner, async (c) =>
    c.json(await listShares(db, c.get('boardId') as string)),
  )
  scoped.post('/shares', requireBoardOwner, async (c) => {
    const boardId = c.get('boardId') as string
    const user = c.get('user') as SessionUser
    const parsed = createShareSchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) {
      return c.json({ error: 'invalid' }, 400)
    }
    return c.json(await createShare(db, boardId, user.id, parsed.data), 201)
  })
  scoped.delete('/shares/:id', requireBoardOwner, async (c) => {
    const ok = await revokeShare(db, c.get('boardId') as string, c.req.param('id'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // ---- Board-scoped content subtrees ----
  scoped.route('/entries', entriesRoute(deps))
  scoped.route('/connections', connectionsRoute(deps))
  scoped.route('/strokes', strokesRoute(deps))
  scoped.route('/tags', tagsRoute(deps))
  scoped.route('/frames', framesRoute(deps))
  scoped.route('/teleports', teleportsRoute(deps))
  scoped.route('/dashboard', dashboardRoute(deps))
  scoped.route('/assets', assetsUploadRoute(deps))

  r.route('/:boardId', scoped)
  return r
}
