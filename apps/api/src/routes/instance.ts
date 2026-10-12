import { Hono } from 'hono'
import type { AppDeps, AppEnv } from '../app'

/** Public instance settings the web app needs before sign-in: the brand on the login page, and
 *  `demo: true` on a public demo (banner, guest start instead of the sign-in form). */
export function instanceRoute(deps: AppDeps) {
  const r = new Hono<AppEnv>()
  r.get('/', (c) =>
    c.json({
      brandName: deps.env.BRAND_NAME,
      ...(deps.env.DEMO_MODE === 'on' ? { demo: true } : {}),
    }),
  )
  return r
}
