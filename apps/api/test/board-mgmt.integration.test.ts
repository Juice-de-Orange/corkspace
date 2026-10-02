import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminCreds,
  createTestApp,
  createUserAccount,
  login,
  type TestApp,
  viewerCreds,
} from './helpers/app'

/** Board management via the real API: members, external shares, per-board + global settings,
 *  admin overview, and /api/me — the owner-only management surface + settings inheritance. */
describe('board management — members, shares, settings, admin', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string
  let bUser: { id: string; boardId: string }
  let bCookie: string
  let adminBoard: string
  const json = async (r: Response) => (await r.json()) as any
  const owner = () => ({ cookie: admin, 'content-type': 'application/json' })

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
    adminBoard = `/api/boards/${ctx.adminBoardId}`
    bUser = await createUserAccount(ctx.testDb.db, {
      email: 'bmember@example.com',
      password: 'bmember-password-1',
      name: 'B Member',
    })
    bCookie = await login(ctx.app, 'bmember@example.com', 'bmember-password-1')
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('GET /api/me returns the default board + board list', async () => {
    const me = await json(await ctx.app.request('/api/me', { headers: { cookie: admin } }))
    expect(me.defaultBoardId).toBe(ctx.adminBoardId)
    expect(me.boards.some((b: any) => b.id === ctx.adminBoardId && b.level === 'owner')).toBe(true)
  })

  it('GET /api/boards/:id returns access + raw/global/effective settings', async () => {
    const res = await ctx.app.request(adminBoard, { headers: { cookie: admin } })
    expect(res.status).toBe(200)
    const b = await json(res)
    expect(b.access.level).toBe('owner')
    expect(b.effectiveSettings.background).toBeDefined()
    expect(b.effectiveSettings.fontSizes.sticky).toBeDefined()
  })

  it('owner patches board name + settings; effective reflects the override', async () => {
    const res = await ctx.app.request(adminBoard, {
      method: 'PATCH',
      headers: owner(),
      body: JSON.stringify({
        name: 'Neu',
        settings: { background: 'paper', fontSizes: { sticky: 48 } },
      }),
    })
    expect(res.status).toBe(200)
    const b = await json(await ctx.app.request(adminBoard, { headers: { cookie: admin } }))
    expect(b.name).toBe('Neu')
    expect(b.rawSettings.background).toBe('paper')
    expect(b.effectiveSettings.background).toBe('paper')
    expect(b.effectiveSettings.fontSizes.sticky).toBe(48)
  })

  it('a non-owner cannot patch the board / manage members / shares (403)', async () => {
    expect(
      (
        await ctx.app.request(adminBoard, {
          method: 'PATCH',
          headers: { cookie: viewer, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'nope' }),
        })
      ).status,
    ).toBe(403)
    expect(
      (await ctx.app.request(`${adminBoard}/members`, { headers: { cookie: viewer } })).status,
    ).toBe(403)
    expect(
      (await ctx.app.request(`${adminBoard}/shares`, { headers: { cookie: viewer } })).status,
    ).toBe(403)
  })

  it('member lifecycle: invite editor → read+mutate → downgrade → remove → lose access', async () => {
    // Before invite, bUser has no access to the admin board.
    expect(
      (await ctx.app.request(`${adminBoard}/entries`, { headers: { cookie: bCookie } })).status,
    ).toBe(404)
    // Invite as editor.
    const inv = await ctx.app.request(`${adminBoard}/members`, {
      method: 'POST',
      headers: owner(),
      body: JSON.stringify({ email: 'bmember@example.com', role: 'editor' }),
    })
    expect(inv.status).toBe(201)
    // Now bUser can read AND create.
    expect(
      (await ctx.app.request(`${adminBoard}/entries`, { headers: { cookie: bCookie } })).status,
    ).toBe(200)
    const created = await ctx.app.request(`${adminBoard}/entries`, {
      method: 'POST',
      headers: { cookie: bCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'sticky', x: 0, y: 0, width: 240, height: 240, content: {} }),
    })
    expect(created.status).toBe(201)
    // Owner lists members.
    const members = await json(
      await ctx.app.request(`${adminBoard}/members`, { headers: { cookie: admin } }),
    )
    expect(members.some((m: any) => m.email === 'bmember@example.com' && m.role === 'editor')).toBe(
      true,
    )
    // Downgrade to viewer → can read but not mutate.
    const patched = await ctx.app.request(`${adminBoard}/members/${bUser.id}`, {
      method: 'PATCH',
      headers: owner(),
      body: JSON.stringify({ role: 'viewer' }),
    })
    expect(patched.status).toBe(200)
    const mutate = await ctx.app.request(`${adminBoard}/entries`, {
      method: 'POST',
      headers: { cookie: bCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'sticky', x: 0, y: 0, width: 240, height: 240, content: {} }),
    })
    expect(mutate.status).toBe(403)
    // Remove → lose access entirely.
    const removed = await ctx.app.request(`${adminBoard}/members/${bUser.id}`, {
      method: 'DELETE',
      headers: owner(),
    })
    expect(removed.status).toBe(200)
    expect(
      (await ctx.app.request(`${adminBoard}/entries`, { headers: { cookie: bCookie } })).status,
    ).toBe(404)
  })

  it('share lifecycle: create token → public read works → revoke → token dead', async () => {
    const created = await json(
      await ctx.app.request(`${adminBoard}/shares`, {
        method: 'POST',
        headers: owner(),
        body: JSON.stringify({ label: 'for grandma', showFurniture: true }),
      }),
    )
    expect(created.token).toBeTruthy()
    const token = created.token as string
    const shareId = created.id as string
    // Public read works.
    expect((await ctx.app.request(`/api/public/${token}/entries`)).status).toBe(200)
    const boardMeta = await json(await ctx.app.request(`/api/public/${token}/board`))
    expect(boardMeta.effectiveSettings.background).toBeDefined()
    expect((await ctx.app.request(`/api/public/${token}/tags`)).status).toBe(200)
    // Listed.
    const shares = await json(
      await ctx.app.request(`${adminBoard}/shares`, { headers: { cookie: admin } }),
    )
    expect(shares.some((s: any) => s.id === shareId)).toBe(true)
    // Revoke → dead.
    expect(
      (
        await ctx.app.request(`${adminBoard}/shares/${shareId}`, {
          method: 'DELETE',
          headers: owner(),
        })
      ).status,
    ).toBe(200)
    expect((await ctx.app.request(`/api/public/${token}/entries`)).status).toBe(404)
  })

  it('an invalid public token → 404', async () => {
    expect((await ctx.app.request('/api/public/not-a-real-token/entries')).status).toBe(404)
  })

  it('admin: global defaults inherit into a board; users + boards overview; RBAC', async () => {
    // Set a global default that the admin board does NOT override (doc size).
    const put = await ctx.app.request('/api/admin/settings', {
      method: 'PUT',
      headers: owner(),
      body: JSON.stringify({ fontSizes: { doc: 41 } }),
    })
    expect(put.status).toBe(200)
    const defaults = await json(
      await ctx.app.request('/api/admin/settings', { headers: { cookie: admin } }),
    )
    expect(defaults.defaults.fontSizes.doc).toBe(41)
    // The admin board's effective doc size now reflects the global default (no board override).
    const b = await json(await ctx.app.request(adminBoard, { headers: { cookie: admin } }))
    expect(b.effectiveSettings.fontSizes.doc).toBe(41)
    // Users + boards overview.
    const users = await json(
      await ctx.app.request('/api/admin/users', { headers: { cookie: admin } }),
    )
    expect(users.some((u: any) => u.email === adminCreds.email && u.role === 'admin')).toBe(true)
    const boards = await json(
      await ctx.app.request('/api/admin/boards', { headers: { cookie: admin } }),
    )
    expect(boards.some((bb: any) => bb.id === ctx.adminBoardId)).toBe(true)
    // Non-admin is blocked from every admin endpoint.
    expect(
      (await ctx.app.request('/api/admin/users', { headers: { cookie: viewer } })).status,
    ).toBe(403)
    expect(
      (
        await ctx.app.request('/api/admin/settings', {
          method: 'PUT',
          headers: { cookie: viewer, 'content-type': 'application/json' },
          body: JSON.stringify({ fontSizes: { doc: 10 } }),
        })
      ).status,
    ).toBe(403)
  })
})
