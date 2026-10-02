import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

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
})
