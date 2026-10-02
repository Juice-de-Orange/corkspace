import { describe, expect, it } from 'vitest'
import { isUuid } from './uuid'

describe('isUuid', () => {
  it('accepts canonical v4 uuids (either case)', () => {
    expect(isUuid('8f14e45f-ceea-467f-a34e-d624e3f5c246')).toBe(true)
    expect(isUuid('8F14E45F-CEEA-467F-A34E-D624E3F5C246')).toBe(true)
  })

  it('rejects temp ids, empty strings and near-misses', () => {
    expect(isUuid('temp-stroke-3')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid('8f14e45fceea467fa34ed624e3f5c246')).toBe(false)
    expect(isUuid('8f14e45f-ceea-467f-a34e-d624e3f5c24')).toBe(false)
    expect(isUuid('g814e45f-ceea-467f-a34e-d624e3f5c246')).toBe(false)
  })
})
