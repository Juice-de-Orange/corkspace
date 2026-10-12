import { describe, expect, it } from 'vitest'
import { FixedWindowLimiter } from '../src/demo/rate-limit'

describe('FixedWindowLimiter', () => {
  it('allows `limit` hits per key and window, then reports the seconds until the window ends', () => {
    let now = 1_000_000
    const limiter = new FixedWindowLimiter(3, 60_000, () => now)
    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')].every((r) => r.ok)).toBe(true)
    const blocked = limiter.hit('a')
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(60)
    expect(limiter.hit('b').ok).toBe(true)

    now += 30_000
    expect(limiter.hit('a').retryAfterSeconds).toBe(30)
    now += 30_000
    expect(limiter.hit('a').ok).toBe(true)
  })

  it('forgets expired keys so the table cannot grow without bound', () => {
    let now = 0
    const limiter = new FixedWindowLimiter(1, 1_000, () => now, 100)
    for (let i = 0; i < 100; i++) {
      limiter.hit(`k${i}`)
    }
    expect(limiter.size).toBe(100)
    now += 1_000
    limiter.hit('fresh')
    expect(limiter.size).toBe(1)
  })

  it('refuses unknown keys once the table is full of live windows (fails closed)', () => {
    const limiter = new FixedWindowLimiter(5, 60_000, () => 0, 2)
    expect(limiter.hit('a').ok).toBe(true)
    expect(limiter.hit('b').ok).toBe(true)
    expect(limiter.hit('c').ok).toBe(false)
    expect(limiter.hit('a').ok).toBe(true)
  })
})
