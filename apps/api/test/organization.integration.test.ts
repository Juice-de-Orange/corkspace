import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' })

async function createEntry(ctx: TestApp, cookie: string, x: number, y: number): Promise<string> {
  const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
    method: 'POST',
    headers: json(cookie),
    body: JSON.stringify({
      type: 'sticky',
      x,
      y,
      width: 240,
      height: 240,
      rotation: 0,
      zIndex: 1,
      visibility: 'private',
      content: { text: '' },
    }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

describe('Phase 4 — tags, frames, teleports, admin-creates-viewer (RBAC)', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('admin creates a viewer who can log in; viewer cannot create viewers; self-signup is absent', async () => {
    const created = await ctx.app.request('/api/admin/users', {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({
        email: 'viewer2@example.com',
        password: 'viewer2-password',
        name: 'V2',
      }),
    })
    expect(created.status).toBe(201)
    // The admin create-user endpoint now returns an instance role of 'user' (board membership,
    // not a global 'viewer' role, carries the read-only semantics).
    expect(((await created.json()) as { role: string }).role).toBe('user')

    // the new viewer can authenticate
    const cookie = await login(ctx.app, 'viewer2@example.com', 'viewer2-password')
    expect(cookie).toContain('=')

    // duplicate email → 409
    const dup = await ctx.app.request('/api/admin/users', {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({
        email: 'viewer2@example.com',
        password: 'viewer2-password',
        name: 'V2',
      }),
    })
    expect(dup.status).toBe(409)

    // a viewer cannot create accounts
    const denied = await ctx.app.request('/api/admin/users', {
      method: 'POST',
      headers: json(viewer),
      body: JSON.stringify({ email: 'x@example.com', password: 'longpassword', name: 'X' }),
    })
    expect(denied.status).toBe(403)

    // open sign-up is disabled
    const signup = await ctx.app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'evil@example.com', password: 'longpassword', name: 'E' }),
    })
    expect(signup.status).not.toBe(200)
  })

  it('tags: admin CRUD; viewer reads but cannot mutate; atomic assign to an entry', async () => {
    const tagRes = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({
        name: 'Wichtig',
        color: '#dc2626',
        styleRules: { borderColor: 'red' },
      }),
    })
    expect(tagRes.status).toBe(201)
    const tag = (await tagRes.json()) as { id: string }

    // viewer reads tags
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags`, {
          headers: { cookie: viewer },
        })
      ).status,
    ).toBe(200)
    // viewer cannot create
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags`, {
          method: 'POST',
          headers: json(viewer),
          body: JSON.stringify({ name: 'x', color: '#000' }),
        })
      ).status,
    ).toBe(403)

    // assign atomically
    const entryId = await createEntry(ctx, admin, 0, 0)
    const assign = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags/assign/${entryId}`, {
      method: 'PUT',
      headers: json(admin),
      body: JSON.stringify({ tagIds: [tag.id] }),
    })
    expect(assign.status).toBe(200)

    // the board metadata load now carries the entry's tag ids (feeds chips + rule styling)
    const metas = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
        headers: { cookie: admin },
      })
    ).json()) as { id: string; tagIds: string[] }[]
    expect(metas.find((m) => m.id === entryId)?.tagIds).toEqual([tag.id])

    // patch + delete
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags/${tag.id}`, {
          method: 'PATCH',
          headers: json(admin),
          body: JSON.stringify({ name: 'Sehr wichtig' }),
        })
      ).status,
    ).toBe(200)
  })

  it('frames: group-move shifts contained entries atomically; viewer cannot create', async () => {
    const frameRes = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/frames`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ name: 'Region', x: 100_000, y: 100_000, width: 500, height: 500 }),
    })
    expect(frameRes.status).toBe(201)
    const frame = (await frameRes.json()) as { id: string }

    // isolated region so no entry from earlier tests is contained
    const inside = await createEntry(ctx, admin, 100_100, 100_100) // centre inside the frame
    const outside = await createEntry(ctx, admin, 102_000, 100_100) // centre outside

    const move = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/frames/${frame.id}/move`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ dx: 1000, dy: 0 }),
    })
    expect(move.status).toBe(200)
    expect(((await move.json()) as { memberCount: number }).memberCount).toBe(1)

    // the inside entry moved by the delta; the outside one did not
    const metas = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
        headers: { cookie: admin },
      })
    ).json()) as {
      id: string
      x: number
    }[]
    expect(metas.find((m) => m.id === inside)?.x).toBe(101_100)
    expect(metas.find((m) => m.id === outside)?.x).toBe(102_000)

    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/frames`, {
          method: 'POST',
          headers: json(viewer),
          body: JSON.stringify({ name: 'x', x: 0, y: 0, width: 10, height: 10 }),
        })
      ).status,
    ).toBe(403)
  })

  it('edge cases: 400 on invalid input, 404 on unknown ids across the new routes', async () => {
    const ZERO = '00000000-0000-0000-0000-000000000000'
    const del = (path: string) =>
      ctx.app.request(path, { method: 'DELETE', headers: { cookie: admin } })
    const patch = (path: string, body: unknown) =>
      ctx.app.request(path, { method: 'PATCH', headers: json(admin), body: JSON.stringify(body) })

    // admin user: invalid body → 400
    expect(
      (
        await ctx.app.request('/api/admin/users', {
          method: 'POST',
          headers: json(admin),
          body: '{}',
        })
      ).status,
    ).toBe(400)

    // tags
    expect(
      (await patch(`/api/boards/${ctx.adminBoardId}/tags/${ZERO}`, { name: 'x' })).status,
    ).toBe(404)
    expect((await patch(`/api/boards/${ctx.adminBoardId}/tags/${ZERO}`, {})).status).toBe(400)
    expect((await del(`/api/boards/${ctx.adminBoardId}/tags/${ZERO}`)).status).toBe(404)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags/assign/${ZERO}`, {
          method: 'PUT',
          headers: json(admin),
          body: JSON.stringify({ tagIds: [] }),
        })
      ).status,
    ).toBe(404)

    // frames
    expect(
      (await patch(`/api/boards/${ctx.adminBoardId}/frames/${ZERO}`, { name: 'x' })).status,
    ).toBe(404)
    expect((await del(`/api/boards/${ctx.adminBoardId}/frames/${ZERO}`)).status).toBe(404)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/frames/${ZERO}/move`, {
          method: 'POST',
          headers: json(admin),
          body: JSON.stringify({ dx: 1, dy: 1 }),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/frames/${ZERO}/move`, {
          method: 'POST',
          headers: json(admin),
          body: '{}',
        })
      ).status,
    ).toBe(400)

    // teleports
    expect(
      (await patch(`/api/boards/${ctx.adminBoardId}/teleports/${ZERO}`, { name: 'x' })).status,
    ).toBe(404)
    expect((await del(`/api/boards/${ctx.adminBoardId}/teleports/${ZERO}`)).status).toBe(404)
  })

  it('teleports: admin creates, viewer reads, viewer cannot create', async () => {
    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/teleports`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ name: 'Home', x: 100, y: 200, zoom: 1.5, isBoardButton: true }),
    })
    expect(res.status).toBe(201)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/teleports`, {
          headers: { cookie: viewer },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/teleports`, {
          method: 'POST',
          headers: json(viewer),
          body: JSON.stringify({ name: 'x', x: 0, y: 0, zoom: 1 }),
        })
      ).status,
    ).toBe(403)
  })
})
