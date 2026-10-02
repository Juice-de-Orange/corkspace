import { screenSize } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { capLongEdge, worldSizeForNewEntry } from './create-size'

describe('worldSizeForNewEntry', () => {
  it('equals the reference size at zoom 1', () => {
    expect(worldSizeForNewEntry(screenSize(240, 240), 1)).toEqual({ w: 240, h: 240 })
  })

  it('grows the world size when zoomed out (so it looks normal on screen)', () => {
    expect(worldSizeForNewEntry(screenSize(240, 240), 0.5)).toEqual({ w: 480, h: 480 })
  })

  it('shrinks the world size when zoomed in', () => {
    expect(worldSizeForNewEntry(screenSize(400, 520), 2)).toEqual({ w: 200, h: 260 })
  })

  it('throws for a non-positive zoom', () => {
    expect(() => worldSizeForNewEntry(screenSize(240, 240), 0)).toThrow(RangeError)
    expect(() => worldSizeForNewEntry(screenSize(240, 240), -1)).toThrow(RangeError)
  })
})

describe('capLongEdge', () => {
  it('leaves small images untouched', () => {
    expect(capLongEdge(screenSize(400, 300), 800)).toEqual({ w: 400, h: 300 })
  })

  it('caps the long edge and preserves aspect ratio', () => {
    expect(capLongEdge(screenSize(1600, 800), 800)).toEqual({ w: 800, h: 400 })
    expect(capLongEdge(screenSize(800, 1600), 800)).toEqual({ w: 400, h: 800 })
  })
})
