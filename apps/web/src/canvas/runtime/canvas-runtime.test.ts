import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCamera } from '../state/camera-store'
import { startCanvasRuntime, worldTransformString } from './canvas-runtime'
import { interactingAtom } from './gesture-state'
import { flushFrameSync } from './raf'

describe('worldTransformString', () => {
  it('writes the EXACT fractional translate during a gesture (smooth motion)', () => {
    const s = worldTransformString({ x: -123.4, y: 55.6, zoom: 1.5 }, { interacting: true, dpr: 1 })
    expect(s).toBe('translate(-123.4px, 55.6px) scale(1.5)')
  })

  it('snaps the translate to the device-pixel grid when idle (dpr 1 → crisp text)', () => {
    const s = worldTransformString(
      { x: -123.4, y: 55.6, zoom: 1.5 },
      { interacting: false, dpr: 1 },
    )
    expect(s).toBe('translate(-123px, 56px) scale(1.5)')
  })

  it('snaps to half-pixels at dpr 2 and never touches scale', () => {
    const s = worldTransformString({ x: 10.3, y: -10.3, zoom: 1 }, { interacting: false, dpr: 2 })
    // round(10.3*2)/2 = 10.5 ; round(-10.3*2)/2 = -10.5
    expect(s).toBe('translate(10.5px, -10.5px) scale(1)')
  })
})

describe('canvas runtime — snap only when idle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    interactingAtom.set(false)
    setCamera({ x: 0, y: 0, zoom: 1 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the fractional translate + is-zooming while moving, then snaps after settle', async () => {
    const world = document.createElement('div')
    const stop = startCanvasRuntime(world)
    try {
      setCamera({ x: -20.7, y: 5.3, zoom: 2 })
      // The "moving" flag is set in a microtask (see canvas-runtime.ts); in a browser microtasks
      // always run before the next animation frame, so drain them before the synchronous frame.
      await Promise.resolve()
      flushFrameSync()
      // Mid-gesture: exact translate + the cheap-shadow class.
      expect(world.style.transform).toBe('translate(-20.7px, 5.3px) scale(2)')
      expect(world.classList.contains('is-zooming')).toBe(true)

      // Camera goes still → after the idle debounce the transform re-snaps and the class drops.
      vi.advanceTimersByTime(200)
      flushFrameSync()
      expect(world.classList.contains('is-zooming')).toBe(false)
      expect(world.style.transform).toBe('translate(-21px, 5px) scale(2)') // jsdom dpr defaults to 1
    } finally {
      stop()
    }
  })

  it('a camera change on an idle board does not throw (flights start from idle)', async () => {
    const world = document.createElement('div')
    const stop = startCanvasRuntime(world)
    try {
      vi.advanceTimersByTime(200) // settle: the board is idle again
      expect(interactingAtom.value).toBe(false)
      // A fly-to (search jump, minimap, teleport, internal link) sets the camera from rAF while the
      // board is idle. Flipping `interacting` synchronously inside the camera reaction made signia
      // throw "cannot change atoms during reaction cycle", which killed the flight after one frame.
      expect(() => setCamera({ x: 5, y: 5, zoom: 1 })).not.toThrow()
      await Promise.resolve()
      expect(interactingAtom.value).toBe(true)
    } finally {
      stop()
    }
  })
})
