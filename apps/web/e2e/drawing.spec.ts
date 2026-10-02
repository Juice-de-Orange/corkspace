import { expect, type Page, test } from '@playwright/test'
import { resetCamera } from './helpers'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'
const boardId = process.env.E2E_ADMIN_BOARD_ID ?? ''
const api = (sub: string): string => `/api/boards/${boardId}${sub}`

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
  await resetCamera(page)
}

interface Row {
  id: string
}

/** Later spec files assert ABSOLUTE stroke counts (entries.spec pen test expects exactly one
 *  path) — every stroke/connection this file creates is removed again via the API. */
let strokesBefore: Set<string> | null = null
let connsBefore: Set<string> | null = null

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer drawing is a desktop concern')
  await login(page)
  const strokes = (await (await page.request.get(api('/strokes'))).json()) as Row[]
  const conns = (await (await page.request.get(api('/connections'))).json()) as Row[]
  strokesBefore = new Set(strokes.map((s) => s.id))
  connsBefore = new Set(conns.map((c) => c.id))
})

test.afterEach(async ({ page }) => {
  if (!strokesBefore || !connsBefore) {
    return // skipped project — nothing to clean
  }
  const strokes = (await (await page.request.get(api('/strokes'))).json()) as Row[]
  for (const s of strokes) {
    if (!strokesBefore.has(s.id)) {
      await page.request.delete(api(`/strokes/${s.id}`))
    }
  }
  const conns = (await (await page.request.get(api('/connections'))).json()) as Row[]
  for (const c of conns) {
    if (!connsBefore.has(c.id)) {
      await page.request.delete(api(`/connections/${c.id}`))
    }
  }
  strokesBefore = null
  connsBefore = null
})

async function canvasBox(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  return { x: box.x, y: box.y, w: box.width, h: box.height }
}

test('ink is pen-sized on screen even when zoomed far out (and actually paints)', async ({
  page,
}) => {
  // Zoom out to 25% — the exact scenario where strokes used to render as invisible hairlines.
  await page.request.put('/api/me/camera', { data: { x: 0, y: 0, zoom: 0.25 } })
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await page.waitForTimeout(300)

  const box = await canvasBox(page)
  const sx = box.x + 420
  const sy = box.y + 300
  await page.locator('[data-draw-tool="pen"]').click()

  // PIXEL proof, not geometry: bounding boxes and counts are valid even when Chromium paints
  // nothing (the zero-size-svg bug shipped exactly that way). Identical pixels encode to an
  // identical PNG, so the region screenshot MUST change once ink is painted.
  const clip = { x: sx - 20, y: sy - 40, width: 260, height: 90 }
  const before = await page.screenshot({ clip })

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 200, sy, { steps: 6 }) // straight horizontal drag
  await page.mouse.up()

  const paths = page.locator('.strokes-layer path')
  await expect(paths).toHaveCount(1)
  const after = await page.screenshot({ clip })
  expect(after.equals(before)).toBe(false)
  // …and the ink is roughly as long as the drag and as THICK as the picked pen width on screen.
  const bb = await paths.first().boundingBox()
  if (!bb) {
    throw new Error('stroke has no painted geometry')
  }
  expect(bb.width).toBeGreaterThan(150)
  expect(bb.height).toBeGreaterThan(2.5) // pre-fix: 4 world px × 0.25 zoom ≈ 1px hairline
})

test('draw over an entry: stroke anchors, persists across reload, moves with the entry', async ({
  page,
}) => {
  const box = await canvasBox(page)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2

  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()

  // Draw straight across the sticky — the press starts ON the entry (used to be swallowed).
  await page.locator('[data-draw-tool="pen"]').click()
  await page.mouse.move(cx - 60, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 60, cy, { steps: 6 })
  await page.mouse.up()
  const paths = page.locator('.strokes-layer path')
  await expect(paths).toHaveCount(1)

  // Reload → the anchored stroke persists (server round-trip, not just optimistic state).
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await expect(paths).toHaveCount(1)
  const before = await paths.first().boundingBox()

  // Drag the sticky 220px right → the annotation must ride along.
  await page.waitForTimeout(300)
  await page.mouse.move(cx, cy + 40) // on the sticky, clear of the fresh stroke
  await page.mouse.down()
  await page.mouse.move(cx + 220, cy + 40, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => {
      const after = await paths.first().boundingBox()
      return after && before ? after.x - before.x : 0
    })
    .toBeGreaterThan(180)
})

