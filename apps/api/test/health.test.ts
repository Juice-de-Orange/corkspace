import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppDeps } from '../src/app'
import { healthRoute } from '../src/routes/health'

describe('health route', () => {
  it('reports degraded (503) when the DB ping fails', async () => {
    const deps = {
      db: {
        execute: () => Promise.reject(new Error('db down')),
      },
    } as unknown as AppDeps

    const app = new Hono().route('/health', healthRoute(deps))
    const res = await app.request('/health')

    expect(res.status).toBe(503)
    const body = (await res.json()) as { status: string; db: string }
    expect(body.status).toBe('degraded')
    expect(body.db).toBe('down')
  })
})
