import { describe, expect, it } from 'vitest'
import {
  createConnectionSchema,
  createStrokeSchema,
  patchConnectionSchema,
  strokePointsBbox,
} from './canvas-dto'

describe('createStrokeSchema', () => {
  it('accepts a valid stroke and defaults the tool to pen', () => {
    const r = createStrokeSchema.safeParse({
      points: [
        [0, 0],
        [10, 5, 0.5],
      ],
      color: '#111',
      size: 4,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.tool).toBe('pen')
    }
  })

  it('rejects empty points, a malformed point, and a non-positive size', () => {
    expect(createStrokeSchema.safeParse({ points: [], color: '#111', size: 4 }).success).toBe(false)
    expect(createStrokeSchema.safeParse({ points: [[0]], color: '#111', size: 4 }).success).toBe(
      false,
    )
    expect(createStrokeSchema.safeParse({ points: [[0, 0]], color: '#111', size: 0 }).success).toBe(
      false,
    )
  })
})

describe('createConnectionSchema', () => {
  const a = '11111111-1111-1111-1111-111111111111'
  const b = '22222222-2222-2222-2222-222222222222'

  it('accepts two distinct entries with default red color + arrowEnd', () => {
    const r = createConnectionSchema.safeParse({ fromEntryId: a, toEntryId: b })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.color).toBe('#dc2626')
      expect(r.data.arrowEnd).toBe(true)
      expect(r.data.arrowStart).toBe(false)
    }
  })

  it('rejects a self-connection and a non-uuid endpoint', () => {
    expect(createConnectionSchema.safeParse({ fromEntryId: a, toEntryId: a }).success).toBe(false)
    expect(createConnectionSchema.safeParse({ fromEntryId: 'x', toEntryId: b }).success).toBe(false)
  })

  it('patch schema allows clearing a label and rejects unknown fields', () => {
    expect(patchConnectionSchema.safeParse({ label: null }).success).toBe(true)
    expect(patchConnectionSchema.safeParse({ nope: 1 }).success).toBe(false)
  })
})

describe('strokePointsBbox', () => {
  it('computes the tight bbox of raw points', () => {
    expect(
      strokePointsBbox([
        [0, 0],
        [10, 20],
        [30, 5],
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 20 })
  })

  it('returns a zero box for no points', () => {
    expect(strokePointsBbox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })
})
