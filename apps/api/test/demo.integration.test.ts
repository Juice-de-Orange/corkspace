import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startTestDb, type TestDb } from '@corkspace/db/testing'
import { type Env, parseEnv } from '@corkspace/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type App, buildApp } from '../src/app'
import { makeAuth } from '../src/auth'
import { boardCounts, demoCounts, resetDemo, templateBoardId } from '../src/demo/template'
import { seedAdmin } from '../src/seed/admin'
import { ensurePersonalBoard } from '../src/services/board-access'
import { adminCreds } from './helpers/app'

/**
 * DEMO_MODE=on: every visitor gets a private copy of the seed board, nothing reaches other visitors,
 * accounts/uploads/link fetching are off server-side, and limits hold. Each `app()` call builds a
 * fresh app (fresh in-memory rate limiters) on the same database.
 */

let testDb: TestDb
let baseRaw: Record<string, string>

function envFor(overrides: Record<string, string> = {}): Env {
  return parseEnv({ ...baseRaw, ...overrides })
}

function app(overrides: Record<string, string> = {}): App {
  const env = envFor({ DEMO_MODE: 'on', ...overrides })
  return buildApp({ db: testDb.db, env, auth: makeAuth(testDb.db, env) })
}

let ipCounter = 0
/** A fresh documentation-range address per call, so per-IP limits never leak between tests. */
function freshIp(): string {
  ipCounter += 1
  return `203.0.113.${ipCounter}`
}

/** Start a guest session; returns the cookie header value and the guest's board id. */
async function startGuest(a: App, ip = freshIp()): Promise<{ cookie: string; boardId: string }> {
  const res = await a.request('/api/demo/session', {
    method: 'POST',
    headers: { 'x-real-ip': ip },
  })
  expect(res.status).toBe(201)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  expect(cookie).toContain('session_token')
  const me = await a.request('/api/me', {
    headers: { cookie, 'x-real-ip': ip },
  })
  expect(me.status).toBe(200)
  const body = (await me.json()) as { defaultBoardId: string }
  return { cookie, boardId: body.defaultBoardId }
}

function send(
  a: App,
  method: string,
  path: string,
  opts: {
    cookie?: string
    ip?: string
    body?: unknown
    raw?: string
    type?: string
  } = {},
) {
  const headers: Record<string, string> = { 'x-real-ip': opts.ip ?? freshIp() }
  if (opts.cookie) {
    headers.cookie = opts.cookie
  }
  let body: string | undefined = opts.raw
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  } else if (opts.type) {
    headers['content-type'] = opts.type
  }
  return a.request(path, { method, headers, ...(body === undefined ? {} : { body }) })
}

const sticky = (text = 'hello') => ({
  type: 'sticky',
  x: 10,
  y: 10,
  width: 200,
  height: 200,
  content: { text },
  color: 'yellow',
  visibility: 'public',
})

beforeAll(async () => {
  testDb = await startTestDb()
  baseRaw = {
    NODE_ENV: 'test',
    DATABASE_URL: testDb.url,
    BETTER_AUTH_SECRET: 'test-secret-value-at-least-16-chars',
    BETTER_AUTH_URL: 'http://localhost:3000',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
    ADMIN_EMAIL: adminCreds.email,
    ADMIN_PASSWORD: adminCreds.password,
    ADMIN_NAME: adminCreds.name,
    ASSET_DIR: join(tmpdir(), `corkspace-assets-${randomUUID()}`),
  }
  const env = envFor({ DEMO_MODE: 'on' })
  const seeded = await seedAdmin(testDb.db, env)
  await ensurePersonalBoard(testDb.db, seeded.userId, 'My board')
  await resetDemo(testDb.db, env, makeAuth(testDb.db, env))
})

afterAll(async () => {
  await testDb?.stop()
})

