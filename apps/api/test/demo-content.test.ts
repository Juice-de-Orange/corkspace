import { describe, expect, it } from 'vitest'
import { type Json, seedDemoBoard } from '../src/seed/demo-content'

// The canvas chrome a first visit sees at the default camera (world origin at the canvas top-left,
// 100 %), in canvas pixels: the create toolbar runs along the top (top 8, 40 high) and the Places
// panel sits at the left edge (left 8, about 110 wide) — apps/web/src/index.css, TeleportPanel.tsx.
const TOOLBAR_BOTTOM = 48
const PLACES_PANEL_RIGHT = 118
// A frame's name is drawn 22 px above its top edge (FrameLayer.tsx).
const FRAME_LABEL_HEIGHT = 22

async function seededItems(): Promise<{ path: string; body: Json }[]> {
  const calls: { path: string; body: Json }[] = []
  let id = 0
  await seedDemoBoard(async (_method, path, body) => {
    calls.push({ path, body: body ?? {} })
    id += 1
    return { id: `id-${id}` }
  }, 'board-1')
  return calls
}

describe('seedDemoBoard', () => {
  it('starts right of the Places panel and below the toolbar, so the first view covers nothing', async () => {
    const calls = await seededItems()
    const tops: number[] = []
    const lefts: number[] = []
    for (const { path, body } of calls) {
      if (path.endsWith('/frames')) {
        lefts.push(Number(body.x))
        tops.push(Number(body.y) - FRAME_LABEL_HEIGHT)
      } else if (path.endsWith('/entries')) {
        lefts.push(Number(body.x))
        tops.push(Number(body.y))
      } else if (path.endsWith('/strokes')) {
        for (const [x, y] of body.points as number[][]) {
          lefts.push(x as number)
          tops.push(y as number)
        }
      }
    }
    expect(lefts.length).toBeGreaterThan(20)
    expect(Math.min(...lefts)).toBeGreaterThan(PLACES_PANEL_RIGHT)
    expect(Math.min(...tops)).toBeGreaterThan(TOOLBAR_BOTTOM)
  })
})
