import { describe, expect, it } from 'vitest'
import {
  arrowPath,
  isShapeTool,
  linePath,
  rectCornersToPolyline,
  rectPathFromCorners,
} from './shape-path'

describe('isShapeTool', () => {
  it('accepts exactly line/arrow/rect', () => {
    expect(isShapeTool('line')).toBe(true)
    expect(isShapeTool('arrow')).toBe(true)
    expect(isShapeTool('rect')).toBe(true)
    expect(isShapeTool('pen')).toBe(false)
    expect(isShapeTool('marker')).toBe(false)
    expect(isShapeTool('eraser')).toBe(false)
    expect(isShapeTool('')).toBe(false)
  })
})

describe('linePath', () => {
  it('emits a single move + line', () => {
    expect(linePath({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe('M 1 2 L 3 4')
  })
})

describe('rectPathFromCorners', () => {
  it('normalizes reversed corners into the same closed path', () => {
    const forward = rectPathFromCorners({ x: 10, y: 20 }, { x: 30, y: 60 })
    const reversed = rectPathFromCorners({ x: 30, y: 60 }, { x: 10, y: 20 })
    expect(forward).toBe('M 10 20 L 30 20 L 30 60 L 10 60 Z')
    expect(reversed).toBe(forward)
  })

  it('handles a degenerate (zero-area) rect without NaN', () => {
    expect(rectPathFromCorners({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe('M 5 5 L 5 5 L 5 5 L 5 5 Z')
  })
})

describe('rectCornersToPolyline', () => {
  it('returns a closed 5-point loop, first equals last', () => {
    const loop = rectCornersToPolyline({ x: 30, y: 60 }, { x: 10, y: 20 })
    expect(loop).toHaveLength(5)
    expect(loop[0]).toEqual([10, 20])
    expect(loop[4]).toEqual(loop[0])
    expect(loop).toEqual([
      [10, 20],
      [30, 20],
      [30, 60],
      [10, 60],
      [10, 20],
    ])
  })
})

describe('arrowPath', () => {
  it('contains the shaft plus a two-segment head at the tip', () => {
    const d = arrowPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 4)
    expect(d.startsWith('M 0 0 L 100 0 M ')).toBe(true)
    // Head: two strokes meeting at the tip (the tip appears again inside the head part).
    expect(d.match(/L 100 0/g)).toHaveLength(2)
  })

  it('scales the head with stroke width but clamps to a legible minimum', () => {
    const thin = arrowPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 1) // head = max(4, 12) = 12
    const thick = arrowPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 8) // head = 32
    const headX = (d: string): number => {
      const m = d.match(/M ([\d.]+) /g)
      const last = m?.at(-1)?.slice(2) ?? '0'
      return Number.parseFloat(last)
    }
    // Larger head → the head start point is further from the tip (smaller x).
    expect(headX(thick)).toBeLessThan(headX(thin))
    expect(100 - headX(thin)).toBeCloseTo(12 * Math.cos(Math.PI / 6.5), 5)
  })

  it('degenerates to the bare shaft when a≈b (no NaN)', () => {
    const d = arrowPath({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)
    expect(d).toBe('M 5 5 L 5 5')
    expect(d).not.toContain('NaN')
  })
})
