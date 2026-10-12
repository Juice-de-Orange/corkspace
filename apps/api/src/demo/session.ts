import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'
import { clientIp } from './guard'
import { FixedWindowLimiter } from './rate-limit'
import { createGuest, guestCount, templateBoardId } from './template'

/**
 * POST /api/demo/session — the demo's only way in. A visitor without a session becomes a guest
 * with a private copy of the seed board and gets the session cookie Better Auth issues; a visitor
 * who already has a session keeps it. Exists only in demo mode.
 */
export function demoSessionRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const newGuests = new FixedWindowLimiter(deps.env.DEMO_GUESTS_PER_IP, 3_600_000)

  r.post('/session', async (c) => {
    if (c.get('user')) {
      return c.json({ ok: true })
    }
    const hit = newGuests.hit(clientIp(c, deps.env))
    if (!hit.ok) {
      c.header('Retry-After', String(hit.retryAfterSeconds))
      return c.json({ error: 'Too many demo boards from your address', code: 'RATE_LIMITED' }, 429)
    }
    if ((await guestCount(deps.db)) >= deps.env.DEMO_MAX_GUESTS) {
      return c.json({ error: 'The demo is full until the next reset', code: 'DEMO_FULL' }, 503)
    }
    const template = await templateBoardId(deps.db)
    if (!template) {
      return c.json({ error: 'The demo is being reset', code: 'DEMO_RESETTING' }, 503)
    }
    const guest = await createGuest(deps.db, template)
    const res = await deps.auth.api.signInEmail({
      body: guest,
      headers: c.req.raw.headers,
      asResponse: true,
    })
    if (!res.ok) {
      throw new Error(`guest sign-in failed: ${res.status}`)
    }
    for (const cookie of res.headers.getSetCookie()) {
      c.header('Set-Cookie', cookie, { append: true })
    }
    return c.json({ ok: true }, 201)
  })

  return r
}
