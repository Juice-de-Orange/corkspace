import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

describe('link preview (/api/links/preview)', () => {
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

  const preview = (cookie: string, url: string) =>
    ctx.app.request('/api/links/preview', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })

  it('viewer cannot preview (403)', async () => {
    expect((await preview(viewer, 'https://example.com')).status).toBe(403)
  })

  it('rejects an invalid url (400)', async () => {
    expect((await preview(admin, 'not-a-url')).status).toBe(400)
  })

  it('an SSRF-blocked target degrades to the bare url (no metadata leaked)', async () => {
    const res = await preview(admin, 'https://127.0.0.1/admin')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; title?: string }
    expect(body.url).toBe('https://127.0.0.1/admin')
    expect(body.title).toBeUndefined()
  })
})
