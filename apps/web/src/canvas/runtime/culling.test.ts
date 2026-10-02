import { SpatialIndex } from '@corkspace/engine'
import { camera, screenSize, worldRect } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { computeMountSet, setsEqual } from './culling'

describe('computeMountSet', () => {
  it('mounts the viewport + overscan ring but only shows the strict viewport', () => {
    const idx = new SpatialIndex()
    idx.insert('inside', worldRect(10, 10, 10, 10))
    idx.insert('ring', worldRect(820, 10, 10, 10)) // outside 800px viewport, inside 300px overscan
    idx.insert('far', worldRect(5000, 5000, 10, 10))

    const { mount, visible } = computeMountSet(idx, camera(0, 0, 1), screenSize(800, 600), 300)

    expect(visible.has('inside')).toBe(true)
    expect(visible.has('ring')).toBe(false)
    expect(mount.has('inside')).toBe(true)
    expect(mount.has('ring')).toBe(true)
    expect(mount.has('far')).toBe(false)
  })

  it('pre-mounts a wider ring when extraOverscan is given (fast zoom-out)', () => {
    const idx = new SpatialIndex()
    idx.insert('inside', worldRect(10, 10, 10, 10))
    // viewport world x∈[0,800]; base 300px ring → [-300,1100]; +400 extra → [-700,1500].
    idx.insert('beyond', worldRect(1300, 10, 10, 10)) // outside base ring, inside +extra

    const base = computeMountSet(idx, camera(0, 0, 1), screenSize(800, 600), 300)
    expect(base.mount.has('beyond')).toBe(false)

    const widened = computeMountSet(idx, camera(0, 0, 1), screenSize(800, 600), 300, 400)
    expect(widened.mount.has('beyond')).toBe(true)
    expect(widened.visible.has('beyond')).toBe(false) // still hidden, just pre-mounted
  })
})

describe('setsEqual', () => {
  it('compares membership', () => {
    expect(setsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(setsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false)
    expect(setsEqual(new Set(['a']), new Set(['b']))).toBe(false)
  })
})
