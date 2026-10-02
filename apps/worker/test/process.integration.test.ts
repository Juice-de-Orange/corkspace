import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assets, boards, user } from '@corkspace/db/schema'
import { startTestDb, type TestDb } from '@corkspace/db/testing'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runOnce } from '../src/queue'

describe('worker image pipeline', () => {
  let tdb: TestDb
  let dir: string
  let boardId: string

  beforeAll(async () => {
    tdb = await startTestDb()
    dir = await mkdtemp(join(tmpdir(), 'corkspace-worker-'))
    // Assets are board-scoped now; create an owner + board for the fixtures.
    const uid = randomUUID()
    await tdb.db
      .insert(user)
      .values({ id: uid, name: 'Worker', email: 'worker@example.com', emailVerified: true })
    const b = await tdb.db.insert(boards).values({ ownerId: uid, name: 'B' }).returning({
      id: boards.id,
    })
    boardId = b[0]?.id as string
  })

  afterAll(async () => {
    await tdb?.stop()
  })

  it('generates webp variants for a pending uploaded image', async () => {
    const id = randomUUID()
    const orig = await sharp({
      create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .png()
      .toBuffer()
    await mkdir(join(dir, id), { recursive: true })
    const rel = `${id}/orig.png`
    await writeFile(join(dir, rel), orig)
    await tdb.db
      .insert(assets)
      .values({ id, boardId, originalPath: rel, mime: 'image/png', sizeBytes: orig.length })

    expect(await runOnce(tdb.db, dir)).toBe(true)

    const rows = await tdb.db.select().from(assets).where(eq(assets.id, id))
    const row = rows[0]
    expect(row?.processingStatus).toBe('ready')
    expect(row?.width).toBe(600)
    expect(row?.height).toBe(400)
    const variants = (row?.variants ?? {}) as Record<string, string>
    expect(variants.full).toBeTruthy()
    expect(variants['256']).toBeTruthy()
    const webp = await readFile(join(dir, variants.full as string))
    expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP')
  })

  it('generates an animated webp variant for an uploaded gif', async () => {
    const id = randomUUID()
    // Hand-built 1x1, 2-frame animated GIF89a with an infinite Netscape loop (known-good).
    const gif = Buffer.from(
      'R0lGODlhAQABAJAAAP8AAAD/ACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEAAAAACwAAAAAAQABAAACAkQBACH5BAQAAAAALAAAAAABAAEAAAICTAEAOw==',
      'base64',
    )
    await mkdir(join(dir, id), { recursive: true })
    const rel = `${id}/orig.gif`
    await writeFile(join(dir, rel), gif)
    await tdb.db
      .insert(assets)
      .values({ id, boardId, originalPath: rel, mime: 'image/gif', sizeBytes: gif.length })

    expect(await runOnce(tdb.db, dir)).toBe(true)

    const rows = await tdb.db.select().from(assets).where(eq(assets.id, id))
    const row = rows[0]
    expect(row?.processingStatus).toBe('ready')
    // Stored as the single-frame dimensions, not the stacked animation filmstrip.
    expect(row?.width).toBe(1)
    expect(row?.height).toBe(1)
    const variants = (row?.variants ?? {}) as Record<string, string>
    expect(variants.full).toBeTruthy()
    const webp = await readFile(join(dir, variants.full as string))
    expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP')
    // Every frame survives → the webp is animated, not a flattened first frame.
    const outMeta = await sharp(webp, { animated: true }).metadata()
    expect(outMeta.pages).toBe(2)
  })

  it('marks a from-url asset failed when the target is SSRF-blocked', async () => {
    const id = randomUUID()
    await tdb.db.insert(assets).values({ id, boardId, sourceUrl: 'https://127.0.0.1/evil.png' })
    expect(await runOnce(tdb.db, dir)).toBe(true)
    const rows = await tdb.db.select().from(assets).where(eq(assets.id, id))
    expect(rows[0]?.processingStatus).toBe('failed')
  })

  it('returns false when the queue is empty', async () => {
    expect(await runOnce(tdb.db, dir)).toBe(false)
  })
})
