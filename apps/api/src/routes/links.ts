import { type LinkPreview, parseLinkPreview } from '@corkspace/shared'
import { safeFetch } from '@corkspace/shared/server'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { requireSuperAdmin } from '../middleware/auth'

const previewSchema = z.object({ url: z.string().url() })

export function linksRoute() {
  const r = new Hono<AppEnv>()

  // Fetch link metadata for a link card. SSRF-safe; degrades to the bare URL on any failure
  // (blocked target, non-html, unreachable) so no internal content is ever leaked.
  r.post('/preview', requireSuperAdmin, async (c) => {
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
