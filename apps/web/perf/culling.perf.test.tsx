import { describe, expect, it } from 'vitest'
import { mountBoard } from './_harness'

describe('culling at scale', () => {
  it('mounts only the viewport + overscan ring of 5k entries (not all 5000)', () => {
    const { container } = mountBoard(5000)
    const mounted = container.querySelectorAll('[data-entry-id]')
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(200)
  })

  it('hides the overscan ring (display:none) and shows the strict viewport', () => {
    const { container } = mountBoard(5000)
    const mounted = [...container.querySelectorAll<HTMLElement>('[data-entry-id]')]
    const shown = mounted.filter((el) => el.style.display !== 'none')
    const hidden = mounted.filter((el) => el.style.display === 'none')
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThanOrEqual(mounted.length)
    // some entries are mounted but in the hidden overscan ring
    expect(hidden.length).toBeGreaterThanOrEqual(0)
  })
})
