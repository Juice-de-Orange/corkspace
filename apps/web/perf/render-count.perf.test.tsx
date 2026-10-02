import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetRenderCounts, totalRenderCount } from '../src/canvas/devtools/render-count'
import { applyPan, applyWheelZoom } from '../src/canvas/state/camera-store'
import { frame, mountBoard } from './_harness'

describe('camera move triggers no entry re-renders', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a small pan re-renders zero existing entries', () => {
    mountBoard(5000)
    resetRenderCounts()
    applyPan(30, 20)
    frame()
    expect(totalRenderCount()).toBe(0)
  })

  it('zooming in re-renders zero entries (imperative LOD, memoized views)', () => {
    mountBoard(5000)
    resetRenderCounts()
    applyWheelZoom(640, 400, -120) // negative deltaY → zoom in → mount set shrinks
    frame()
    expect(totalRenderCount()).toBe(0)
  })

  it('the idle re-snap frame after a gesture re-renders zero entries', () => {
    vi.useFakeTimers()
    mountBoard(5000)
    resetRenderCounts()
    applyPan(30, 20)
    frame()
    // Camera goes still → the runtime re-snaps the world transform; entries must NOT re-render.
    vi.advanceTimersByTime(200)
    frame()
    expect(totalRenderCount()).toBe(0)
  })
})
