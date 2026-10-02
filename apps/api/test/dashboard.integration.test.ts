import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminCreds, createTestApp, login, type TestApp, viewerCreds } from './helpers/app'

const json = (cookie: string) => ({ cookie, 'content-type': 'application/json' })

async function createSticky(ctx: TestApp, cookie: string, text: string): Promise<string> {
  const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
    method: 'POST',
    headers: json(cookie),
    body: JSON.stringify({
      type: 'sticky',
      x: 0,
      y: 0,
      width: 240,
      height: 240,
      rotation: 0,
      zIndex: 1,
      visibility: 'private',
      content: { text },
    }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const getContent = async (ctx: TestApp, cookie: string, id: string) =>
  (await (
    await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries/${id}/content`, {
      headers: { cookie },
    })
  ).json()) as {
    content: { text?: string }
  }

describe('dashboard — search, trash, versions, stats, orphans', () => {
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

  const search = (cookie: string, body: unknown) =>
    ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/search`, {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify(body),
    })

  it('full-text search finds an entry by a unique word and snippets it; viewer is denied', async () => {
    const id = await createSticky(ctx, admin, 'Plum dumplings with cinnamon')
    await createSticky(ctx, admin, 'something else entirely')

    const res = await search(admin, { q: 'dumplings' })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { id: string; snippet: string }[]
    const hit = rows.find((r) => r.id === id)
    expect(hit).toBeDefined()
    expect(hit?.snippet).toContain('dumplings')

    expect((await search(viewer, { q: 'x' })).status).toBe(403)
  })

  it('finds an entry by a tag name even when its text does not match', async () => {
    const id = await createSticky(ctx, admin, 'nichts passendes im Text')

    const tagRes = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ name: 'Wichtig', color: '#dc2626' }),
    })
    expect(tagRes.status).toBe(201)
    const tagId = ((await tagRes.json()) as { id: string }).id

    const assign = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/tags/assign/${id}`, {
      method: 'PUT',
      headers: json(admin),
      body: JSON.stringify({ tagIds: [tagId] }),
    })
    expect(assign.status).toBe(200)

    const rows = (await (await search(admin, { q: 'Wichtig' })).json()) as { id: string }[]
    expect(rows.some((r) => r.id === id)).toBe(true)
  })

  it('filters by type', async () => {
    const rows = (await (await search(admin, { types: ['link'] })).json()) as { type: string }[]
    expect(rows.every((r) => r.type === 'link')).toBe(true)
  })

  it('facets: position/region, date range, and link status', async () => {
    // region — an entry far away at a known position
    const farRes = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({
        type: 'sticky',
        x: 9000,
        y: 9000,
        width: 240,
        height: 240,
        rotation: 0,
        zIndex: 1,
        visibility: 'private',
        content: { text: 'REGIONMARK' },
      }),
    })
    const farId = ((await farRes.json()) as { id: string }).id

    const inRegion = (await (
      await search(admin, {
        q: 'REGIONMARK',
        region: { minX: 8000, minY: 8000, maxX: 10_000, maxY: 10_000 },
      })
    ).json()) as { id: string }[]
    expect(inRegion.some((r) => r.id === farId)).toBe(true)
    const outRegion = (await (
      await search(admin, { q: 'REGIONMARK', region: { minX: 0, minY: 0, maxX: 100, maxY: 100 } })
    ).json()) as { id: string }[]
    expect(outRegion.some((r) => r.id === farId)).toBe(false)

    // date range — everything is created "now", so a past upper bound excludes all
    const past = '2000-01-01T00:00:00.000Z'
    const future = '2999-01-01T00:00:00.000Z'
    expect(
      ((await (await search(admin, { createdBefore: past })).json()) as unknown[]).length,
    ).toBe(0)
    expect(
      (
        (await (
          await search(admin, { createdAfter: past, createdBefore: future })
        ).json()) as unknown[]
      ).length,
    ).toBeGreaterThan(0)

    // link status — connect two entries; a third stays unlinked
    const a = await createSticky(ctx, admin, 'LINKA')
    const b = await createSticky(ctx, admin, 'LINKB')
    const lone = await createSticky(ctx, admin, 'LONELINK')
    const conn = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ fromEntryId: a, toEntryId: b }),
    })
    expect(conn.status).toBe(201)

    const linked = (await (await search(admin, { linkStatus: 'linked' })).json()) as {
      id: string
    }[]
    expect(linked.some((r) => r.id === a)).toBe(true)
    expect(linked.some((r) => r.id === lone)).toBe(false)
    const unlinked = (await (await search(admin, { linkStatus: 'unlinked' })).json()) as {
      id: string
    }[]
    expect(unlinked.some((r) => r.id === lone)).toBe(true)
    expect(unlinked.some((r) => r.id === a)).toBe(false)
  })

  it('graph: nodes + degree-annotated edges; viewer is denied', async () => {
    const a = await createSticky(ctx, admin, 'GRAPHA')
    const b = await createSticky(ctx, admin, 'GRAPHB')
    await ctx.app.request(`/api/boards/${ctx.adminBoardId}/connections`, {
      method: 'POST',
      headers: json(admin),
      body: JSON.stringify({ fromEntryId: a, toEntryId: b }),
    })

    const res = await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/graph`, {
      headers: { cookie: admin },
    })
    expect(res.status).toBe(200)
    const graph = (await res.json()) as {
      nodes: { id: string; degree: number }[]
      edges: { from: string; to: string }[]
    }
    const nodeA = graph.nodes.find((n) => n.id === a)
    expect(nodeA).toBeDefined()
    expect(nodeA?.degree).toBeGreaterThanOrEqual(1)
    expect(graph.edges.some((e) => e.from === a && e.to === b)).toBe(true)

    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/graph`, {
          headers: { cookie: viewer },
        })
      ).status,
    ).toBe(403)
  })

  it('soft-delete → appears in trash → restore → back on the board', async () => {
    const id = await createSticky(ctx, admin, 'delete me')
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries/${id}`, {
          method: 'DELETE',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(200)

    const trash = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/trash`, {
        headers: { cookie: admin },
      })
    ).json()) as { id: string }[]
    expect(trash.some((t) => t.id === id)).toBe(true)

    const restore = await ctx.app.request(
      `/api/boards/${ctx.adminBoardId}/dashboard/entries/${id}/restore`,
      {
        method: 'POST',
        headers: { cookie: admin },
      },
    )
    expect(restore.status).toBe(200)

    const trash2 = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/trash`, {
        headers: { cookie: admin },
      })
    ).json()) as { id: string }[]
    expect(trash2.some((t) => t.id === id)).toBe(false)
  })

  it('version history captures the prior state and restores it exactly', async () => {
    const id = await createSticky(ctx, admin, 'original')
    // commit a content change → captures the prior ("original") as a version
    await ctx.app.request(`/api/boards/${ctx.adminBoardId}/entries/${id}`, {
      method: 'PATCH',
      headers: json(admin),
      body: JSON.stringify({ content: { text: 'changed' }, commitVersion: true }),
    })
    expect((await getContent(ctx, admin, id)).content.text).toBe('changed')

    const versions = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/entries/${id}/versions`, {
        headers: { cookie: admin },
      })
    ).json()) as { id: string }[]
    expect(versions.length).toBe(1)

    const restore = await ctx.app.request(
      `/api/boards/${ctx.adminBoardId}/dashboard/entries/${id}/versions/${versions[0]?.id}/restore`,
      { method: 'POST', headers: { cookie: admin } },
    )
    expect(restore.status).toBe(200)
    expect((await getContent(ctx, admin, id)).content.text).toBe('original')
  })

  it('search edge cases + restore/version 404s', async () => {
    const ZERO = '00000000-0000-0000-0000-000000000000'
    // invalid body → 400
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/search`, {
          method: 'POST',
          headers: json(admin),
          body: JSON.stringify({ types: 'nope' }),
        })
      ).status,
    ).toBe(400)
    // no-filter search (includeDeleted, no q) → the undefined-where branch
    expect(Array.isArray(await (await search(admin, { includeDeleted: true })).json())).toBe(true)
    // tag filter with an unknown tag → no rows
    expect(((await (await search(admin, { tagIds: [ZERO] })).json()) as unknown[]).length).toBe(0)
    // restore + version restore unknown → 404
    expect(
      (
        await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/entries/${ZERO}/restore`, {
          method: 'POST',
          headers: { cookie: admin },
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await ctx.app.request(
          `/api/boards/${ctx.adminBoardId}/dashboard/entries/${ZERO}/versions/${ZERO}/restore`,
          {
            method: 'POST',
            headers: { cookie: admin },
          },
        )
      ).status,
    ).toBe(404)
  })

  it('stats + orphans return data; a fresh untagged/unconnected entry is an orphan', async () => {
    const id = await createSticky(ctx, admin, 'einsam')
    const stats = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/stats`, {
        headers: { cookie: admin },
      })
    ).json()) as { entries: number; connections: number }
    expect(stats.entries).toBeGreaterThan(0)

    const orphans = (await (
      await ctx.app.request(`/api/boards/${ctx.adminBoardId}/dashboard/orphans`, {
        headers: { cookie: admin },
      })
    ).json()) as { id: string; x: number; y: number; width: number; height: number }[]
    const orphan = orphans.find((o) => o.id === id)
    expect(orphan).toBeDefined()
    // position is included so the dashboard can fly to the orphan
    expect(orphan?.width).toBe(240)
    expect(typeof orphan?.x).toBe('number')
  })
})
