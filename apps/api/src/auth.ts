import type { Database } from '@corkspace/db'
import { account, session, user, verification } from '@corkspace/db/schema'
import { type Env, parseTrustedOrigins } from '@corkspace/shared'
import { hash, verify } from '@node-rs/argon2'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'

/**
 * Better Auth (email + password) wired onto our Drizzle schema.
 * - Open sign-up is DISABLED — viewer accounts are created only by an admin.
 * - Passwords use argon2id via @node-rs/argon2.
 * - The `admin` plugin provides `users.role` and admin-only user management.
 */
export function makeAuth(db: Database, env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: parseTrustedOrigins(env.AUTH_TRUSTED_ORIGINS),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: (password) => hash(password),
        verify: ({ hash: hashed, password }) => verify(hashed, password),
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
      // Key the rate limit on the client address. The api is reachable only through the bundled
      // nginx (infra/nginx.conf), which resolves the client behind trusted proxies (TRUSTED_PROXIES,
      // REAL_IP_HEADER) and always overwrites X-Real-IP with it, so a client cannot choose its own
      // bucket. Better Auth's default, X-Forwarded-For, is partly client-controlled: a forged value
      // gave fresh attempts, and a two-hop chain resolved to no address at all, so every visitor
      // shared one bucket per path.
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
    },
    rateLimit: {
      // Production only — avoids throttling test/dev login flows. The production limit is
      // exercised by a dedicated security check.
      enabled: env.NODE_ENV === 'production',
      window: 60,
      max: 100,
    },
    plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
  })
}

export type Auth = ReturnType<typeof makeAuth>
