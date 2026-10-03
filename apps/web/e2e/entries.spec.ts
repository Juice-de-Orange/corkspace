import { expect, type Page, test } from '@playwright/test'
import { fillPrompt, resetCamera } from './helpers'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
  await resetCamera(page)
}

test('create a sticky → it appears → reload → it persists', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('[data-entry-id]').first()).toBeVisible()

  await page.waitForTimeout(500) // allow the create round-trip to persist
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  // metadata is reloaded from the server → at least one entry remains
  await expect(page.locator('[data-entry-id]').first()).toBeVisible()
})

test('edit a sticky → its text persists across reload', async ({ page }, testInfo) => {
  // The desktop edit gesture is double-click; the touch edit gesture (long-press / double-tap)
  // is built in Phase 6, so this desktop interaction is scoped to the desktop project.
  test.skip(testInfo.project.name.startsWith('mobile'), 'touch editing gesture lands in Phase 6')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()

  // The new sticky is centered on screen and is the topmost; double-click there (a `.first()`
  // locator could be intercepted by an overlapping sticky from a prior test).
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)

  const textarea = page.locator('.entry-sticky textarea')
  await expect(textarea).toBeVisible()
  await textarea.fill('HALLO_WELT')
  await textarea.blur()

  await page.waitForTimeout(600) // allow the content PATCH to persist
  await page.reload()
  await expect(page.getByText('HALLO_WELT').first()).toBeVisible()
})

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNo+A8AAgIBgP3y/PQAAAAASUVORK5CYII=',
  'base64',
)

test('upload an image → it is processed and appears on the board', async ({ page }) => {
  await login(page)
  // The board is shared across the serial suite (and both projects), so earlier uploads may already
  // be mounted — possibly outside the mobile viewport. Wait for the entry THIS upload creates.
  const images = page.locator('.entry-image')
  const idsBefore = await images.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-entry-id')),
  )
  await page.setInputFiles('input[type="file"]', {
    name: 'cat.png',
    mimeType: 'image/png',
    buffer: PNG_1x1,
  })
  let newId: string | null | undefined
  await expect
    .poll(async () => {
      newId = await images.evaluateAll(
        (els, before) =>
          els.map((e) => e.getAttribute('data-entry-id')).find((id) => !before.includes(id)),
        idsBefore,
      )
      return newId
    })
    .toBeTruthy()
  // upload → worker generates a webp variant → the image entry renders
  await expect(page.locator(`[data-entry-id="${newId}"] img`)).toBeVisible({ timeout: 25_000 })
})

test('create a checklist, add + check an item, persists across reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'touch text-entry refinements land in Phase 6',
  )
  await login(page)
  // The board is shared across the serial suite (and across retries), so other checklists may
  // already exist — scope everything to the ID of the one THIS test creates (robust to DOM order
  // and to reload). Capture the ids present, create, then diff to find the new entry.
  const checklists = page.locator('.entry-checklist')
  const idsBefore = await checklists.evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-entry-id')),
  )
  await page.getByRole('button', { name: '+ Liste' }).click()
  await expect(checklists).toHaveCount(idsBefore.length + 1)
  const newId = await checklists.evaluateAll(
    (els, before) =>
      els.map((e) => e.getAttribute('data-entry-id')).find((id) => !before.includes(id)),
    idsBefore,
  )
  const list = page.locator(`[data-entry-id="${newId}"]`)
  await expect(list).toBeVisible()

  await list.getByRole('button', { name: '+ Punkt' }).click()
  const text = list.locator('input:not([type="checkbox"])').first()
  await text.fill('Milch kaufen')
  await text.blur()
  await list.locator('input[type="checkbox"]').first().check()

  await page.waitForTimeout(500)
  await page.reload()
  // Re-find the same entry by its stable id after the reload.
  const reloaded = page.locator(`[data-entry-id="${newId}"]`)
  await expect(reloaded.locator('input:not([type="checkbox"])').first()).toHaveValue('Milch kaufen')
  await expect(reloaded.locator('input[type="checkbox"]').first()).toBeChecked()
})

test('create a link card from a URL (SSRF-blocked target degrades gracefully)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'touch interactions land in Phase 6')
  await login(page)
  // The "+ Link" button opens a prompt; an SSRF-blocked URL yields a card showing the bare URL.
  await page.getByRole('button', { name: '+ Link' }).click()
  await fillPrompt(page, 'https://127.0.0.1/some-page')
  // .last(): the newly created card (a retry on the shared board can leave earlier ones).
  const card = page.locator('.entry-link').last()
  await expect(card).toBeVisible()
  await expect(card.locator('a')).toHaveText('https://127.0.0.1/some-page')
})

