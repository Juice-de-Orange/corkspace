import { worldToScreen } from '@corkspace/engine'
import { screenPoint } from '@corkspace/shared/kernel'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyArrowPan,
  applyPan,
  applyWheelZoom,
  cameraAtom,
  getCamera,
  screenToWorldAtCursor,
  setCamera,
  setViewport,
  viewportAtom,
} from './camera-store'

beforeEach(() => {
  setCamera({ x: 0, y: 0, zoom: 1 })
  setViewport(800, 600)
})

describe('camera-store', () => {
  it('exposes camera + viewport atoms', () => {
    expect(getCamera()).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(viewportAtom.value).toEqual({ w: 800, h: 600 })
  })

  it('pans by a screen delta', () => {
    applyPan(10, -5)
    expect(cameraAtom.value).toEqual({ x: 10, y: -5, zoom: 1 })
  })

  it('zooms to the cursor, keeping that world point fixed', () => {
    const cursor = screenPoint(300, 200)
    const worldBefore = screenToWorldAtCursor(cursor.x, cursor.y)
    applyWheelZoom(cursor.x, cursor.y, -120)
    const c = cameraAtom.value
    expect(c.zoom).toBeGreaterThan(1)
    const reprojected = worldToScreen(worldBefore, c)
    expect(reprojected.x).toBeCloseTo(cursor.x, 6)
    expect(reprojected.y).toBeCloseTo(cursor.y, 6)
  })

  it('arrow-pans the viewport', () => {
    applyArrowPan('right')
    expect(cameraAtom.value.x).toBeLessThan(0)
  })
})
