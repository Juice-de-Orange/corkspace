import { entryVersions } from '@corkspace/db/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

describe('entries — CRUD, RBAC, visibility, autosave, versions', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string
  let board: string
  let publicId: string
  let privateId: string

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
    board = `/api/boards/${ctx.adminBoardId}`
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  const createSticky = (cookie: string, text: string, visibility: 'public' | 'private') =>
    ctx.app.request(`${board}/entries`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'sticky',
        x: 0,
        y: 0,
        width: 240,
        height: 240,
        visibility,
        content: { text },
      }),
    })

  it('viewer member cannot create entries (403)', async () => {
    expect((await createSticky(viewer, 'nope', 'public')).status).toBe(403)
  })

  it('admin creates a public and a private sticky', async () => {
    const pub = await createSticky(admin, 'PUBLIC_NOTE', 'public')
    const priv = await createSticky(admin, 'SECRET_NOTE', 'private')
    expect(pub.status).toBe(201)
    expect(priv.status).toBe(201)
    publicId = ((await pub.json()) as { id: string }).id
    privateId = ((await priv.json()) as { id: string }).id
  })

  it('viewer board list excludes the private entry (response-body assertion)', async () => {
    const res = await ctx.app.request(`${board}/entries`, { headers: { cookie: viewer } })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; visibility: string }>
    expect(rows.map((r) => r.id)).toContain(publicId)
    expect(rows.map((r) => r.id)).not.toContain(privateId)
    expect(rows.every((r) => r.visibility === 'public')).toBe(true)
  })

  it('viewer cannot read private content (404); admin can', async () => {
    expect(
      (
        await ctx.app.request(`${board}/entries/${privateId}/content`, {
          headers: { cookie: viewer },
        })
      ).status,
    ).toBe(404)
    const adminRes = await ctx.app.request(`${board}/entries/${privateId}/content`, {
      headers: { cookie: admin },
    })
    expect(adminRes.status).toBe(200)
    expect(((await adminRes.json()) as { content: { text: string } }).content.text).toBe(
      'SECRET_NOTE',
    )
  })

  it('admin autosave moves the entry (last-write-wins)', async () => {
    const res = await ctx.app.request(`${board}/entries/${publicId}`, {
      method: 'PATCH',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ x: 500, y: 300, rev: 1 }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { x: number }).x).toBe(500)
  })

  it('content commits capture entry_versions (within retention)', async () => {
    for (let i = 0; i < 3; i++) {
      await ctx.app.request(`${board}/entries/${publicId}`, {
        method: 'PATCH',
        headers: { cookie: admin, 'content-type': 'application/json' },
        body: JSON.stringify({ content: { text: `v${i}` }, commitVersion: true }),
      })
    }
    const rows = await ctx.testDb.db
      .select()
      .from(entryVersions)
      .where(eq(entryVersions.entryId, publicId))
    expect(rows.length).toBe(3)
  })

  it('viewer cannot patch (403); unauthenticated cannot list (401)', async () => {
    const patch = await ctx.app.request(`${board}/entries/${publicId}`, {
      method: 'PATCH',
      headers: { cookie: viewer, 'content-type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    })
    expect(patch.status).toBe(403)
    expect((await ctx.app.request(`${board}/entries`)).status).toBe(401)
  })

  it('duplicate creates an offset copy', async () => {
    const res = await ctx.app.request(`${board}/entries/${publicId}/duplicate`, {
      method: 'POST',
      headers: { cookie: admin },
    })
    expect(res.status).toBe(201)
    const dup = (await res.json()) as { id: string; x: number }
    expect(dup.id).not.toBe(publicId)
    expect(dup.x).toBe(524)
  })

  it('soft-delete removes the entry from the board list', async () => {
    expect(
      (
        await ctx.app.request(`${board}/entries/${privateId}`, {
          method: 'DELETE',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(200)
    const list = await ctx.app.request(`${board}/entries`, { headers: { cookie: admin } })
    const ids = ((await list.json()) as Array<{ id: string }>).map((r) => r.id)
    expect(ids).not.toContain(privateId)
  })

  it('rejects invalid create content (400)', async () => {
    const res = await ctx.app.request(`${board}/entries`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'link',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        content: { url: 'nope' },
      }),
    })
    expect(res.status).toBe(400)
  })

  it('batch lazy content returns visible content; empty ids → []', async () => {
    const res = await ctx.app.request(`${board}/entries/content`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [publicId] }),
    })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string }>
    expect(rows.some((r) => r.id === publicId)).toBe(true)

    const empty = await ctx.app.request(`${board}/entries/content`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })
    expect(await empty.json()).toEqual([])
  })

  it('beacon flush persists a patch and returns 204', async () => {
    const res = await ctx.app.request(`${board}/entries/${publicId}/beacon`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ x: 777 }),
    })
    expect(res.status).toBe(204)
    const list = await ctx.app.request(`${board}/entries`, { headers: { cookie: admin } })
    const row = ((await list.json()) as Array<{ id: string; x: number }>).find(
      (r) => r.id === publicId,
    )
    expect(row?.x).toBe(777)
  })

  it('patch rejects invalid content (400) and a missing entry (404)', async () => {
    const bad = await ctx.app.request(`${board}/entries/${publicId}`, {
      method: 'PATCH',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ content: { text: 12345 } }),
    })
    expect(bad.status).toBe(400)

    const missing = await ctx.app.request(`${board}/entries/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    })
    expect(missing.status).toBe(404)
  })

  it('duplicate / delete of a missing entry → 404', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000'
    expect(
      (
        await ctx.app.request(`${board}/entries/${missingId}/duplicate`, {
          method: 'POST',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await ctx.app.request(`${board}/entries/${missingId}`, {
          method: 'DELETE',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(404)
  })
})
