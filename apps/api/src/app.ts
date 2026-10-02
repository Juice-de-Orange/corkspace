import type { Database } from '@corkspace/db'
import type { Env } from '@corkspace/shared'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth'
import { sessionMiddleware } from './middleware/session'
import { adminRoute } from './routes/admin'
import { assetsServeRoute } from './routes/assets'
import { boardsRoute } from './routes/boards'
import { feedbackRoute } from './routes/feedback'
import { healthRoute } from './routes/health'
import { linksRoute } from './routes/links'
import { meRoute } from './routes/me'
import { publicRoute } from './routes/public'
import type { BoardAccess } from './services/board-access'

export interface AppDeps {
  db: Database
  env: Env
  auth: Auth
}

/** The authenticated user shape we expose on the Hono context. */
export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

export interface AppEnv {
  Variables: {
    user: SessionUser | null
    // Set by boardContext / publicTokenContext on board-scoped + public routes.
    boardId?: string
    access?: BoardAccess
  }
}

export function buildApp(deps: AppDeps) {
  const app = new Hono<AppEnv>()

  app.use('*', secureHeaders())

  // Better Auth owns its routes (incl. its own CSRF via trustedOrigins + rate limiting).
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw))

  // Load the session for all of OUR routes (registered after this middleware).
  app.use('*', sessionMiddleware(deps.auth))

  app.route('/api/health', healthRoute(deps))
  app.route('/api/me', meRoute(deps))
  app.route('/api/links', linksRoute())
  // Serve asset bytes by global id (board resolved from the asset). Uploads live under a board.
  app.route('/api/assets', assetsServeRoute(deps))
  // Board management + all board-scoped content (entries/connections/strokes/tags/frames/
  // teleports/dashboard/assets), each behind boardContext.
  app.route('/api/boards', boardsRoute(deps))
  // External, account-less read tree (GET-only): no mutation handler exists here by construction.
  app.route('/api/public', publicRoute(deps))
  // Super-admin: user creation, global defaults, all boards, stats.
  app.route('/api/admin', adminRoute(deps))
  // Feedback: POST submit (any authed user), review endpoints (super-admin).
  app.route('/api/feedback', feedbackRoute(deps))

  app.onError((err, c) => {
    console.error('[api] unhandled error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  })

  return app
}

export type App = ReturnType<typeof buildApp>
