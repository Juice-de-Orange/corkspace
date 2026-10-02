import { camera, screenSize } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { createFlight } from './flight'
import { interpolateView } from './vanwijk'

const VP = screenSize(1000, 800)

describe('createFlight (van Wijk)', () => {
  it('reproduces both endpoints', () => {
    const from = camera(0, 0, 1)
    const to = camera(-2000, -1500, 2)
    const f = createFlight(from, to, { screenSize: VP })

    const a0 = f.at(0)
    expect(a0.x).toBeCloseTo(from.x, 3)
    expect(a0.y).toBeCloseTo(from.y, 3)
    expect(a0.zoom).toBeCloseTo(from.zoom, 3)

    const a1 = f.at(f.durationMs)
    expect(a1.x).toBeCloseTo(to.x, 2)
    expect(a1.y).toBeCloseTo(to.y, 2)
    expect(a1.zoom).toBeCloseTo(to.zoom, 3)
  })

  it('scales duration with distance, clamped to bounds', () => {
    const near = createFlight(camera(0, 0, 1), camera(40, 0, 1.02), { screenSize: VP })
    const far = createFlight(camera(0, 0, 1), camera(-50000, -40000, 4), { screenSize: VP })
    expect(far.durationMs).toBeGreaterThan(near.durationMs)
    expect(far.durationMs).toBeLessThanOrEqual(1400)
    expect(near.durationMs).toBeGreaterThanOrEqual(200)
  })

  it('zooms out mid-flight for a long pan (the arc)', () => {
    const f = createFlight(camera(0, 0, 2), camera(-20000, 0, 2), { screenSize: VP })
    expect(f.at(f.durationMs / 2).zoom).toBeLessThan(2)
  })

  it('reduced motion is a short straight lerp with no zoom-out arc', () => {
    const f = createFlight(camera(0, 0, 2), camera(-20000, 0, 2), {
      screenSize: VP,
      reducedMotion: true,
    })
    expect(f.durationMs).toBeLessThanOrEqual(220)
    const mid = f.at(f.durationMs / 2)
    expect(mid.zoom).toBeCloseTo(2, 6)
    expect(mid.x).toBeCloseTo(-10000, 0)
  })

  it('clamps elapsed time outside [0, duration]', () => {
    const f = createFlight(camera(0, 0, 1), camera(100, 100, 2), { screenSize: VP })
    expect(f.at(-100)).toEqual(f.at(0))
    expect(f.at(f.durationMs + 999)).toEqual(f.at(f.durationMs))
  })
})

describe('interpolateView same-center case', () => {
  it('interpolates width exponentially when centers match', () => {
    const i = interpolateView({ cx: 0, cy: 0, w: 100 }, { cx: 0, cy: 0, w: 25 })
    expect(i.at(0).w).toBeCloseTo(100, 6)
    expect(i.at(1).w).toBeCloseTo(25, 6)
    expect(i.at(0.5).cx).toBe(0)
  })
})
