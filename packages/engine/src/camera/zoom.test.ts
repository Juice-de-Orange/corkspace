import { camera, screenPoint } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { screenToWorld, worldToScreen } from './convert'
import { clampZoom, wheelToZoom, zoomToCursor } from './zoom'

describe('clampZoom', () => {
  it('clamps to the product bounds', () => {
    expect(clampZoom(0)).toBe(0.02)
    expect(clampZoom(1000)).toBe(8)
    expect(clampZoom(1)).toBe(1)
  })
})

describe('zoomToCursor', () => {
  it('keeps the world point under the cursor fixed on screen', () => {
    const c = camera(120, -40, 1.5)
    const cursor = screenPoint(640, 360)
    const worldUnder = screenToWorld(cursor, c)

    const next = zoomToCursor(c, cursor, 3.2)
    expect(next.zoom).toBe(3.2)

    const reprojected = worldToScreen(worldUnder, next)
    expect(reprojected.x).toBeCloseTo(cursor.x, 6)
    expect(reprojected.y).toBeCloseTo(cursor.y, 6)
  })

  it('clamps the target zoom while still pinning the cursor', () => {
    const c = camera(0, 0, 1)
    const cursor = screenPoint(200, 100)
    const worldUnder = screenToWorld(cursor, c)
    const next = zoomToCursor(c, cursor, 999)
    expect(next.zoom).toBe(8)
    const reprojected = worldToScreen(worldUnder, next)
    expect(reprojected.x).toBeCloseTo(cursor.x, 6)
    expect(reprojected.y).toBeCloseTo(cursor.y, 6)
  })
})

describe('wheelToZoom', () => {
  it('zooms in on negative deltaY and out on positive deltaY', () => {
    expect(wheelToZoom(1, -100)).toBeGreaterThan(1)
    expect(wheelToZoom(1, 100)).toBeLessThan(1)
  })

  it('stays within bounds', () => {
    expect(wheelToZoom(8, -100000)).toBe(8)
    expect(wheelToZoom(0.02, 100000)).toBe(0.02)
  })
})
