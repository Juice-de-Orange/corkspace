import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' })
const PNG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

describe('feedback — submit (any user) + admin review', () => {
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

  const post = (cookie: string, body: unknown) =>
    ctx.app.request('/api/feedback', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify(body),
    })

  it('a viewer can submit a bug with a screenshot; admin sees it; viewer cannot list', async () => {
    const res = await post(viewer, { kind: 'bug', message: 'Knopf kaputt', screenshot: PNG })
    expect(res.status).toBe(201)
    const id = ((await res.json()) as { id: string }).id

    // admin list (no screenshot payload, but a presence flag)
    const list = (await (
      await ctx.app.request('/api/feedback', { headers: { cookie: admin } })
    ).json()) as { id: string; kind: string; hasScreenshot: boolean; status: string }[]
    const item = list.find((f) => f.id === id)
    expect(item).toBeDefined()
    expect(item?.kind).toBe('bug')
    expect(item?.hasScreenshot).toBe(true)
    expect(item?.status).toBe('open')

    // full item has the screenshot
    const full = (await (
      await ctx.app.request(`/api/feedback/${id}`, { headers: { cookie: admin } })
    ).json()) as { screenshot: string }
    expect(full.screenshot).toBe(PNG)

    // viewer cannot list or read details
    expect((await ctx.app.request('/api/feedback', { headers: { cookie: viewer } })).status).toBe(
      403,
    )

    // admin marks it done
    const patch = await ctx.app.request(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: json(admin),
      body: JSON.stringify({ status: 'done' }),
    })
    expect(patch.status).toBe(200)
  })

  it('rejects invalid input and a non-image screenshot', async () => {
    expect((await post(admin, { kind: 'nope', message: 'x' })).status).toBe(400)
    expect((await post(admin, { kind: 'bug', message: '' })).status).toBe(400)
    expect(
      (await post(admin, { kind: 'bug', message: 'x', screenshot: 'http://evil/x' })).status,
    ).toBe(400)
  })

  it('admin can delete a feedback item; viewer cannot; repeat delete is 404', async () => {
    const res = await post(admin, { kind: 'wish', message: 'Please delete' })
    const id = ((await res.json()) as { id: string }).id
    const del = (cookie: string) =>
      ctx.app.request(`/api/feedback/${id}`, { method: 'DELETE', headers: { cookie } })

    expect((await del(viewer)).status).toBe(403)
    expect((await del(admin)).status).toBe(200)
    expect(
      (await ctx.app.request(`/api/feedback/${id}`, { headers: { cookie: admin } })).status,
    ).toBe(404)
    expect((await del(admin)).status).toBe(404)
  })
})
