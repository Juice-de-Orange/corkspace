import { randomUUID } from 'node:crypto'
import { expect, type Page, type Route, test } from '@playwright/test'
import { resetCamera } from './helpers'

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

/** Every request that loads entry bodies: one entry (`GET …/entries/:id/content`) or a batch
 *  (`POST …/entries/content`). */
const isContentLoad = (url: URL): boolean => /\/entries\/(?:[^/]+\/)?content$/.test(url.pathname)

/** Create entries in the middle of the initial view (camera at the origin, 100 %), on top of
 *  whatever earlier tests left on the shared board. */
async function createEntriesInView(page: Page, tag: string) {
  const boardId = new URL(page.url()).pathname.split('/')[2]
  const size = page.viewportSize()
  if (!boardId || !size) {
    throw new Error('no board or viewport')
  }
  const cx = Math.round(size.width / 2)
  const cy = Math.round(size.height / 2)
  const create = async (data: Record<string, unknown>): Promise<string> => {
    const res = await page.request.post(`/api/boards/${boardId}/entries`, {
      data: { visibility: 'public', ...data },
    })
    expect(res.status()).toBe(201)
    return ((await res.json()) as { id: string }).id
  }
  const stickies: Array<{ id: string; text: string }> = []
  const corners = [
    [cx - 150, cy - 150],
    [cx + 10, cy - 150],
    [cx - 150, cy + 10],
  ] as const
  for (const [i, [x, y]] of corners.entries()) {
    const text = `${tag}-sticky-${i}`
    const id = await create({
      type: 'sticky',
      x,
      y,
      width: 140,
      height: 140,
      zIndex: 100_000 + i,
      color: 'yellow',
      content: { text },
    })
    stickies.push({ id, text })
  }
  const itemText = `${tag}-item`
  const checklistId = await create({
    type: 'checklist',
    x: cx - 150,
    y: cy + 170,
    width: 300,
    height: 160,
    zIndex: 100_010,
    content: { items: [{ id: randomUUID(), text: itemText, checked: false }] },
  })
  return { boardId, stickies, checklistId, itemText }
}

test('entries in view load their content on board open, without moving the camera', async ({
  page,
}, testInfo) => {
  await login(page)
  const tag = `LOAD-${testInfo.project.name}-${Date.now()}`
  const { boardId, stickies, checklistId, itemText } = await createEntriesInView(page, tag)
  const checklist = page.locator(`[data-entry-id="${checklistId}"]`)

  const expectAllContent = async (): Promise<void> => {
    for (const s of stickies) {
      await expect(page.locator(`[data-entry-id="${s.id}"]`)).toContainText(s.text, {
        timeout: 15_000,
      })
    }
    await expect(checklist.locator('input:not([type="checkbox"])')).toHaveValue(itemText, {
      timeout: 15_000,
    })
  }

  // 1. A plain board open: everything in view shows its content. The camera is never touched.
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await expectAllContent()

  // 2. The content requests of the next open fail (a public demo answers 429 once an address has
  //    sent too many requests). Until the content is there, an entry shows a neutral loading state —
  //    not the empty entry's "double-click to edit" / "+ Item" — and cannot be edited as empty.
  let refused = 0
  let blocked = true
  await page.route(isContentLoad, async (route: Route) => {
    if (!blocked) {
      await route.continue()
      return
    }
    refused += 1
    await route.fulfill({
      status: 429,
      headers: { 'retry-after': '1' },
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
      }),
    })
  })
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  const first = page.locator(`[data-entry-id="${stickies[0]?.id}"]`)
  await expect(first).toBeVisible()
  await expect.poll(() => refused).toBeGreaterThan(0)
  await expect(first).toContainText('Lädt…')
  await expect(first).not.toContainText('Doppelklick zum Bearbeiten')
  await expect(checklist).toContainText('Lädt…')
  await expect(checklist).not.toContainText('+ Punkt')
  if (!testInfo.project.name.startsWith('mobile')) {
    await first.dblclick()
    await expect(first.locator('textarea')).toHaveCount(0)
  }

  // 3. Once the server answers again, the content arrives on its own — still without a camera move.
  blocked = false
  await expectAllContent()
  await expect(first).not.toContainText('Lädt…')

  await page.unroute(isContentLoad)
  for (const id of [...stickies.map((s) => s.id), checklistId]) {
    await page.request.delete(`/api/boards/${boardId}/entries/${id}`)
  }
})

test('a board whose entry list is refused at first fills in once the server answers (#70)', async ({
  page,
}, testInfo) => {
  await login(page)
  const tag = `LIST-${testInfo.project.name}-${Date.now()}`
  const { boardId, stickies, checklistId } = await createEntriesInView(page, tag)
  const isEntryList = (url: URL): boolean => url.pathname === `/api/boards/${boardId}/entries`
  let refused = 0
  await page.route(isEntryList, async (route: Route) => {
    if (route.request().method() !== 'GET' || refused >= 2) {
      await route.continue()
      return
    }
    refused += 1
    await route.fulfill({
      status: 429,
      headers: { 'retry-after': '1' },
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
    })
  })
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  // While the list is refused the board says so instead of looking empty …
  const notice = page
    .getByRole('status')
    .filter({ hasText: 'Das Board konnte nicht geladen werden' })
  await expect(notice).toBeVisible()
  // … and fills in on its own once the server answers again.
  for (const s of stickies) {
    await expect(page.locator(`[data-entry-id="${s.id}"]`)).toContainText(s.text, {
      timeout: 15_000,
    })
  }
  await expect(notice).toHaveCount(0)
  expect(refused).toBe(2)

  await page.unroute(isEntryList)
  for (const id of [...stickies.map((s) => s.id), checklistId]) {
    await page.request.delete(`/api/boards/${boardId}/entries/${id}`)
  }
})
