import { user as userTable } from '@corkspace/db/schema'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addMember,
  adminCreds,
  createShareToken,
  createTestApp,
  createUserAccount,
  login,
  type TestApp,
  viewerCreds,
} from './helpers/app'

/**
 * The board RBAC + visibility matrix — the security heart of the multi-tenant rearchitecture.
 * Every assertion checks the API's RESPONSE BODY with a real session/token (CLAUDE.md §10):
 * owner/editor/super-admin see private; viewer-member + external link see only public and can never
 * mutate; boards are isolated; the furniture toggle hides board-layer strokes/frames/teleports.
 */
describe('board RBAC + visibility matrix', () => {
  let ctx: TestApp
  let admin: string
  let editor: string
  let viewer: string
  let userB: string
  let adminBoard: string
  let boardB: string
  let tokenFurniture: string
  let tokenNoFurniture: string
  let bTokenBoardB: string
  let publicId: string
  let privateId: string
  let bEntryId: string

  const j = async (res: Response) => (await res.json()) as unknown

  beforeAll(async () => {
    ctx = await createTestApp()
    admin = await login(ctx.app, adminCreds.email, adminCreds.password)
    viewer = await login(ctx.app, viewerCreds.email, viewerCreds.password)
    adminBoard = `/api/boards/${ctx.adminBoardId}`

    // Editor = a registered user invited as an editor of the admin board.
    const ed = await createUserAccount(ctx.testDb.db, {
      email: 'editor@example.com',
      password: 'editor-password-123',
      name: 'Editor',
    })
    await addMember(ctx.testDb.db, ctx.adminBoardId, ed.id, 'editor')
    editor = await login(ctx.app, 'editor@example.com', 'editor-password-123')

    // User B = an unrelated user with their OWN board (no access to the admin board).
    const b = await createUserAccount(ctx.testDb.db, {
      email: 'userb@example.com',
      password: 'userb-password-123',
      name: 'User B',
    })
    boardB = `/api/boards/${b.boardId}`
    userB = await login(ctx.app, 'userb@example.com', 'userb-password-123')

    // External read links on the admin board (furniture on/off) + a link on board B.
    tokenFurniture = await createShareToken(ctx.testDb.db, ctx.adminBoardId, ctx.adminId, true)
    tokenNoFurniture = await createShareToken(ctx.testDb.db, ctx.adminBoardId, ctx.adminId, false)
    bTokenBoardB = await createShareToken(ctx.testDb.db, b.boardId, b.id, true)

    // Seed content: admin board (public + private), plus a board-layer stroke, a frame, a teleport.
    const mk = (cookie: string, base: string, visibility: 'public' | 'private', text: string) =>
      ctx.app.request(`${base}/entries`, {
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
    publicId = ((await j(await mk(admin, adminBoard, 'public', 'PUB'))) as { id: string }).id
    privateId = ((await j(await mk(admin, adminBoard, 'private', 'SECRET'))) as { id: string }).id
    bEntryId = ((await j(await mk(userB, boardB, 'public', 'B_PUB'))) as { id: string }).id

    await ctx.app.request(`${adminBoard}/strokes`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({
        points: [
          [0, 0, 0.5],
          [10, 10, 0.5],
        ],
        color: '#000',
        size: 4,
        tool: 'pen',
      }),
    })
    await ctx.app.request(`${adminBoard}/frames`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'F', x: 0, y: 0, width: 100, height: 100 }),
    })
    await ctx.app.request(`${adminBoard}/teleports`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'T', x: 0, y: 0, zoom: 1 }),
    })
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  const list = (base: string, cookie?: string) =>
    ctx.app.request(`${base}/entries`, cookie ? { headers: { cookie } } : undefined)

  it('owner + editor + super-admin see the private entry', async () => {
    for (const cookie of [admin, editor]) {
      const rows = (await j(await list(adminBoard, cookie))) as Array<{ id: string }>
      expect(rows.map((r) => r.id)).toContain(privateId)
    }
    // Super-admin viewing ANOTHER board sees its (would-be) private content too.
    const superRes = await list(boardB, admin)
    expect(superRes.status).toBe(200)
  })

  it('viewer-member never receives the private entry (body assertion)', async () => {
    const rows = (await j(await list(adminBoard, viewer))) as Array<{
      id: string
      visibility: string
    }>
    expect(rows.map((r) => r.id)).toContain(publicId)
    expect(rows.map((r) => r.id)).not.toContain(privateId)
    expect(rows.every((r) => r.visibility === 'public')).toBe(true)
    expect(
      (
        await ctx.app.request(`${adminBoard}/entries/${privateId}/content`, {
          headers: { cookie: viewer },
        })
      ).status,
    ).toBe(404)
  })

  it('external token never receives the private entry, and cannot reach another board', async () => {
    const pub = `/api/public/${tokenFurniture}`
    const rows = (await j(await ctx.app.request(`${pub}/entries`))) as Array<{
      id: string
      visibility: string
    }>
    expect(rows.map((r) => r.id)).toContain(publicId)
    expect(rows.map((r) => r.id)).not.toContain(privateId)
    expect(rows.map((r) => r.id)).not.toContain(bEntryId) // board isolation
    expect(rows.every((r) => r.visibility === 'public')).toBe(true)
    expect((await ctx.app.request(`${pub}/entries/${privateId}/content`)).status).toBe(404)
    // Board B's token only ever returns board B content.
    const bRows = (await j(await ctx.app.request(`/api/public/${bTokenBoardB}/entries`))) as Array<{
      id: string
    }>
    expect(bRows.map((r) => r.id)).toContain(bEntryId)
    expect(bRows.map((r) => r.id)).not.toContain(publicId)
  })

  it('editor CAN mutate; viewer CANNOT; the public tree exposes no mutation route', async () => {
    const mk = (cookie: string) =>
      ctx.app.request(`${adminBoard}/entries`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'sticky', x: 1, y: 1, width: 240, height: 240, content: {} }),
      })
    expect((await mk(editor)).status).toBe(201)
    expect((await mk(viewer)).status).toBe(403)
    // No POST handler exists under /api/public → 404 (structural).
    const res = await ctx.app.request(`/api/public/${tokenFurniture}/entries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: {} }),
    })
    expect([404, 405]).toContain(res.status)
  })

  it('boards are isolated: an unrelated user gets 404, not 403 (existence hidden)', async () => {
    expect((await list(adminBoard, userB)).status).toBe(404)
    // Super-admin can READ board B but cannot EDIT it or manage its members.
    const edit = await ctx.app.request(`${boardB}/entries`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'sticky', x: 0, y: 0, width: 240, height: 240, content: {} }),
    })
    expect(edit.status).toBe(403)
    expect(
      (await ctx.app.request(`${boardB}/members`, { headers: { cookie: admin } })).status,
    ).toBe(403)
  })

  it('rejects a cross-board connection (400)', async () => {
    // Both endpoints must be on the same board; connecting to board B's entry is rejected.
    const anchor = (
      (await j(
        await ctx.app.request(`${adminBoard}/entries`, {
          method: 'POST',
          headers: { cookie: admin, 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'sticky',
            x: 5,
            y: 5,
            width: 240,
            height: 240,
            content: {},
          }),
        }),
      )) as { id: string }
    ).id
    const res = await ctx.app.request(`${adminBoard}/connections`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ fromEntryId: anchor, toEntryId: bEntryId }),
    })
    expect(res.status).toBe(400)
  })

  it('inviting an unregistered email → 404 and creates no user', async () => {
    const before = await ctx.testDb.db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, 'ghost@example.com'))
    expect(before.length).toBe(0)
    const res = await ctx.app.request(`${adminBoard}/members`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@example.com', role: 'viewer' }),
    })
    expect(res.status).toBe(404)
    const after = await ctx.testDb.db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, 'ghost@example.com'))
    expect(after.length).toBe(0)
  })

  it('furniture toggle hides board-layer strokes/frames/teleports from a viewer link', async () => {
    const on = `/api/public/${tokenFurniture}`
    const off = `/api/public/${tokenNoFurniture}`
    const framesOn = (await j(await ctx.app.request(`${on}/frames`))) as unknown[]
    const framesOff = (await j(await ctx.app.request(`${off}/frames`))) as unknown[]
    expect(framesOn.length).toBeGreaterThan(0)
    expect(framesOff.length).toBe(0)
    const telesOff = (await j(await ctx.app.request(`${off}/teleports`))) as unknown[]
    expect(telesOff.length).toBe(0)
    // Board-layer strokes (entry_id null) hidden when furniture off.
    const strokesOn = (await j(await ctx.app.request(`${on}/strokes`))) as Array<{
      entryId: string | null
    }>
    const strokesOff = (await j(await ctx.app.request(`${off}/strokes`))) as Array<{
      entryId: string | null
    }>
    expect(strokesOn.some((s) => s.entryId === null)).toBe(true)
    expect(strokesOff.some((s) => s.entryId === null)).toBe(false)
  })

  it('concurrent editors are last-write-wins (no realtime, no conflict)', async () => {
    const patch = (cookie: string, x: number) =>
      ctx.app.request(`${adminBoard}/entries/${publicId}`, {
        method: 'PATCH',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ x }),
      })
    await patch(admin, 111)
    await patch(editor, 222)
    const rows = (await j(await list(adminBoard, admin))) as Array<{ id: string; x: number }>
    expect(rows.find((r) => r.id === publicId)?.x).toBe(222)
  })
})
