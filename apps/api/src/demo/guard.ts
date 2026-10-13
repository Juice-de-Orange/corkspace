import type { Env } from '@corkspace/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppDeps, AppEnv } from '../app'
import { FixedWindowLimiter } from './rate-limit'
import { databaseBytes, ownedObjectCount } from './template'

/**
 * Server-side rules of the public demo (DEMO_MODE=on, docs/demo.md). Mounted only in demo mode,
 * in two parts: `demoGate` runs before everything else (incl. Better Auth), `demoObjectLimit` runs
 * after the session is known. Refusals carry a machine-readable `code`:
 *   DEMO_DISABLED (403) — the feature is off in the demo
 *   DEMO_LIMIT    (403 too many objects, 413 body too large)
 *   RATE_LIMITED  (429) — too many requests from this address
 *   DEMO_FULL     (503) — the instance is at its guest or storage cap until the next reset
 */

const NOINDEX = 'noindex, nofollow'
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DB_SIZE_TTL_MS = 30_000

/** Better Auth endpoints a guest needs. Everything else under /api/auth (sign-in and sign-up,
 *  password reset and change, e-mail, the admin plugin) is refused. */
const AUTH_ALLOWED = new Set(['GET /api/auth/get-session', 'POST /api/auth/sign-out'])

/** Off for every method: the admin surface, feedback (stored for admins), link previews (server-
 *  side fetch of a visitor's URL). */
const DISABLED = /^\/api\/(?:admin|feedback|links)(?:\/|$)/
/** Off for writes: uploads and remote-image downloads (`assets`), invitations (`members`) and
 *  read links (`shares`) — the last two would show a visitor's content to someone else. */
const BOARD_WRITES_DISABLED = /^\/api\/boards\/[^/]+\/(?:assets|members|shares)(?:\/|$)/
/** A POST that only reads: the batch content load of the entries in view. A full demo still
 *  shows its boards. */
const BATCH_READ = /^\/api\/boards\/[^/]+\/entries\/content$/
/** Requests that add an object to a board. */
const CREATES =
  /^\/api\/boards\/([^/]+)\/(?:entries(?:\/[^/]+\/duplicate)?|connections|strokes|frames|teleports|tags)\/?$/

/** The visitor's address: the first value of the configured header, or "unknown". */
export function clientIp(c: Context, env: Env): string {
  const first = c.req.header(env.DEMO_CLIENT_IP_HEADER)?.split(',')[0]?.trim()
  return first || 'unknown'
}

const refuse = (c: Context, status: 403 | 413 | 429 | 503, code: string, error: string) =>
  c.json({ error, code }, status)

function isDisabled(method: string, path: string): boolean {
  if (path === '/api/auth' || path.startsWith('/api/auth/')) {
    return !AUTH_ALLOWED.has(`${method} ${path}`)
  }
  if (DISABLED.test(path)) {
    return true
  }
  return MUTATING.has(method) && BOARD_WRITES_DISABLED.test(path)
}

function markNoindex(c: Context): void {
  try {
    c.res.headers.set('X-Robots-Tag', NOINDEX)
  } catch {
    // A response with immutable headers (e.g. a proxied fetch): copy it once.
    c.res = new Response(c.res.body, c.res)
    c.res.headers.set('X-Robots-Tag', NOINDEX)
  }
}

export function demoGate(deps: AppDeps): MiddlewareHandler<AppEnv> {
  const { env, db } = deps
  const requests = new FixedWindowLimiter(env.DEMO_RATE_LIMIT, 60_000)
  const maxBytes = env.DEMO_MAX_DB_MB * 1024 * 1024
  let dbSize = { bytes: 0, at: 0 }
  const limitBody = bodyLimit({
    maxSize: env.DEMO_MAX_BODY_BYTES,
    onError: (c) => refuse(c, 413, 'DEMO_LIMIT', 'Request too large for the demo'),
  })

  async function storageFull(): Promise<boolean> {
    const now = Date.now()
    if (now - dbSize.at > DB_SIZE_TTL_MS) {
      dbSize = { bytes: await databaseBytes(db), at: now }
    }
    return dbSize.bytes > maxBytes
  }

  return async (c, next) => {
    c.header('X-Robots-Tag', NOINDEX)
    const method = c.req.method
    const path = c.req.path
    if (path !== '/api/health') {
      const hit = requests.hit(clientIp(c, env))
      if (!hit.ok) {
        c.header('Retry-After', String(hit.retryAfterSeconds))
        return refuse(c, 429, 'RATE_LIMITED', 'Too many requests')
      }
    }
    if (isDisabled(method, path)) {
      return refuse(c, 403, 'DEMO_DISABLED', 'Disabled in the demo')
    }
    if (MUTATING.has(method) && method !== 'DELETE' && path !== '/api/auth/sign-out') {
      if (!BATCH_READ.test(path) && (await storageFull())) {
        return refuse(c, 503, 'DEMO_FULL', 'The demo is full until the next reset')
      }
      // Answers 413 itself (from Content-Length, or while reading a body without one).
      const tooLarge = await limitBody(c, next)
      if (tooLarge) {
        return tooLarge
      }
    } else {
      await next()
    }
    markNoindex(c)
  }
}

/** Refuse a new object once the caller's own board holds DEMO_MAX_OBJECTS. */
export function demoObjectLimit(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    const boardId = c.req.method === 'POST' ? CREATES.exec(c.req.path)?.[1] : undefined
    if (user && boardId) {
      const objects = await ownedObjectCount(deps.db, boardId, user.id)
      if (objects !== null && objects >= deps.env.DEMO_MAX_OBJECTS) {
        return refuse(c, 403, 'DEMO_LIMIT', 'This demo board is full')
      }
    }
    await next()
  }
}