test('create a rich document, type text, persists across reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'touch editing lands in Phase 6')
  await login(page)
  await page.getByRole('button', { name: '+ Dok' }).click()
  // other tests may leave doc entries on the shared board → assert the new (topmost) one
  await expect(page.locator('.entry-doc').first()).toBeVisible()

  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  // double-click the centered (topmost) doc to edit, type, then blur on an empty corner
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
  const editor = page.locator('.entry-doc .ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.type('Mein Dokument')
  await page.mouse.click(box.x + 24, box.y + box.height - 24)

  await page.waitForTimeout(700)
  await page.reload()
  await expect(page.getByText('Mein Dokument').first()).toBeVisible()
})

test('undo/redo and Ctrl+C/V duplicate via the command stack', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'keyboard shortcuts are a desktop concern')
  await login(page)
  const entries = page.locator('[data-entry-id]')
  await page.waitForTimeout(800) // let persisted entries finish loading before baselining the count
  const start = await entries.count()

  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(entries).toHaveCount(start + 1)

  await page.keyboard.press('Control+z') // undo create
  await expect(entries).toHaveCount(start)
  await page.keyboard.press('Control+y') // redo
  await expect(entries).toHaveCount(start + 1)

  // select the centered (topmost) sticky, then copy + paste-duplicate it
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(entries).toHaveCount(start + 2)
})

test('resize an entry via the corner handle, persists across reload', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer resize is a desktop concern')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  // select the centered (topmost) sticky → its resize handle + selection box appear
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const selBox = page.locator('.selection-box')
  await expect(selBox).toBeVisible()
  const before = await selBox.boundingBox()
  const handle = page.locator('[data-resize-handle]')
  const hb = await handle.boundingBox()
  if (!before || !hb) {
    throw new Error('selection not visible')
  }

  // drag the corner handle outward
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 90, hb.y + 70, { steps: 6 })
  await page.mouse.up()

  // the live selection box (which tracks the entry) grew
  const after = await selBox.boundingBox()
  if (!after) {
    throw new Error('selection box gone')
  }
  expect(after.width).toBeGreaterThan(before.width + 40)

  // and the new size persists across a reload
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.locator('.entry-sticky').first()).toBeVisible() // wait for entries to load
  const widths = await page
    .locator('.entry-sticky')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
  expect(Math.max(...widths)).toBeGreaterThan(290)
})

test('overlapping entries show the yellow collision border', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'collision drag is a desktop concern')
  await login(page)
  // two stickies created at the screen centre overlap → 1px-AABB collision → yellow outline
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.waitForTimeout(300)
  const hasYellow = await page
    .locator('[data-entry-id]')
    .evaluateAll((els) => els.some((e) => getComputedStyle(e).outlineColor === 'rgb(234, 179, 8)'))
  expect(hasYellow).toBe(true)
})

test('connect two entries with the Verbinden tool, then edit + delete the thread', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'connect is a desktop concern')
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const threads = page.locator('.connections-layer .conn-line')
  const beforeThreads = await threads.count()

  // A: create then drag it to its own spot on the right
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 360, cy, { steps: 6 })
  await page.mouse.up()

  // B: create at centre
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').nth(1)).toBeVisible()

  // Arm the Verbinden tool → tap B (centre) → tap A (right)
  await page.locator('[data-connect-tool]').click()
  await page.mouse.click(cx, cy)
  await page.mouse.click(cx + 360, cy)
  await expect(threads).toHaveCount(beforeThreads + 1)

  // A second identical connect is deduped (still one new thread)
  await page.mouse.click(cx, cy)
  await page.mouse.click(cx + 360, cy)
  await expect(threads).toHaveCount(beforeThreads + 1)

  // Disarm the tool, select the thread by clicking its midpoint → editor opens → label persists
  await page.keyboard.press('Escape')
  await page.mouse.click(cx + 180, cy)
  const label = page.locator('[data-conn-label]')
  await expect(label).toBeVisible()
  await label.fill('mag')
  await label.press('Enter')
  await expect(page.locator('.connections-layer text').filter({ hasText: 'mag' })).toBeVisible()

  // Delete the thread
  await page.locator('[data-conn-delete]').click()
  await expect(threads).toHaveCount(beforeThreads)
})

test('eraser removes a board stroke', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer drawing is a desktop concern')
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  const strokes = page.locator('.strokes-layer path')
  const before = await strokes.count()
  // Clear of the top-left chrome column (toolbar + colour row + Orte panel at top:104).
  const sx = box.x + 420
  const sy = box.y + 220
  await page.locator('[data-draw-tool="pen"]').click()
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 80, sy + 30, { steps: 5 })
  await page.mouse.move(sx + 150, sy - 10, { steps: 5 })
  await page.mouse.up()
  await expect(strokes).toHaveCount(before + 1)

  // erase along the stroke
  await page.locator('[data-draw-tool="eraser"]').click()
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 150, sy - 10, { steps: 8 })
  await page.mouse.up()
  await expect(strokes).toHaveCount(before)
})

