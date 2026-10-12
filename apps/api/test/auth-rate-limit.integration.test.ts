import { startTestDb, type TestDb } from '@corkspace/db/testing'
import { parseEnv } from '@corkspace/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type App, buildApp } from '../src/app'
import { makeAuth } from '../src/auth'

// The sign-in limit only runs in production (Better Auth: 3 attempts per 10 s per client and path).
// The api sits behind the bundled nginx, which sets X-Real-IP to the client address it resolved and
// overwrites whatever a client sent in that header.
const ORIGIN = 'http://localhost:3000'

describe('sign-in rate limit is kept per client address', () => {
  let testDb: TestDb
  let app: App

  beforeAll(async () => {
    testDb = await startTestDb()
    const env = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: testDb.url,
      BETTER_AUTH_SECRET: 'test-secret-value-at-least-16-chars',
      BETTER_AUTH_URL: ORIGIN,
      AUTH_TRUSTED_ORIGINS: ORIGIN,
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'admin-password-123',
    })
    app = buildApp({ db: testDb.db, env, auth: makeAuth(testDb.db, env) })
  })

  afterAll(async () => {
    await testDb?.stop()
  })

  const signIn = (headers: Record<string, string>) =>
    app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password-123' }),
    })

  it('a client that hits the limit does not lock out another client', async () => {
    const a = { 'x-real-ip': '198.51.100.10' }
    for (let i = 0; i < 3; i++) {
      expect((await signIn(a)).status).toBe(401)
    }
    expect((await signIn(a)).status).toBe(429)
    // Another visitor, same path, same window: still gets an answer to its own attempt.
    expect((await signIn({ 'x-real-ip': '198.51.100.11' })).status).toBe(401)
  })

  it('a client cannot get fresh attempts by sending its own X-Forwarded-For', async () => {
    const real = { 'x-real-ip': '198.51.100.20' }
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      statuses.push((await signIn({ ...real, 'x-forwarded-for': `203.0.113.${i + 1}` })).status)
    }
    expect(statuses).toEqual([401, 401, 401, 429, 429])
  })
})
