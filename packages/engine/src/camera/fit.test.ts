import type { Rect, ScreenSize } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { worldToScreen } from './convert'
import { cameraForRect } from './fit'

const vp: ScreenSize = { w: 1000, h: 800 } as ScreenSize

describe('cameraForRect', () => {
  it('centers the rect in the viewport', () => {
    const rect: Rect = { x: 500, y: 500, w: 200, h: 200 }
    const cam = cameraForRect(rect, vp)
    const center = worldToScreen({ x: 600, y: 600 } as never, cam)
    expect(center.x).toBeCloseTo(500, 5)
    expect(center.y).toBeCloseTo(400, 5)
  })

  it('zooms to fit with margin and clamps to the zoom bounds', () => {
    const small: Rect = { x: 0, y: 0, w: 10, h: 10 }
    const cam = cameraForRect(small, vp)
    expect(cam.zoom).toBeLessThanOrEqual(8) // clamped to ZOOM.max
    expect(cam.zoom).toBeGreaterThan(0)
  })
})
