import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../app'
import type { Auth } from '../auth'

/** Resolve the Better Auth session and expose a normalized user on the context. */
export function sessionMiddleware(auth: Auth): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers })
    if (result?.user) {
      const u = result.user as { id: string; email: string; name: string; role?: string }
      c.set('user', { id: u.id, email: u.email, name: u.name, role: u.role ?? 'user' })
    } else {
      c.set('user', null)
    }
    await next()
  }
}
