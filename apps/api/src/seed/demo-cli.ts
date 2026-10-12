/**
 * Fill a running instance with a synthetic demo board — for screenshots, demos and trying the
 * canvas without typing everything yourself. Talks to the HTTP API like the web app does, so every
 * item goes through the same validation.
 *
 *   SEED_URL=http://localhost:8080 SEED_EMAIL=admin@example.com SEED_PASSWORD=… pnpm db:seed-demo
 *
 * SEED_EMAIL / SEED_PASSWORD default to ADMIN_EMAIL / ADMIN_PASSWORD. The content is added to the
 * user's default board; run it on an empty board (it does not deduplicate). Better Auth checks the
 * Origin header in production: it is the origin of SEED_URL unless SEED_ORIGIN says otherwise
 * (needed when SEED_URL points at the api container directly instead of the public address).
 */

import { type Json, seedDemoBoard } from './demo-content'

const base = (process.env.SEED_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const email = process.env.SEED_EMAIL ?? process.env.ADMIN_EMAIL ?? ''
const password = process.env.SEED_PASSWORD ?? process.env.ADMIN_PASSWORD ?? ''
const origin = new URL(process.env.SEED_ORIGIN ?? base).origin

let cookie = ''

async function call(method: string, path: string, body?: Json): Promise<Json> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', origin, cookie },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${base}${path}`, init)
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as Json) : {}
}

async function main(): Promise<void> {
  if (!email || !password) {
    throw new Error('set SEED_EMAIL and SEED_PASSWORD (or ADMIN_EMAIL and ADMIN_PASSWORD)')
  }
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password }),
  })
  if (!signIn.ok) {
    throw new Error(`sign-in failed: ${signIn.status}`)
  }
  cookie = signIn.headers.get('set-cookie')?.split(';')[0] ?? ''
  const me = await call('GET', '/api/me')
  await seedDemoBoard(call, String(me.defaultBoardId))
  process.stdout.write(`demo board filled: ${origin}/b/${String(me.defaultBoardId)}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
