import { act, type RenderResult, render } from '@testing-library/react'
import { CanvasRoot } from '../src/canvas/CanvasRoot'
import { flushFrameSync } from '../src/canvas/runtime/raf'
import { setCamera, setViewport } from '../src/canvas/state/camera-store'
import { type EntryMeta, loadEntries } from '../src/canvas/state/entry-store'

/** A regular grid of `n` sticky placeholders, 300px apart. */
export function seedGrid(n: number): EntryMeta[] {
  return Array.from(
    { length: n },
    (_, i): EntryMeta => ({
      id: `e${i}`,
      type: 'sticky',
      x: (i % 200) * 300,
      y: Math.floor(i / 200) * 300,
      w: 240,
      h: 240,
      rotation: 0,
      zIndex: 1,
      visibility: 'private',
    }),
  )
}

/** Mount the board with `n` seeded entries and a fixed viewport, then flush one frame. */
export function mountBoard(n: number, viewport = { w: 1280, h: 800 }): RenderResult {
  setCamera({ x: 0, y: 0, zoom: 1 })
  loadEntries(seedGrid(n))
  const result = render(<CanvasRoot />)
  act(() => {
    setViewport(viewport.w, viewport.h)
    flushFrameSync()
  })
  return result
}

/** Run the pending rAF frame and flush any resulting React updates. */
export function frame(): void {
  act(() => {
    flushFrameSync()
  })
}
