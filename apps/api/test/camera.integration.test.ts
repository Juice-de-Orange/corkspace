import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp } from './helpers/app'

describe('camera persistence (/api/me/camera)', () => {
  let ctx: TestApp
  let cookie: string

  beforeAll(async () => {
    ctx = await createTestApp()
    cookie = await login(ctx.app, adminCreds.email, adminCreds.password)
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('returns null before any save', async () => {
    const res = await ctx.app.request('/api/me/camera', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { camera: unknown }).camera).toBeNull()
  })

  it('persists and returns the camera for the user', async () => {
    const put = await ctx.app.request('/api/me/camera', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ x: -100, y: 200, zoom: 1.5 }),
    })
    expect(put.status).toBe(200)

    const get = await ctx.app.request('/api/me/camera', { headers: { cookie } })
    expect(((await get.json()) as { camera: unknown }).camera).toEqual({
      x: -100,
      y: 200,
      zoom: 1.5,
    })
  })

  it('rejects an unauthenticated request (401)', async () => {
    expect((await ctx.app.request('/api/me/camera')).status).toBe(401)
  })

  it('rejects an invalid camera (400)', async () => {
    const res = await ctx.app.request('/api/me/camera', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ x: 0, y: 0, zoom: -1 }),
    })
    expect(res.status).toBe(400)
  })
})
