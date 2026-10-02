import { describe, expect, it } from 'vitest'
import type { EntryMeta } from '../state/entry-store'
import { anchorSnapshot, pickTopmostEntryAt } from './pick-entry'

const e = (id: string, x: number, y: number, zIndex: number, rotation = 0): EntryMeta => ({
  id,
  type: 'sticky',
  x,
  y,
  w: 100,
  h: 100,
  rotation,
  zIndex,
  visibility: 'private',
})

describe('pickTopmostEntryAt', () => {
  it('returns the highest z-index entry containing the point', () => {
    const a = e('a', 0, 0, 1)
    const b = e('b', 0, 0, 5) // overlaps a, higher z
    const c = e('c', 500, 500, 9) // elsewhere
    expect(pickTopmostEntryAt([a, b, c], { x: 50, y: 50 }, () => true)?.id).toBe('b')
  })

  it('returns null when no eligible entry contains the point', () => {
    expect(pickTopmostEntryAt([e('a', 0, 0, 1)], { x: 999, y: 999 }, () => true)).toBeNull()
  })

  it('respects the eligibility predicate (temp ids excluded even if topmost)', () => {
    const temp = e('temp', 0, 0, 9)
    const real = e('11111111-1111-1111-1111-111111111111', 0, 0, 1)
    const pick = pickTopmostEntryAt([temp, real], { x: 50, y: 50 }, (x) => x.id !== 'temp')
    expect(pick?.id).toBe(real.id)
  })

  it('honours rotation (a point rotated out of the frame misses; the centre still hits)', () => {
    const r = e('r', 0, 0, 1, 45)
    expect(pickTopmostEntryAt([r], { x: 50, y: 50 }, () => true)?.id).toBe('r')
    expect(pickTopmostEntryAt([r], { x: 2, y: 2 }, () => true)).toBeNull()
  })
})

describe('anchorSnapshot', () => {
  it('captures id + unrotated frame + rotation, or null', () => {
    expect(anchorSnapshot(e('a', 10, 20, 1, 7))).toEqual({
      id: 'a',
      rect: { x: 10, y: 20, w: 100, h: 100 },
      rotation: 7,
    })
    expect(anchorSnapshot(null)).toBeNull()
  })
})
