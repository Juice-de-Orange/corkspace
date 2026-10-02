import { camera, screenSize, worldRect } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { SpatialIndex } from './index'

describe('SpatialIndex', () => {
  it('inserts, searches, updates and removes by id', () => {
    const idx = new SpatialIndex()
    idx.insert('a', worldRect(0, 0, 10, 10))
    idx.insert('b', worldRect(100, 100, 10, 10))
    expect(idx.size).toBe(2)
    expect(idx.searchRect(worldRect(-5, -5, 20, 20))).toEqual(['a'])

    idx.update('a', worldRect(100, 100, 10, 10))
    expect(idx.searchRect(worldRect(-5, -5, 20, 20))).toEqual([])
    expect(idx.searchRect(worldRect(95, 95, 20, 20)).sort()).toEqual(['a', 'b'])

    idx.remove('a')
    expect(idx.size).toBe(1)
    idx.remove('missing') // no-op
    expect(idx.size).toBe(1)
  })

  it('bulk-loads and clears', () => {
    const idx = new SpatialIndex()
    idx.bulkLoad([
      { id: '1', rect: worldRect(0, 0, 5, 5) },
      { id: '2', rect: worldRect(1000, 0, 5, 5) },
    ])
    expect(idx.size).toBe(2)
    idx.clear()
    expect(idx.size).toBe(0)
  })

  it('returns only viewport-visible ids (with overscan)', () => {
    const idx = new SpatialIndex()
    idx.insert('vis', worldRect(10, 10, 10, 10))
    idx.insert('far', worldRect(5000, 5000, 10, 10))
    const visible = idx.visibleIds(camera(0, 0, 1), screenSize(800, 600), 100)
    expect(visible).toEqual(['vis'])
  })

  it('culls correctly at 5k entries (only the viewport returned)', () => {
    const idx = new SpatialIndex()
    const items = Array.from({ length: 5000 }, (_, i) => ({
      id: `e${i}`,
      rect: worldRect((i % 100) * 300, Math.floor(i / 100) * 300, 240, 240),
    }))
    idx.bulkLoad(items)
    expect(idx.size).toBe(5000)
    const visible = idx.visibleIds(camera(0, 0, 1), screenSize(800, 600), 0)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThanOrEqual(16)
  })
})
