import { worldSize } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { lodForEntry, lodForOnScreenLongEdge, lodWithHysteresis, onScreenLongEdge } from './lod'

const T = { fullPx: 200, previewPx: 36 }

describe('onScreenLongEdge', () => {
  it('is the longer world edge times zoom', () => {
    expect(onScreenLongEdge(worldSize(100, 240), 2)).toBe(480)
  })
})

describe('lodForOnScreenLongEdge', () => {
  it('buckets at the thresholds (inclusive lower bound)', () => {
    expect(lodForOnScreenLongEdge(200, T)).toBe('full')
    expect(lodForOnScreenLongEdge(199.9, T)).toBe('preview')
    expect(lodForOnScreenLongEdge(36, T)).toBe('preview')
    expect(lodForOnScreenLongEdge(35.9, T)).toBe('block')
  })
})

describe('lodForEntry', () => {
  it('combines size and zoom', () => {
    expect(lodForEntry(worldSize(240, 240), 1, T)).toBe('full')
    expect(lodForEntry(worldSize(240, 240), 0.5, T)).toBe('preview')
    expect(lodForEntry(worldSize(240, 240), 0.1, T)).toBe('block')
  })
})

describe('lodWithHysteresis', () => {
  it('holds the current bucket within the band', () => {
    // just below fullPx but within the band → stays full
    expect(lodWithHysteresis('full', 190, T)).toBe('full')
    // well below the band → drops
    expect(lodWithHysteresis('full', 150, T)).toBe('preview')
  })

  it('requires exceeding the band to climb out of block/preview', () => {
    expect(lodWithHysteresis('block', 38, T)).toBe('block') // within band above previewPx
    expect(lodWithHysteresis('block', 60, T)).toBe('preview')
    expect(lodWithHysteresis('preview', 230, T)).toBe('full') // above fullPx*(1+band)
    expect(lodWithHysteresis('preview', 30, T)).toBe('block') // below previewPx*(1-band)
    expect(lodWithHysteresis('preview', 100, T)).toBe('preview')
  })
})
