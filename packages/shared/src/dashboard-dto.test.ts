import { describe, expect, it } from 'vitest'
import {
  normalizeRegion,
  normalizeSearchParams,
  type SearchParams,
  searchParamsSchema,
} from './dashboard-dto'

describe('searchParamsSchema', () => {
  it('accepts a full valid params object', () => {
    const r = searchParamsSchema.safeParse({
      q: 'hallo',
      types: ['sticky', 'doc'],
      tagIds: ['11111111-1111-1111-1111-111111111111'],
      includeDeleted: true,
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-12-31T00:00:00.000Z',
      region: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      linkStatus: 'linked',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown fields (strict)', () => {
    expect(searchParamsSchema.safeParse({ nope: 1 }).success).toBe(false)
  })

  it('rejects an invalid entry type', () => {
    expect(searchParamsSchema.safeParse({ types: ['frame'] }).success).toBe(false)
  })

  it('rejects a non-uuid tag id', () => {
    expect(searchParamsSchema.safeParse({ tagIds: ['not-a-uuid'] }).success).toBe(false)
  })

  it('rejects a non-datetime date', () => {
    expect(searchParamsSchema.safeParse({ createdAfter: '2026-01-01' }).success).toBe(false)
  })

  it('rejects a region missing a corner', () => {
    expect(searchParamsSchema.safeParse({ region: { minX: 0, minY: 0, maxX: 1 } }).success).toBe(
      false,
    )
  })

  it('rejects an invalid link status', () => {
    expect(searchParamsSchema.safeParse({ linkStatus: 'maybe' }).success).toBe(false)
  })

  it('accepts an empty object', () => {
    expect(searchParamsSchema.safeParse({}).success).toBe(true)
  })
})

describe('normalizeRegion', () => {
  it('keeps an already-ordered region', () => {
    expect(normalizeRegion({ minX: 0, minY: 1, maxX: 10, maxY: 20 })).toEqual({
      minX: 0,
      minY: 1,
      maxX: 10,
      maxY: 20,
    })
  })

  it('reorders inverted corners on both axes', () => {
    expect(normalizeRegion({ minX: 10, minY: 20, maxX: 0, maxY: 1 })).toEqual({
      minX: 0,
      minY: 1,
      maxX: 10,
      maxY: 20,
    })
  })
})

describe('normalizeSearchParams', () => {
  it('drops a blank q and trims a present q', () => {
    expect(normalizeSearchParams({ q: '   ' })).toEqual({})
    expect(normalizeSearchParams({ q: '  hi  ' })).toEqual({ q: 'hi' })
  })

  it('drops empty facet arrays and de-duplicates non-empty ones', () => {
    expect(normalizeSearchParams({ types: [] })).toEqual({})
    expect(normalizeSearchParams({ types: ['sticky', 'sticky', 'doc'] })).toEqual({
      types: ['sticky', 'doc'],
    })
    const id = '11111111-1111-1111-1111-111111111111'
    expect(normalizeSearchParams({ tagIds: [id, id] })).toEqual({ tagIds: [id] })
  })

  it('drops includeDeleted=false but keeps true', () => {
    expect(normalizeSearchParams({ includeDeleted: false })).toEqual({})
    expect(normalizeSearchParams({ includeDeleted: true })).toEqual({ includeDeleted: true })
  })

  it('passes dates and link status through, and normalizes the region', () => {
    const params: SearchParams = {
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-02-01T00:00:00.000Z',
      linkStatus: 'unlinked',
      region: { minX: 100, minY: 100, maxX: 0, maxY: 0 },
    }
    expect(normalizeSearchParams(params)).toEqual({
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '2026-02-01T00:00:00.000Z',
      linkStatus: 'unlinked',
      region: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    })
  })

  it('returns an empty object for empty input', () => {
    expect(normalizeSearchParams({})).toEqual({})
  })
})
