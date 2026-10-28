import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addMember,
  adminCreds,
  createTestApp,
  createUserAccount,
  login,
  type TestApp,
  viewerCreds,
} from './helpers/app'

const userCreds = { email: 'user@example.com', password: 'user-password-123', name: 'User' }
const editorCreds = { email: 'editor@example.com', password: 'editor-password-123', name: 'Ed' }

describe('link preview (/api/boards/:boardId/links/preview)', () => {
  let ctx: TestApp
  let admin: string
  let viewer: string
  let user: string
  let userBoardId: string
  let editor: string

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
    // A normal account (role `user`) on its own board, and one that edits the admin's board.
    userBoardId = (await createUserAccount(ctx.testDb.db, userCreds)).boardId
    user = await login(ctx.app, userCreds.email, userCreds.password)
    const ed = await createUserAccount(ctx.testDb.db, editorCreds)
    await addMember(ctx.testDb.db, ctx.adminBoardId, ed.id, 'editor')
    editor = await login(ctx.app, editorCreds.email, editorCreds.password)
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  const preview = (cookie: string | null, boardId: string, url: string) =>
    ctx.app.request(`/api/boards/${boardId}/links/preview`, {
      method: 'POST',
      headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })

  // An SSRF-blocked target answers without leaving the machine: the bare url, no metadata.
  const blocked = 'https://127.0.0.1/admin'

  it('a normal user previews on their own board (200, no metadata leaked)', async () => {
    const res = await preview(user, userBoardId, blocked)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; title?: string }
    expect(body.url).toBe(blocked)
    expect(body.title).toBeUndefined()
  })

  it('an editor member previews on the board they edit (200)', async () => {
    const res = await preview(editor, ctx.adminBoardId, blocked)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: blocked })
  })

  it('the board owner previews (200)', async () => {
    const res = await preview(admin, ctx.adminBoardId, blocked)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: blocked })
  })

  it('a viewer member cannot preview on that board (403)', async () => {
    const res = await preview(viewer, ctx.adminBoardId, blocked)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  it('a board the caller cannot see answers 404', async () => {
    const res = await preview(viewer, userBoardId, blocked)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('anonymous callers get 401', async () => {
    const res = await preview(null, ctx.adminBoardId, blocked)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects an invalid url (400)', async () => {
    const res = await preview(admin, ctx.adminBoardId, 'not-a-url')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid url' })
  })

  it('limits each user to 30 previews a minute (429 with Retry-After), per user', async () => {
    // `user` already used one preview above.
    for (let i = 1; i < 30; i++) {
      expect((await preview(user, userBoardId, blocked)).status).toBe(200)
    }
    const res = await preview(user, userBoardId, blocked)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Too many requests' })
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    // Another user's budget is untouched.
    expect((await preview(editor, ctx.adminBoardId, blocked)).status).toBe(200)
  })
})
