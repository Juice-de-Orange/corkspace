import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { flushFrameSync } from '../src/canvas/runtime/raf'
import { setCamera } from '../src/canvas/state/camera-store'
import { mountBoard } from './_harness'

describe('LOD rendering', () => {
  it('swaps tiny on-screen entries to lightweight blocks, and back to full content', () => {
    const { container } = mountBoard(40)
    // at zoom 1 a 240px sticky is well above the full threshold → full content, no blocks
    expect(container.querySelectorAll('.entry-block').length).toBe(0)

    // zoom far out → entries are a few px on screen → block LOD
    act(() => {
      setCamera({ x: 0, y: 0, zoom: 0.05 })
      flushFrameSync()
    })
    expect(container.querySelectorAll('.entry-block').length).toBeGreaterThan(0)

    // zoom back in → blocks are replaced by full content again
    act(() => {
      setCamera({ x: 0, y: 0, zoom: 1 })
      flushFrameSync()
    })
    expect(container.querySelectorAll('.entry-block').length).toBe(0)
  })

  it('display-manages the LIVE node after a block↔full swap (no stale registry)', () => {
    const { container } = mountBoard(40)
    // Flip an entry full → block → full: its rendered DOM node type changes (StickyEntry ↔
    // BlockEntry) while its id stays the same. A stale [id]-effect registry would keep the old
    // detached node; the callback ref must re-register the live node.
    act(() => {
      setCamera({ x: 0, y: 0, zoom: 0.05 })
      flushFrameSync()
    })
    act(() => {
      setCamera({ x: 0, y: 0, zoom: 1 })
      flushFrameSync()
    })
    // Pan e0 (world 0,0 / 240px) out of the strict viewport but inside the overscan ring → culling
    // must set display:none on the CURRENT node. If the registry were stale this would stay visible.
    act(() => {
      setCamera({ x: -340, y: 0, zoom: 1 })
      flushFrameSync()
    })
    const live = container.querySelector<HTMLElement>('[data-entry-id="e0"]')
    expect(live).not.toBeNull()
    expect(live?.style.display).toBe('none')
  })
})
