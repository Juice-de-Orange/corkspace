import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminCreds,
  createTestApp,
  createUserAccount,
  login,
  type TestApp,
  viewerCreds,
} from './helpers/app'

// A real 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNo+A8AAgIBgP3y/PQAAAAASUVORK5CYII=',
  'base64',
)

function uploadForm(buf: Buffer, name: string, type: string): FormData {
  const fd = new FormData()
  fd.append('file', new File([buf], name, { type }))
  return fd
}

describe('assets — upload, from-url, serve, RBAC + visibility', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string
  let assetId: string
  let urlAssetId: string

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('viewer cannot upload (403)', async () => {
    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/assets`, {
      method: 'POST',
      headers: { cookie: viewer },
      body: uploadForm(PNG_1x1, 'a.png', 'image/png'),
    })
    expect(res.status).toBe(403)
  })

  it('admin uploads a valid PNG (201, pending)', async () => {
    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/assets`, {
      method: 'POST',
      headers: { cookie: admin },
      body: uploadForm(PNG_1x1, 'a.png', 'image/png'),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; status: string }
    expect(body.status).toBe('pending')
    assetId = body.id
  })

  it('rejects a non-image upload by magic bytes (415)', async () => {
    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/assets`, {
      method: 'POST',
      headers: { cookie: admin },
      body: uploadForm(Buffer.from('this is not an image'), 'a.txt', 'image/png'),
    })
    expect(res.status).toBe(415)
  })

  it('enqueues a from-url asset (201) and rejects an invalid url (400)', async () => {
    const ok = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/assets/from-url`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/cat.png' }),
    })
    expect(ok.status).toBe(201)
    urlAssetId = ((await ok.json()) as { id: string }).id

    const bad = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/assets/from-url`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    })
    expect(bad.status).toBe(400)
  })

  it('reports asset status', async () => {
    const res = await ctx.app.request(`/api/assets/${assetId}/status`, {
      headers: { cookie: admin },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('pending')
  })

  it('admin can serve the uploaded original (image/png)', async () => {
    const res = await ctx.app.request(`/api/assets/${assetId}`, { headers: { cookie: admin } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer()).length).toBe(PNG_1x1.length)
  })

  it('viewer cannot fetch an unreferenced asset (404)', async () => {
    const res = await ctx.app.request(`/api/assets/${assetId}`, { headers: { cookie: viewer } })
    expect(res.status).toBe(404)
  })

  it('serving a not-yet-processed from-url asset → 404 not ready', async () => {
    const res = await ctx.app.request(`/api/assets/${urlAssetId}`, { headers: { cookie: admin } })
    expect(res.status).toBe(404)
  })

  it('returns 404 for a missing asset', async () => {
    const res = await ctx.app.request('/api/assets/00000000-0000-0000-0000-000000000000', {
      headers: { cookie: admin },
    })
    expect(res.status).toBe(404)
  })

  describe('image entries reference only assets of their own board (#5)', () => {
    const createImage = (cookie: string, boardId: string, imageAssetId: string) =>
      ctx.app.request(`/api/boards/${boardId}/entries`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          content: {},
          imageAssetId,
        }),
      })

    it('accepts an asset uploaded to the same board', async () => {
      const res = await createImage(admin, ctx.adminBoardId, assetId)
      expect(res.status).toBe(201)
      expect(((await res.json()) as { imageAssetId: string }).imageAssetId).toBe(assetId)
    })

    it('rejects an asset id that does not exist (400, not a foreign-key 500)', async () => {
      const res = await createImage(admin, ctx.adminBoardId, '00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(400)
    })

    it("rejects another board's asset (400) and creates no entry", async () => {
      const other = { email: 'other-owner@example.com', password: 'other-password-123', name: 'O' }
      const { boardId: otherBoard } = await createUserAccount(ctx.testDb.db, other)
      const otherCookie = await login(ctx.app, other.email, other.password)
      const up = await ctx.app.request(`/api/boards/${otherBoard}/assets`, {
        method: 'POST',
        headers: { cookie: otherCookie },
        body: uploadForm(PNG_1x1, 'b.png', 'image/png'),
      })
      expect(up.status).toBe(201)
      const foreignAsset = ((await up.json()) as { id: string }).id

      const before = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
        headers: { cookie: admin },
      })
      const countBefore = ((await before.json()) as unknown[]).length
      const res = await createImage(admin, ctx.adminBoardId, foreignAsset)
      expect(res.status).toBe(400)
      const after = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
        headers: { cookie: admin },
      })
      expect(((await after.json()) as unknown[]).length).toBe(countBefore)
    })
  })
})