test('Delete key trashes the selected entry; Escape clears the selection', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'keyboard shortcuts are a desktop concern')
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const stickies = page.locator('.entry-sticky')
  const before = await stickies.count()

  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(stickies).toHaveCount(before + 1)
  await page.mouse.click(cx, cy)
  await expect(page.locator('.selection-box')).toBeVisible()

  // Escape clears the selection
  await page.keyboard.press('Escape')
  await expect(page.locator('.selection-box')).toHaveCount(0)

  // reselect and Delete → trashed (back to the original count)
  await page.mouse.click(cx, cy)
  await expect(page.locator('.selection-box')).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(stickies).toHaveCount(before)
})

test('draw a freehand stroke with the pen tool', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer drawing is a desktop concern')
  await login(page)
  // The board is shared across the serial suite, so other draw/erase tests may leave strokes —
  // assert ONE new path appeared, never an absolute count.
  const paths = page.locator('.strokes-layer path')
  const before = await paths.count()
  await page.locator('[data-draw-tool="pen"]').click() // enable the pen
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  // draw a squiggle on an empty area, clear of the top-left chrome column (Orte at top:104)
  const sx = box.x + 420
  const sy = box.y + 160
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 60, sy + 40, { steps: 5 })
  await page.mouse.move(sx + 130, sy + 5, { steps: 5 })
  await page.mouse.up()

  await expect(paths).toHaveCount(before + 1)
})

test('toggle an entry between private and public (admin)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer selection is a desktop concern')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const toggle = page.locator('[data-visibility-toggle]')
  await expect(toggle).toHaveText('🔒') // entries default to private
  await toggle.click()
  await expect(toggle).toHaveText('🌐') // now public (visible to viewers)
})

test('save a teleport and fly back to it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer pan/flight is a desktop concern')
  await login(page)
  await page.getByRole('button', { name: '+ Ort speichern' }).click()
  await fillPrompt(page, 'Mein Ort')
  const teleport = page.getByRole('button', { name: /Mein Ort/ })
  await expect(teleport).toBeVisible()

  const before = await page.locator('.position-readout').textContent()
  // pan away from an empty (bottom-left) area
  await page.mouse.move(160, 520)
  await page.mouse.down()
  await page.mouse.move(460, 260, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator('.position-readout')).not.toHaveText(before ?? '')

  // fly back to the saved view
  await teleport.click()
  await page.waitForTimeout(1700) // let the flight tween finish
  expect(await page.locator('.position-readout').textContent()).toBe(before)
})

test('create a named frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'frame interactions are a desktop concern')
  await login(page)
  // The board is shared across the serial suite (other tests leave frames, e.g. the redo'd
  // "UndoRahmenXY"), so assert a NEW frame appeared + our named one exists — never `.entry-frame`
  // uniqueness.
  const frames = page.locator('.entry-frame')
  const before = await frames.count()
  await page.getByRole('button', { name: '+ Rahmen' }).click()
  await fillPrompt(page, 'Projekt A')
  await expect(frames).toHaveCount(before + 1)
  await expect(page.getByText('▢ Projekt A').first()).toBeVisible()
})

test('dashboard search finds an entry by text and jumps to it', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'dashboard interactions are a desktop concern',
  )
  await login(page)
  // create a sticky and give it a unique searchable word
  await page.getByRole('button', { name: '+ Notiz' }).click()
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
  const ta = page.locator('.entry-sticky textarea')
  await expect(ta).toBeVisible()
  await ta.fill('DASHBOARDFINDME')
  await ta.blur()
  await page.waitForTimeout(700) // persist (search_text updates)

  // open the dashboard and search
  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-search]').fill('DASHBOARDFINDME')
  await page.waitForTimeout(700) // fetch
  const result = page.locator('.dashboard-results button').first()
  await expect(result).toBeVisible()
  await result.click()
  // jumping closes the overlay
  await expect(page.locator('[data-dashboard-search]')).toHaveCount(0)
})

