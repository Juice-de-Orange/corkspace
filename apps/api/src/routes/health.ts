import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'

/** Public liveness + DB ping. Used by the container healthcheck. */
export function healthRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  r.get('/', async (c) => {
    try {
      await deps.db.execute(sql`select 1`)
      return c.json({ status: 'ok', db: 'up' })
    } catch {
      return c.json({ status: 'degraded', db: 'down' }, 503)
    }
  })
  return r
}
