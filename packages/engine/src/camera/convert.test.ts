import { camera, screenPoint, screenSize, worldPoint } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import {
  screenSizeToWorld,
  screenToWorld,
  viewportWorldRect,
  worldSizeToScreen,
  worldToScreen,
} from './convert'

describe('world↔screen conversion', () => {
  it('applies screen = camera + zoom·world', () => {
    const c = camera(100, 50, 2)
    expect(worldToScreen(worldPoint(10, 20), c)).toEqual({ x: 120, y: 90 })
    expect(screenToWorld(screenPoint(120, 90), c)).toEqual({ x: 10, y: 20 })
  })

  it('round-trips world→screen→world at the extreme zoom bounds', () => {
    for (const zoom of [0.02, 1, 8]) {
      const c = camera(-37.5, 211.25, zoom)
      const p = worldPoint(1234.5, -987.25)
      const back = screenToWorld(worldToScreen(p, c), c)
      expect(back.x).toBeCloseTo(p.x, 6)
      expect(back.y).toBeCloseTo(p.y, 6)
    }
  })

  it('scales sizes by zoom', () => {
    const c = camera(0, 0, 4)
    expect(worldSizeToScreen(screenSizeToWorld(screenSize(240, 240), c), c)).toEqual({
      w: 240,
      h: 240,
    })
  })

  it('computes the visible world rect for a viewport', () => {
    const c = camera(0, 0, 2)
    const r = viewportWorldRect(c, screenSize(800, 600))
    expect(r).toEqual({ x: 0, y: 0, w: 400, h: 300 })
  })
})
