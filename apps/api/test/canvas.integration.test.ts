import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

const ZERO = '00000000-0000-0000-0000-000000000000'

async function createEntry(
  ctx: TestApp,
  cookie: string,
  visibility: 'public' | 'private',
): Promise<string> {
  const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'sticky',
      x: 0,
      y: 0,
      width: 240,
      height: 240,
      rotation: 0,
      zIndex: 1,
      visibility,
      content: { text: '' },
    }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' })

describe('connections + strokes (RBAC + both-endpoints visibility)', () => {
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

  const postConn = (cookie: string, body: unknown) =>
    ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections`, {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify(body),
    })
  const listConn = (cookie: string) =>
    ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections`, { headers: { cookie } })

  it('admin connects two entries; viewer cannot (403)', async () => {
    const a = await createEntry(ctx, admin, 'public')
    const b = await createEntry(ctx, admin, 'public')
    const ok = await postConn(admin, { fromEntryId: a, toEntryId: b, label: 'red thread' })
    expect(ok.status).toBe(201)
    const denied = await postConn(viewer, { fromEntryId: a, toEntryId: b })
    expect(denied.status).toBe(403)
  })

  it('rejects a self-connection (400) and a missing endpoint (400)', async () => {
    const a = await createEntry(ctx, admin, 'public')
    expect((await postConn(admin, { fromEntryId: a, toEntryId: a })).status).toBe(400)
    // Board-scoped create requires both endpoints on this board; a missing id → 400 (not 404).
    expect((await postConn(admin, { fromEntryId: a, toEntryId: ZERO })).status).toBe(400)
  })

  it('a viewer only lists connections whose BOTH endpoints are public', async () => {
    const pub1 = await createEntry(ctx, admin, 'public')
    const pub2 = await createEntry(ctx, admin, 'public')
    const priv = await createEntry(ctx, admin, 'private')
    const pp = (await (await postConn(admin, { fromEntryId: pub1, toEntryId: pub2 })).json()) as {
      id: string
    }
    const pv = (await (await postConn(admin, { fromEntryId: pub1, toEntryId: priv })).json()) as {
      id: string
    }

    const adminIds = ((await (await listConn(admin)).json()) as { id: string }[]).map((r) => r.id)
    expect(adminIds).toEqual(expect.arrayContaining([pp.id, pv.id]))

    const viewerIds = ((await (await listConn(viewer)).json()) as { id: string }[]).map((r) => r.id)
    expect(viewerIds).toContain(pp.id)
    expect(viewerIds).not.toContain(pv.id) // touches a private entry → hidden from the viewer
  })

  it('patches and deletes a connection (admin); 404 on unknown id', async () => {
    const a = await createEntry(ctx, admin, 'public')
    const b = await createEntry(ctx, admin, 'public')
    const conn = (await (await postConn(admin, { fromEntryId: a, toEntryId: b })).json()) as {
      id: string
    }
    const patched = await ctx.app.request(
      `/api/boards/${ctx.adminBoardId}/connections/${conn.id}`,
      {
        method: 'PATCH',
        headers: json(admin),
        body: JSON.stringify({ label: 'updated', arrowStart: true }),
      },
    )
    expect(patched.status).toBe(200)
    expect(((await patched.json()) as { label: string }).label).toBe('updated')

    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections/${ZERO}`, {
          method: 'PATCH',
          headers: json(admin),
          body: JSON.stringify({ label: 'x' }),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections/${conn.id}`, {
          method: 'DELETE',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections/${ZERO}`, {
          method: 'DELETE',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(404)
  })

  it('admin creates a board stroke with a server-computed bbox; viewer cannot (403)', async () => {
    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/strokes`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({
        points: [
          [0, 0],
          [10, 20],
          [30, 5],
        ],
        color: '#111',
        size: 8,
        tool: 'pen',
      }),
    })
    expect(res.status).toBe(201)
    const row = (await res.json()) as {
      minX: number
      maxX: number
      maxY: number
      entryId: string | null
    }
    expect(row.minX).toBe(0)
    expect(row.maxX).toBe(30)
    expect(row.maxY).toBe(20)
    expect(row.entryId).toBeNull()

    const denied = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/strokes`, {
      method: 'POST',
      headers: json(viewer),
      body: JSON.stringify({
        points: [
          [0, 0],
          [1, 1],
        ],
        color: '#111',
        size: 8,
        tool: 'pen',
      }),
    })
    expect(denied.status).toBe(403)
  })

  it('viewer lists board-layer strokes; rejects invalid + missing-entry strokes', async () => {
    const list = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/strokes`, {
      headers: { cookie: viewer },
    })
    expect(list.status).toBe(200)
    expect(((await list.json()) as unknown[]).length).toBeGreaterThan(0)

    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/strokes`, {
          method: 'POST',
          headers: json(admin),
          body: '{"points":[]}',
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/strokes`, {
          method: 'POST',
          headers: json(admin),
          body: JSON.stringify({
            entryId: ZERO,
            points: [
              [0, 0],
              [1, 1],
            ],
            color: '#111',
            size: 8,
          }),
        })
      ).status,
    ).toBe(404)
  })
})