test('delete an entry to trash and restore it from the dashboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'pointer + dashboard are desktop concerns')
  await login(page)
  const entries = page.locator('[data-entry-id]')
  await page.waitForTimeout(800)
  const start = await entries.count()

  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(entries).toHaveCount(start + 1)

  // select the centered sticky, then send it to trash
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.locator('[data-delete-entry]').click()
  await expect(entries).toHaveCount(start) // removed from the board

  // open the dashboard, switch to the trash tab, restore
  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-tab="trash"]').click()
  const restoreBtn = page.locator('[data-restore-id]').first()
  await expect(restoreBtn).toBeVisible()
  await restoreBtn.click()
  await expect(entries).toHaveCount(start + 1) // back on the board
})

/** World position of an entry as the canvas renders it (inline left/top are world coordinates). */
async function entryPos(page: Page, id: string): Promise<{ x: number; y: number }> {
  return page.locator(`[data-entry-id="${id}"]`).evaluate((el) => {
    const s = (el as HTMLElement).style
    return { x: Number.parseFloat(s.left), y: Number.parseFloat(s.top) }
  })
}

/** Create a link card with a short, unique, SSRF-blocked URL (the card then shows the bare URL, no
 *  network involved) and return its persisted id. Found by its text: the shared board can hold
 *  link cards of earlier tests. */
async function createLinkCard(page: Page): Promise<string> {
  const url = `https://127.0.0.1/${Math.floor(100 + Math.random() * 900)}`
  await page.getByRole('button', { name: '+ Link' }).click()
  await fillPrompt(page, url)
  const card = page.locator('.entry-link', { hasText: url })
  await expect(card).toBeVisible()
  await page.waitForTimeout(500) // allow the create round-trip to swap the temp id for the real one
  const id = await card.getAttribute('data-entry-id')
  if (!id) {
    throw new Error('link card has no id')
  }
  return id
}

/** The board path of the open board (`/b/<id>`) as an API prefix. */
const boardApi = (page: Page): string => `/api/boards/${new URL(page.url()).pathname.split('/')[2]}`

test('dragging a link card by the space beside its title moves the card, not to the origin', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'touch interactions land in Phase 6')
  await login(page)
  const id = await createLinkCard(page)
  const card = page.locator(`[data-entry-id="${id}"]`)
  try {
    const start = await entryPos(page, id)

    // Press on the card just right of the title: the card's own drag starts (the target is the
    // card, not the link), but Chromium also picks the adjacent anchor for a native link drag —
    // which cancels the pointer mid-move unless the anchor opts out of dragging.
    const a = await card.locator('a').boundingBox()
    if (!a) {
      throw new Error('link title not visible')
    }
    const px = a.x + a.width + 3
    const py = a.y + a.height / 2
    await page.mouse.move(px, py)
    await page.mouse.down()
    await page.mouse.move(px + 120, py + 80, { steps: 8 })
    await page.mouse.up()

    const moved = await entryPos(page, id)
    expect(moved.x).toBeCloseTo(start.x + 120, 0)
    expect(moved.y).toBeCloseTo(start.y + 80, 0)

    await page.waitForTimeout(500) // allow the move to persist
    await page.reload()
    await expect(page.locator('.position-readout')).toBeVisible()
    await expect(card).toBeVisible()
    const reloaded = await entryPos(page, id)
    expect(reloaded.x).toBeCloseTo(start.x + 120, 0)
    expect(reloaded.y).toBeCloseTo(start.y + 80, 0)
  } finally {
    await page.request.delete(`${boardApi(page)}/entries/${id}`)
  }
})

test('a cancelled pointer aborts an entry drag: back to the start, nothing saved', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'touch interactions land in Phase 6')
  await login(page)
  const id = await createLinkCard(page)
  const card = page.locator(`[data-entry-id="${id}"]`)
  try {
    const start = await entryPos(page, id)
    const patches: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().endsWith(`/entries/${id}`)) {
        patches.push(r.url())
      }
    })

    // Drag by the card's lower edge (below title and description), then let the browser take the
    // pointer away mid-drag. A pointercancel carries no usable coordinates (0,0).
    const box = await card.boundingBox()
    if (!box) {
      throw new Error('link card not visible')
    }
    const px = box.x + box.width / 2
    const py = box.y + box.height - 8
    await page.mouse.move(px, py)
    await page.mouse.down()
    await page.mouse.move(px + 120, py + 80, { steps: 8 })
    expect((await entryPos(page, id)).x).toBeCloseTo(start.x + 120, 0) // the drag is live
    await page.locator('.canvas-root').evaluate((root) => {
      root.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
    })
    await page.mouse.up()

    expect(await entryPos(page, id)).toEqual(start)
    await page.waitForTimeout(500)
    expect(patches).toEqual([])
    await page.reload()
    await expect(card).toBeVisible()
    expect(await entryPos(page, id)).toEqual(start)
  } finally {
    await page.request.delete(`${boardApi(page)}/entries/${id}`)
  }
})
