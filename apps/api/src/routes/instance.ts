import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'

/** Public instance settings the web app needs before sign-in (the brand on the login page). */
export function instanceRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  r.get('/', (c) => c.json({ brandName: deps.env.BRAND_NAME }))
  return r
}
