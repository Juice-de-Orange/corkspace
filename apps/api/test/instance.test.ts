import { parseEnv } from '@corkspace/shared'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppDeps } from '../src/app'
import { instanceRoute } from '../src/routes/instance'

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  BETTER_AUTH_SECRET: 'test-secret-value-at-least-16-chars',
  BETTER_AUTH_URL: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'admin-password-123',
}

function get(raw: Record<string, string>) {
  const deps = { env: parseEnv(raw) } as unknown as AppDeps
  return new Hono().route('/instance', instanceRoute(deps)).request('/instance')
}

describe('instance route', () => {
  it('answers the brand name without a session, "Corkspace" by default', async () => {
    const res = await get(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ brandName: 'Corkspace' })
  })

  it('answers BRAND_NAME when it is set', async () => {
    const res = await get({ ...base, BRAND_NAME: '  Family pinboard ' })
    expect(await res.json()).toEqual({ brandName: 'Family pinboard' })
  })
})
