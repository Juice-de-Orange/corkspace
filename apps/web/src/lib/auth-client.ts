import { createAuthClient } from 'better-auth/react'

/** Better Auth browser client. In dev, Vite proxies `/api` to the api server; in prod the
 *  SPA and api share an origin behind nginx, so same-origin is the right default. */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? window.location.origin,
})

export const { signIn, signOut, useSession } = authClient
