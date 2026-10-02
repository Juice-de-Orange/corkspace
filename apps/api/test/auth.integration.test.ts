import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedAdmin } from '../src/seed/admin'
import { adminCreds, createTestApp, login, type TestApp } from './helpers/app'

describe('Phase 0 — auth, health, RBAC', () => {
  let ctx: TestApp

  beforeAll(async () => {
    ctx = await createTestApp()
  })

  afterAll(async () => {
    await ctx?.stop()
  })

  it('serves public /api/health with the DB up', async () => {
    const res = await ctx.app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; db: string }
    expect(body.status).toBe('ok')
    expect(body.db).toBe('up')
  })

  it('rejects /api/me when unauthenticated (401)', async () => {
    const res = await ctx.app.request('/api/me')
    expect(res.status).toBe(401)
  })

  it('lets the admin log in; /api/me returns role=admin', async () => {
    const cookie = await login(ctx.app, adminCreds.email, adminCreds.password)
    const res = await ctx.app.request('/api/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { email: string; role: string }
    expect(body.email).toBe(adminCreds.email)
    expect(body.role).toBe('admin')
  })

  it('has open sign-up DISABLED (no self-registration)', async () => {
    const res = await ctx.app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'intruder@example.com', password: 'password123', name: 'X' }),
    })
    expect(res.status).not.toBe(200)
    // The would-be account must not be usable.
    const login2 = await ctx.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'intruder@example.com', password: 'password123' }),
    })
    expect(login2.status).not.toBe(200)
  })

  it('admin seed is idempotent (no-op when the admin already exists)', async () => {
    const again = await seedAdmin(ctx.testDb.db, ctx.env)
    expect(again.created).toBe(false)
  })
})