describe('demo mode: guest sessions', () => {
  it('gives each visitor a private copy of the seed board', async () => {
    const a = app()
    const tpl = await templateBoardId(testDb.db)
    expect(tpl).not.toBeNull()
    const before = await boardCounts(testDb.db, tpl as string)
    expect(before.entries).toBeGreaterThan(10)
    expect(before.connections).toBeGreaterThan(3)

    const guest = await startGuest(a)
    expect(guest.boardId).not.toBe(tpl)
    const copy = await boardCounts(testDb.db, guest.boardId)
    expect(copy).toEqual(before)

    // The copied threads point at the guest's own entries, not at the template's.
    const entries = (await (
      await send(a, 'GET', `/api/boards/${guest.boardId}/entries`, {
        cookie: guest.cookie,
      })
    ).json()) as { id: string }[]
    const ids = new Set(entries.map((e) => e.id))
    const threads = (await (
      await send(a, 'GET', `/api/boards/${guest.boardId}/connections`, {
        cookie: guest.cookie,
      })
    ).json()) as { fromEntryId: string; toEntryId: string }[]
    expect(threads.length).toBe(before.connections)
    for (const t of threads) {
      expect(ids.has(t.fromEntryId) && ids.has(t.toEntryId)).toBe(true)
    }
  })

  it('keeps an existing guest session instead of creating a second guest', async () => {
    const a = app()
    const guest = await startGuest(a)
    const again = await send(a, 'POST', '/api/demo/session', {
      cookie: guest.cookie,
    })
    expect(again.status).toBe(200)
    expect(again.headers.get('set-cookie')).toBeNull()
  })

  it('visitor A can neither read nor change visitor B’s board', async () => {
    const a = app()
    const alice = await startGuest(a)
    const bob = await startGuest(a)
    const bobEntries = (await (
      await send(a, 'GET', `/api/boards/${bob.boardId}/entries`, {
        cookie: bob.cookie,
      })
    ).json()) as { id: string }[]
    const target = bobEntries[0]?.id as string

    expect(
      (
        await send(a, 'GET', `/api/boards/${bob.boardId}`, {
          cookie: alice.cookie,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(a, 'GET', `/api/boards/${bob.boardId}/entries`, {
          cookie: alice.cookie,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(a, 'PATCH', `/api/boards/${bob.boardId}/entries/${target}`, {
          cookie: alice.cookie,
          body: { content: { text: 'pwned' } },
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(a, 'POST', `/api/boards/${bob.boardId}/entries`, {
          cookie: alice.cookie,
          body: sticky('pwned'),
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(a, 'DELETE', `/api/boards/${bob.boardId}/entries/${target}`, {
          cookie: alice.cookie,
        })
      ).status,
    ).toBe(404)
    // Alice's own edits stay on Alice's board.
    expect(
      (
        await send(a, 'POST', `/api/boards/${alice.boardId}/entries`, {
          cookie: alice.cookie,
          body: sticky('mine'),
        })
      ).status,
    ).toBe(201)

    const list = (await (await send(a, 'GET', '/api/boards', { cookie: alice.cookie })).json()) as {
      id: string
    }[]
    expect(list.map((b) => b.id)).toEqual([alice.boardId])
    const after = (await (
      await send(a, 'GET', `/api/boards/${bob.boardId}/entries`, {
        cookie: bob.cookie,
      })
    ).json()) as { id: string }[]
    expect(after.length).toBe(bobEntries.length)
  })
})

describe('demo mode: disabled features answer DEMO_DISABLED', () => {
  let guest: { cookie: string; boardId: string }
  beforeAll(async () => {
    guest = await startGuest(app())
  })

  const cases: [string, string, unknown?][] = [
    [
      'POST',
      '/api/auth/sign-up/email',
      { email: 'x@example.com', password: 'password-123', name: 'X' },
    ],
    ['POST', '/api/auth/sign-in/email', { email: adminCreds.email, password: adminCreds.password }],
    ['POST', '/api/auth/request-password-reset', { email: adminCreds.email }],
    ['POST', '/api/auth/forget-password', { email: adminCreds.email }],
    ['POST', '/api/auth/reset-password', { newPassword: 'password-123', token: 'x' }],
    ['POST', '/api/auth/change-password', { currentPassword: 'a', newPassword: 'password-123' }],
    ['POST', '/api/auth/change-email', { newEmail: 'y@example.com' }],
    ['POST', '/api/auth/send-verification-email', { email: 'y@example.com' }],
    ['POST', '/api/auth/admin/create-user', { email: 'z@example.com', password: 'p', name: 'Z' }],
    ['GET', '/api/admin/users'],
    ['POST', '/api/feedback', { message: 'hi' }],
    ['POST', '/api/links/preview', { url: 'http://169.254.169.254/' }],
    ['POST', '/assets/from-url', { url: 'http://169.254.169.254/latest/meta-data/' }],
    ['POST', '/members', { email: adminCreds.email, role: 'editor' }],
    ['POST', '/shares', {}],
  ]

  it.each(cases)('%s %s', async (method, path, body) => {
    const full = path.startsWith('/api/') ? path : `/api/boards/${guest.boardId}${path}`
    const res = await send(app(), method, full, { cookie: guest.cookie, body })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'DEMO_DISABLED' })
  })

  it('POST an image upload', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array(64)], 'a.png', { type: 'image/png' }))
    const res = await app().request(`/api/boards/${guest.boardId}/assets`, {
      method: 'POST',
      headers: { cookie: guest.cookie, 'x-real-ip': freshIp() },
      body: form,
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'DEMO_DISABLED' })
  })

  it('still lets a guest read the session and sign out', async () => {
    const own = await startGuest(app())
    const s = await send(app(), 'GET', '/api/auth/get-session', {
      cookie: own.cookie,
    })
    expect(s.status).toBe(200)
    const out = await app().request('/api/auth/sign-out', {
      method: 'POST',
      headers: {
        cookie: own.cookie,
        origin: 'http://localhost:3000',
        'x-real-ip': freshIp(),
      },
    })
    expect(out.status).toBe(200)
  })

  it('tells search engines not to index anything', async () => {
    const res = await send(app(), 'GET', '/api/instance')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await res.json()).toEqual({ brandName: 'Corkspace', demo: true })
    const auth = await send(app(), 'GET', '/api/auth/get-session')
    expect(auth.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})

describe('demo mode: limits', () => {
  it('refuses new objects once a board holds DEMO_MAX_OBJECTS', async () => {
    const tpl = (await templateBoardId(testDb.db)) as string
    const c = await boardCounts(testDb.db, tpl)
    const objects = c.entries + c.connections + c.strokes + c.frames + c.teleports + c.tags
    const a = app({ DEMO_MAX_OBJECTS: String(objects + 2) })
    const guest = await startGuest(a)
    const post = () =>
      send(a, 'POST', `/api/boards/${guest.boardId}/entries`, {
        cookie: guest.cookie,
        body: sticky(),
      })
    expect((await post()).status).toBe(201)
    expect((await post()).status).toBe(201)
    const third = await post()
    expect(third.status).toBe(403)
    expect(await third.json()).toMatchObject({ code: 'DEMO_LIMIT' })
    const frame = await send(a, 'POST', `/api/boards/${guest.boardId}/frames`, {
      cookie: guest.cookie,
      body: { name: 'F', x: 0, y: 0, width: 100, height: 100 },
    })
    expect(frame.status).toBe(403)
  })

  it('refuses a request body above DEMO_MAX_BODY_BYTES, incl. a 10 MB payload', async () => {
    const a = app()
    const guest = await startGuest(a)
    const big = await send(a, 'POST', `/api/boards/${guest.boardId}/entries`, {
      cookie: guest.cookie,
      body: sticky('x'.repeat(20_000)),
    })
    expect(big.status).toBe(413)
    expect(await big.json()).toMatchObject({ code: 'DEMO_LIMIT' })
    const huge = await send(a, 'POST', `/api/boards/${guest.boardId}/entries`, {
      cookie: guest.cookie,
      raw: 'x'.repeat(10 * 1024 * 1024),
      type: 'application/json',
    })
    expect(huge.status).toBe(413)
    const fine = await send(a, 'POST', `/api/boards/${guest.boardId}/entries`, {
      cookie: guest.cookie,
      body: sticky('x'.repeat(2_000)),
    })
    expect(fine.status).toBe(201)
  })

  it('rate-limits requests per client IP; health is exempt', async () => {
    const a = app({ DEMO_RATE_LIMIT: '20' })
    const ip = freshIp()
    const codes: number[] = []
    for (let i = 0; i < 25; i++) {
      codes.push((await send(a, 'GET', '/api/instance', { ip })).status)
    }
    expect(codes.filter((s) => s === 200)).toHaveLength(20)
    expect(codes.slice(20)).toEqual([429, 429, 429, 429, 429])
    const limited = await send(a, 'GET', '/api/instance', { ip })
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED' })
    expect((await send(a, 'GET', '/api/instance', { ip: freshIp() })).status).toBe(200)
    expect((await send(a, 'GET', '/api/health', { ip })).status).toBe(200)
  })

  it('keys the rate limit on DEMO_CLIENT_IP_HEADER', async () => {
    const a = app({
      DEMO_RATE_LIMIT: '2',
      DEMO_CLIENT_IP_HEADER: 'CF-Connecting-IP',
    })
    const hit = (ip: string) =>
      a.request('/api/instance', {
        headers: { 'cf-connecting-ip': ip, 'x-real-ip': freshIp() },
      })
    expect((await hit('198.51.100.7')).status).toBe(200)
    expect((await hit('198.51.100.7')).status).toBe(200)
    expect((await hit('198.51.100.7')).status).toBe(429)
    expect((await hit('198.51.100.8')).status).toBe(200)
  })

  it('still loads entry content in batches when the database is full or near the body limit', async () => {
    const guest = await startGuest(app())
    const a = app({ DEMO_MAX_DB_MB: '1' })
    const board = `/api/boards/${guest.boardId}`
    const write = await send(a, 'POST', `${board}/entries`, {
      cookie: guest.cookie,
      body: sticky(),
    })
    expect(write.status).toBe(503)
    expect(await write.json()).toMatchObject({ code: 'DEMO_FULL' })

    const metas = (await (
      await send(a, 'GET', `${board}/entries`, { cookie: guest.cookie })
    ).json()) as Array<{
      id: string
    }>
    expect(metas.length).toBeGreaterThan(0)
    const read = await send(a, 'POST', `${board}/entries/content`, {
      cookie: guest.cookie,
      body: { ids: metas.map((m) => m.id) },
    })
    expect(read.status).toBe(200)
    const rows = (await read.json()) as Array<{ id: string; content: unknown }>
    expect(rows.map((r) => r.id).sort()).toEqual(metas.map((m) => m.id).sort())

    // The web client's largest batch (200 ids) fits the default request body limit.
    const largest = await send(app(), 'POST', `${board}/entries/content`, {
      cookie: guest.cookie,
      body: { ids: Array.from({ length: 200 }, () => randomUUID()) },
    })
    expect(largest.status).toBe(200)
  })

  it('limits new guests per IP and in total', async () => {
    const a = app({ DEMO_GUESTS_PER_IP: '2' })
    const ip = freshIp()
    await startGuest(a, ip)
    await startGuest(a, ip)
    const third = await send(a, 'POST', '/api/demo/session', { ip })
    expect(third.status).toBe(429)

    const guests = (await demoCounts(testDb.db)).guests
    const full = app({ DEMO_MAX_GUESTS: String(guests) })
    const refused = await send(full, 'POST', '/api/demo/session')
    expect(refused.status).toBe(503)
    expect(await refused.json()).toMatchObject({ code: 'DEMO_FULL' })
  })
})

describe('demo mode: reset', () => {
  it('restores the seed state exactly and ends every guest session', async () => {
    const env = envFor({ DEMO_MODE: 'on' })
    const auth = makeAuth(testDb.db, env)
    await resetDemo(testDb.db, env, auth)
    const baseline = await demoCounts(testDb.db)
    expect(baseline.guests).toBe(0)

    const a = app()
    const guest = await startGuest(a)
    await send(a, 'POST', `/api/boards/${guest.boardId}/entries`, {
      cookie: guest.cookie,
      body: sticky('scribble'),
    })
    await startGuest(a)
    expect((await demoCounts(testDb.db)).guests).toBe(2)

    const started = Date.now()
    await resetDemo(testDb.db, env, auth)
    expect(Date.now() - started).toBeLessThan(60_000)
    expect(await demoCounts(testDb.db)).toEqual(baseline)
    expect((await send(a, 'GET', '/api/me', { cookie: guest.cookie })).status).toBe(401)
  })
})

describe('demo mode off (the default)', () => {
  it('has no guest route, no noindex header and normal sign-in', async () => {
    const env = envFor()
    expect(env.DEMO_MODE).toBe('off')
    const a = buildApp({ db: testDb.db, env, auth: makeAuth(testDb.db, env) })
    expect((await a.request('/api/demo/session', { method: 'POST' })).status).toBe(404)
    const inst = await a.request('/api/instance')
    expect(inst.headers.get('x-robots-tag')).toBeNull()
    expect(await inst.json()).toEqual({ brandName: 'Corkspace' })
    const signIn = await a.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: adminCreds.email,
        password: adminCreds.password,
      }),
    })
    expect(signIn.status).toBe(200)
  })
})
