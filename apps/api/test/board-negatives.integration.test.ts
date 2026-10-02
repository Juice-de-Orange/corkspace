import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp } from './helpers/app'

/** Error-path coverage: invalid bodies → 400, missing rows → 404, and a few edge branches
 *  (board-not-found, invite-self, cross-board) across the board-scoped content routes. */
describe('board content — error paths', () => {
  let ctx: TestApp
  let admin: string
  let board: string
  let entryId: string
  let tagId: string
  const MISSING = '00000000-0000-0000-0000-000000000000'
  const H = () => ({ cookie: admin, 'content-type': 'application/json' })

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    board = `/api/boards/${ctx.adminBoardId}`
    const e = await ctx.app.request(`${board}/entries`, {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({ type: 'sticky', x: 0, y: 0, width: 240, height: 240, content: {} }),
    })
    entryId = ((await e.json()) as { id: string }).id
    const t = await ctx.app.request(`${board}/tags`, {
      method: 'POST',
      headers: H(),
      body: JSON.stringify({ name: 'T', color: '#f00' }),
    })
    tagId = ((await t.json()) as { id: string }).id
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  const post = (sub: string, body: unknown) =>
    ctx.app.request(`${board}${sub}`, { method: 'POST', headers: H(), body: JSON.stringify(body) })
  const patch = (sub: string, body: unknown) =>
    ctx.app.request(`${board}${sub}`, { method: 'PATCH', headers: H(), body: JSON.stringify(body) })
  const del = (sub: string) => ctx.app.request(`${board}${sub}`, { method: 'DELETE', headers: H() })

  it('requesting a non-existent board → 404 (existence hidden)', async () => {
    expect(
      (await ctx.app.request(`/api/boards/${MISSING}/entries`, { headers: { cookie: admin } }))
        .status,
    ).toBe(404)
  })

  it('tags: invalid create 400, empty/missing patch, delete missing, bad assign', async () => {
    expect((await post('/tags', { name: '' })).status).toBe(400)
    expect((await patch(`/tags/${tagId}`, {})).status).toBe(400)
    expect((await patch(`/tags/${MISSING}`, { name: 'x' })).status).toBe(404)
    expect((await del(`/tags/${MISSING}`)).status).toBe(404)
    // assign to a missing entry → 404; assign an unknown tag id → 400.
    expect(
      (
        await ctx.app.request(`${board}/tags/assign/${MISSING}`, {
          method: 'PUT',
          headers: H(),
          body: JSON.stringify({ tagIds: [] }),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await ctx.app.request(`${board}/tags/assign/${entryId}`, {
          method: 'PUT',
          headers: H(),
          body: JSON.stringify({ tagIds: [MISSING] }),
        })
      ).status,
    ).toBe(400)
    // valid assign → 200
    expect(
      (
        await ctx.app.request(`${board}/tags/assign/${entryId}`, {
          method: 'PUT',
          headers: H(),
          body: JSON.stringify({ tagIds: [tagId] }),
        })
      ).status,
    ).toBe(200)
  })

  it('frames: invalid create 400, empty/missing patch, delete missing, move invalid/missing', async () => {
    expect((await post('/frames', { name: '' })).status).toBe(400)
    expect((await patch(`/frames/${MISSING}`, {})).status).toBe(400)
    expect((await patch(`/frames/${MISSING}`, { name: 'x' })).status).toBe(404)
    expect((await del(`/frames/${MISSING}`)).status).toBe(404)
    expect((await post(`/frames/${MISSING}/move`, { dx: 'no' })).status).toBe(400)
    expect((await post(`/frames/${MISSING}/move`, { dx: 1, dy: 1 })).status).toBe(404)
  })

  it('teleports: invalid create 400, empty/missing patch, delete missing', async () => {
    expect((await post('/teleports', { name: '' })).status).toBe(400)
    expect((await patch(`/teleports/${MISSING}`, {})).status).toBe(400)
    expect((await patch(`/teleports/${MISSING}`, { name: 'x' })).status).toBe(404)
    expect((await del(`/teleports/${MISSING}`)).status).toBe(404)
  })

  it('strokes: invalid create 400, stroke on a missing entry 404, delete missing 404', async () => {
    expect((await post('/strokes', { points: 'no' })).status).toBe(400)
    expect(
      (
        await post('/strokes', {
          entryId: MISSING,
          points: [
            [0, 0, 0.5],
            [1, 1, 0.5],
          ],
          color: '#000',
          size: 4,
          tool: 'pen',
        })
      ).status,
    ).toBe(404)
    expect((await del(`/strokes/${MISSING}`)).status).toBe(404)
  })

  it('connections: invalid create 400, empty/missing patch, delete missing', async () => {
    expect((await post('/connections', { fromEntryId: 'x' })).status).toBe(400)
    expect((await patch(`/connections/${MISSING}`, {})).status).toBe(400)
    expect((await patch(`/connections/${MISSING}`, { color: '#000' })).status).toBe(404)
    expect((await del(`/connections/${MISSING}`)).status).toBe(404)
  })

  it('inviting your own email → 400 (is-owner)', async () => {
    expect((await post('/members', { email: adminCreds.email, role: 'editor' })).status).toBe(400)
    // Invalid invite body → 400.
    expect((await post('/members', { email: 'not-an-email', role: 'editor' })).status).toBe(400)
  })
})
