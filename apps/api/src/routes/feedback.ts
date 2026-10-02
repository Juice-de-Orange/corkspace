import { feedback } from '@corkspace/db/schema'
import { createFeedbackSchema, patchFeedbackSchema } from '@corkspace/shared'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv, SessionUser } from '../app'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'

export function feedbackRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  const db = deps.db

  // Any authed user can submit feedback (bug / wish) with an optional screenshot data URL.
  r.post('/', requireAuth, async (c) => {
    const parsed = createFeedbackSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid feedback', issues: parsed.error.issues }, 400)
    }
    const user = c.get('user') as SessionUser
    const rows = await db
      .insert(feedback)
      .values({
        kind: parsed.data.kind,
        message: parsed.data.message,
        context: parsed.data.context ?? null,
        screenshot: parsed.data.screenshot ?? null,
        createdBy: user.id,
      })
      .returning({ id: feedback.id })
    return c.json({ ok: true, id: rows[0]?.id }, 201)
  })

  // Admin: list feedback (without the heavy screenshot payload; just a presence flag).
  r.get('/', requireSuperAdmin, async (c) =>
    c.json(
      await db
        .select({
          id: feedback.id,
          kind: feedback.kind,
          message: feedback.message,
          context: feedback.context,
          status: feedback.status,
          createdAt: feedback.createdAt,
          hasScreenshot: isNotNull(feedback.screenshot),
        })
        .from(feedback)
        .orderBy(desc(feedback.createdAt)),
    ),
  )

  // Admin: full item including the screenshot data URL.
  r.get('/:id', requireSuperAdmin, async (c) => {
    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, c.req.param('id')))
      .limit(1)
    return rows[0] ? c.json(rows[0]) : c.json({ error: 'not found' }, 404)
  })

  // Admin: delete a feedback item permanently.
  r.delete('/:id', requireSuperAdmin, async (c) => {
    const rows = await db
      .delete(feedback)
      .where(eq(feedback.id, c.req.param('id')))
      .returning({ id: feedback.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  // Admin: mark open/done.
  r.patch('/:id', requireSuperAdmin, async (c) => {
    const parsed = patchFeedbackSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ error: 'invalid patch' }, 400)
    }
    const rows = await db
      .update(feedback)
      .set({ status: parsed.data.status })
      .where(eq(feedback.id, c.req.param('id')))
      .returning({ id: feedback.id })
    return rows[0] ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })

  return r
}
