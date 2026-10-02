import { camera, screenSize, worldRect } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { contentBounds, minimapProjection, viewportMarker } from './minimap'

describe('contentBounds', () => {
  it('returns null for no content', () => {
    expect(contentBounds([])).toBeNull()
  })

  it('spans all rects', () => {
    expect(contentBounds([worldRect(0, 0, 10, 10), worldRect(90, 40, 10, 10)])).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 50,
    })
  })
})

describe('minimapProjection', () => {
  it('fits content into the minimap with a uniform scale', () => {
    const proj = minimapProjection(worldRect(0, 0, 1000, 500), screenSize(200, 200), 0)
    expect(proj.scale).toBeCloseTo(0.2, 6)
    expect(proj.project(worldRect(0, 0, 1000, 500))).toEqual({ x: 0, y: 0, w: 200, h: 100 })
  })
})

describe('viewportMarker', () => {
  it('projects the viewport into minimap space', () => {
    const proj = minimapProjection(worldRect(0, 0, 1000, 1000), screenSize(100, 100), 0)
    expect(viewportMarker(camera(0, 0, 1), screenSize(500, 500), proj)).toEqual({
      x: 0,
      y: 0,
      w: 50,
      h: 50,
    })
  })
})
