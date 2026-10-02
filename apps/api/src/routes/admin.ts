import { boards, user as userTable } from '@corkspace/db/schema'
import {
  adminCreateUserSchema,
  adminPatchUserSchema,
  partialSettingsSchema,
} from '@corkspace/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireSuperAdmin } from '../middleware/auth'
import { getAppDefaults, setAppDefaults } from '../services/board-service'
import { createUserWithPassword, deleteUser, getUserById, patchUser } from '../services/users'

/** Super-admin surface (role='admin'): users, global defaults, board overview. */
export function adminRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // Create a user (+ their personal board); a super-admin may create another admin directly. No
  // self-signup exists.
  r.post('/users', requireSuperAdmin, async (c) => {
    const parsed = adminCreateUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    const { role, ...rest } = parsed.data
    const created = await createUserWithPassword(deps.db, { ...rest, role: role ?? 'user' })
    if (!created) {
      return c.json({ error: 'email already exists' }, 409)
    }
    return c.json({ id: created.id, boardId: created.boardId, role: role ?? 'user' }, 201)
  })

  // Update a user (role / name / password). Refuses to demote the last super-admin (lockout guard).
  r.patch('/users/:id', requireSuperAdmin, async (c) => {
    const id = c.req.param('id')
    const parsed = adminPatchUserSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    if (!(await getUserById(db, id))) {
      return c.json({ error: 'not found' }, 404)
    }
    // The last-admin guard is enforced atomically inside patchUser (locks the admin set).
    const result = await patchUser(db, id, parsed.data)
    if (!result.ok) {
      return c.json({ error: result.reason }, 409)
    }
    return c.json({ ok: true })
  })

  // Delete a user (+ cascades). Refuses self-deletion; deleteUser additionally locks the admin set
  // and refuses to remove the last super-admin (guards concurrent cross-deletion of two admins).
  r.delete('/users/:id', requireSuperAdmin, async (c) => {
    const actor = c.get('user') as SessionUser
    const id = c.req.param('id')
    if (id === actor.id) {
      return c.json({ error: 'self_delete' }, 409)
    }
    if (!(await getUserById(db, id))) {
      return c.json({ error: 'not found' }, 404)
    }
    const result = await deleteUser(db, id)
    if (!result.ok) {
      return c.json({ error: result.reason }, 409)
    }
    return c.json({ ok: true })
  })

  r.get('/users', requireSuperAdmin, async (c) => {
    const rows = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        role: userTable.role,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .orderBy(userTable.createdAt)
    return c.json(rows)
  })

  // Global default appearance settings (inherited by every board).
  r.get('/settings', requireSuperAdmin, async (c) => c.json({ defaults: await getAppDefaults(db) }))
  r.put('/settings', requireSuperAdmin, async (c) => {
    const user = c.get('user') as SessionUser
    const parsed = partialSettingsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    }
    await setAppDefaults(db, parsed.data, user.id)
    return c.json({ ok: true })
  })

  // All boards + owner (super-admin overview).
  r.get('/boards', requireSuperAdmin, async (c) => {
    const rows = await db
      .select({
        id: boards.id,
        name: boards.name,
        ownerId: boards.ownerId,
        ownerName: userTable.name,
        ownerEmail: userTable.email,
        createdAt: boards.createdAt,
      })
      .from(boards)
      .innerJoin(userTable, eq(userTable.id, boards.ownerId))
      .orderBy(boards.createdAt)
    return c.json(rows)
  })

  return r
}
