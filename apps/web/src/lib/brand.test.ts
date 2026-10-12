import { afterEach, describe, expect, it, vi } from 'vitest'
import { brandAtom, brandFileStem, loadBrand } from './brand'

afterEach(() => {
  vi.unstubAllGlobals()
  brandAtom.set('Corkspace')
})

describe('brand', () => {
  it('takes the name the server reports and puts it in the tab title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ brandName: 'Family pinboard' }))),
    )
    await loadBrand()
    expect(brandAtom.value).toBe('Family pinboard')
    expect(document.title).toBe('Family pinboard')
  })

  it('keeps the default when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await loadBrand()
    expect(brandAtom.value).toBe('Corkspace')
  })

  it('derives a file name stem', () => {
    expect(brandFileStem('Corkspace')).toBe('corkspace')
    expect(brandFileStem('  Family Pinboard! ')).toBe('family-pinboard')
    expect(brandFileStem('???')).toBe('board')
  })
})
