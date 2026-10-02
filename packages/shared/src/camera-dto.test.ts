import { describe, expect, it } from 'vitest'
import { cameraSchema } from './camera-dto'

describe('cameraSchema', () => {
  it('accepts a valid camera', () => {
    expect(cameraSchema.parse({ x: -120.5, y: 300, zoom: 1.5 })).toEqual({
      x: -120.5,
      y: 300,
      zoom: 1.5,
    })
  })

  it('rejects a non-positive zoom and non-finite values', () => {
    expect(cameraSchema.safeParse({ x: 0, y: 0, zoom: 0 }).success).toBe(false)
    expect(cameraSchema.safeParse({ x: Number.NaN, y: 0, zoom: 1 }).success).toBe(false)
    expect(cameraSchema.safeParse({ x: 0, y: 0 }).success).toBe(false)
  })
})
