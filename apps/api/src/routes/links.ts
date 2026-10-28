import { type LinkPreview, parseLinkPreview } from '@corkspace/shared'
import { safeFetch } from '@corkspace/shared/server'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv, SessionUser } from '../app'
import { FixedWindowLimiter } from '../demo/rate-limit'
import { requireBoardEditor } from '../middleware/board'

const previewSchema = z.object({ url: z.string().url() })

/** Previews one user may request per minute: each one is an outbound fetch by the server. */
const PREVIEWS_PER_MINUTE = 30

/** Board-scoped (`/api/boards/:boardId/links`): anyone who may edit the board may add link cards. */
export function linksRoute() {
  const r = new Hono<AppEnv>()
  const previews = new FixedWindowLimiter(PREVIEWS_PER_MINUTE, 60_000)

  // Fetch link metadata for a link card. SSRF-safe; degrades to the bare URL on any failure
  // (blocked target, non-html, unreachable) so no internal content is ever leaked.
  r.post('/preview', requireBoardEditor, async (c) => {
    const hit = previews.hit((c.get('user') as SessionUser).id)
    if (!hit.ok) {
      c.header('Retry-After', String(hit.retryAfterSeconds))
      return c.json({ error: 'Too many requests' }, 429)
    }
    const parsed = previewSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid url' }, 400)
    }
    const url = parsed.data.url
    try {
      const res = await safeFetch(url, {
        allowedContentTypes: ['text/html'],
        maxBytes: 1024 * 1024,
      })
      return c.json(parseLinkPreview(url, res.body.toString('utf8')))
    } catch {
      return c.json({ url } satisfies LinkPreview)
    }
  })

  return r
}
