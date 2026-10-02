import { describe, expect, it } from 'vitest'
import { dragWorldPos, eraseReach, pinchStep, pointerDistance } from './gesture-math'

describe('dragWorldPos', () => {
  it('adds the screen delta divided by zoom to the entry start', () => {
    expect(dragWorldPos({ x: 100, y: 100 }, { x: 0, y: 0 }, { x: 20, y: 10 }, 2)).toEqual({
      x: 110,
      y: 105,
    })
  })
})

describe('eraseReach', () => {
  it('is a constant 12 screen px expressed in world units', () => {
    expect(eraseReach(1)).toBe(12)
    expect(eraseReach(4)).toBe(3)
  })
})

describe('pointerDistance', () => {
  it('is the euclidean distance', () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('pinchStep', () => {
  it('returns no action on the first sample, only the next state', () => {
    const { next, action } = pinchStep(null, { x: 0, y: 0 }, { x: 10, y: 0 }, 1)
    expect(action).toBeNull()
    expect(next).toEqual({ dist: 10, midX: 5, midY: 0 })
  })

  it('reports the midpoint pan delta and the zoom ratio on later samples', () => {
    const prev = { dist: 10, midX: 5, midY: 0 }
    const { next, action } = pinchStep(prev, { x: 5, y: 0 }, { x: 25, y: 0 }, 2)
    expect(next).toEqual({ dist: 20, midX: 15, midY: 0 })
    expect(action).toEqual({ panDx: 10, panDy: 0, midX: 15, midY: 0, zoom: 4 })
  })

  it('yields a null zoom when the previous distance was 0 (no division)', () => {
    const { action } = pinchStep({ dist: 0, midX: 0, midY: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }, 3)
    expect(action?.zoom).toBeNull()
  })
})