test('eraser reaches a stroke on top of an entry; Ctrl+Z restores it', async ({ page }) => {
  const box = await canvasBox(page)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2

  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()

  await page.locator('[data-draw-tool="pen"]').click()
  await page.mouse.move(cx - 50, cy - 20)
  await page.mouse.down()
  await page.mouse.move(cx + 50, cy - 20, { steps: 6 })
  await page.mouse.up()
  const paths = page.locator('.strokes-layer path')
  await expect(paths).toHaveCount(1)
  await page.waitForTimeout(400) // let the create round-trip finish (undo needs the real id)

  await page.locator('[data-draw-tool="eraser"]').click()
  await page.mouse.move(cx - 50, cy - 20)
  await page.mouse.down()
  await page.mouse.move(cx + 50, cy - 20, { steps: 8 })
  await page.mouse.up()
  await expect(paths).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(paths).toHaveCount(1)
})

test('shape tools: rect persists; line and arrow draw as stroked geometry', async ({ page }) => {
  const box = await canvasBox(page)
  const sx = box.x + 420
  const sy = box.y + 320
  const paths = page.locator('.strokes-layer path')

  await page.locator('[data-draw-tool="rect"]').click()
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 140, sy + 90, { steps: 5 })
  await page.mouse.up()
  await expect(paths).toHaveCount(1)
  await expect(paths.first()).toHaveAttribute('fill', 'none')

  await page.waitForTimeout(400)
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await expect(paths).toHaveCount(1) // the rect survived the round-trip
  await page.waitForTimeout(300)

  await page.locator('[data-draw-tool="line"]').click()
  await page.mouse.move(sx, sy + 130)
  await page.mouse.down()
  await page.mouse.move(sx + 120, sy + 150, { steps: 4 })
  await page.mouse.up()
  await expect(paths).toHaveCount(2)

  await page.locator('[data-draw-tool="arrow"]').click()
  await page.mouse.move(sx, sy + 170)
  await page.mouse.down()
  await page.mouse.move(sx + 120, sy + 200, { steps: 4 })
  await page.mouse.up()
  await expect(paths).toHaveCount(3)
})

test('drag-connect: press an entry, drag onto another — preview, badge, thread', async ({
  page,
}) => {
  const box = await canvasBox(page)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const threads = page.locator('.connections-layer .conn-line')
  const before = await threads.count()

  // A at centre → drag it right; B stays at centre.
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 360, cy, { steps: 6 })
  await page.mouse.up()
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').nth(1)).toBeVisible()
  await page.waitForTimeout(400) // both entries need their server ids before connecting

  // Pixel proof for threads: the gap strictly BETWEEN the stickies must change once the
  // thread paints (B right edge < cx+130; A left edge > cx+230).
  const clip = { x: cx + 130, y: cy - 50, width: 100, height: 100 }
  const beforeShot = await page.screenshot({ clip })

  await page.locator('[data-connect-tool]').click()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  // The press docks the source: the pinned badge appears at the picked edge point.
  await expect(page.locator('[data-connect-source-anchor]')).toBeVisible()
  await page.mouse.move(cx + 180, cy, { steps: 6 })
  // Mid-drag: dashed preview line is painting…
  await expect(page.locator('.connections-layer line')).toHaveCount(1)
  await page.mouse.move(cx + 360, cy, { steps: 6 })
  // …and over the target the nearest-edge docking badge shows.
  await expect(page.locator('[data-connect-anchor]')).toBeVisible()
  await page.mouse.up()

  await expect(threads).toHaveCount(before + 1)
  await page.mouse.move(cx, cy + 320) // park the pointer so no badge/preview is in the clip
  await page.waitForTimeout(150)
  const afterShot = await page.screenshot({ clip })
  expect(afterShot.equals(beforeShot)).toBe(false)

  // Keyboard parity: select the thread (click the sagging yarn between the stickies), Delete
  // removes it.
  await page.keyboard.press('Escape') // disarm the connect tool
  await page.mouse.click(cx + 180, cy + 9)
  await expect(page.locator('[data-conn-label]')).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(threads).toHaveCount(before)
})

test('the pen colour row is clickable — never hidden behind the Orte panel', async ({ page }) => {
  await page.locator('[data-draw-tool="pen"]').click()
  const swatch = page.locator('[data-draw-color]').first()
  await expect(swatch).toBeVisible()
  const bb = await swatch.boundingBox()
  if (!bb) {
    throw new Error('colour swatch not laid out')
  }
  // elementFromPoint proves stacking: the topmost element at the swatch centre IS the swatch.
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-draw-color]') !== null,
    { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 },
  )
  expect(hit).toBe(true)
  // And it actually reacts: picking a colour re-tints the pen cursor.
  await page.locator('[data-draw-color="#dc2626"]').click()
  const cursor = await page.locator('.canvas-root').evaluate((el) => getComputedStyle(el).cursor)
  expect(cursor).toContain('data:image/svg+xml')
  expect(cursor).toContain('dc2626')
})
