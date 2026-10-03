import { expect, type Page, test } from '@playwright/test'
import { resetCamera } from './helpers'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'
const boardId = process.env.E2E_ADMIN_BOARD_ID ?? ''
const api = (sub: string): string => `/api/boards/${boardId}${sub}`

/** Delete every entry on the shared board so this editor spec's coordinate-based drags/dblclicks can
 *  never collide with a stray entry left by an earlier spec (the intermittent shared-board flake).
 *  Later specs create their own entries, so a clean board here has no cross-spec effect. */
async function clearEntries(page: Page): Promise<void> {
  const entries = (await (await page.request.get(api('/entries'))).json()) as { id: string }[]
  for (const e of entries) {
    await page.request.delete(api(`/entries/${e.id}`))
  }
}

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
  await clearEntries(page)
  await resetCamera(page) // reloads → the cleared board is reflected in the canvas
}

test('internal link: insert a jump to a copied entry and click it to fly there', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'editor + pointer are desktop concerns')
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  // target sticky A, dragged far right (stays in the viewport; isolated for selection)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  const stickyA = page.locator('.entry-sticky').last()
  await expect(stickyA).toBeVisible()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 380, cy, { steps: 6 })
  await page.mouse.up()
  // Select A by its OWN locator (not a fixed coordinate) so a stray entry left on the shared board
  // by an earlier spec can never be selected instead — that would copy the wrong id and no-op the
  // flight (the intermittent failure this test used to hit under load).
  await stickyA.click()
  await page.keyboard.press('Control+c') // clipboard = A's id

  // document B at the centre (topmost / newest). Edit it via its element locator so we never
  // interact with an overlapping older entry, and the tall doc stays fully on screen.
  await page.getByRole('button', { name: '+ Dok' }).click()
  const doc = page.locator('.entry-doc').last()
  await expect(doc).toBeVisible()
  // Isolate the doc on the lower-RIGHT: clear of the centre pile-up, below the top-right minimap,
  // and away from the lower-left teleport-pan zone (~160,520) other tests use.
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + box.width * 0.28, cy + box.height * 0.22, { steps: 6 })
  await page.mouse.up()
  await doc.dblclick()
  const editor = doc.locator('.ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()
  await page.getByRole('button', { name: '🔗' }).click()
  await page.mouse.click(box.x + 24, box.y + box.height - 24) // blur → preview

  const link = doc.locator('a[href^="entry:"]')
  await expect(link).toBeVisible()
  const readout = page.locator('.position-readout')
  const before = (await readout.textContent()) ?? ''
  // Click the link and assert the camera flew there. Retry the whole click+check: the preview's
  // internal-link click handler attaches in a useEffect, so an immediate first click can land
  // before it's wired (a pre-existing race the old fixed 1600ms wait masked intermittently).
  await expect(async () => {
    await link.click()
    await expect(readout).not.toHaveText(before, { timeout: 2500 }) // flight tween moves the camera
  }).toPass({ timeout: 15000 })
})

test('inline link embed: SSRF-blocked URL degrades to a bare card', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'editor is a desktop concern')
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.getByRole('button', { name: '+ Dok' }).click()
  await expect(page.locator('.entry-doc').last()).toBeVisible()
  // Drag the topmost doc to an isolated spot on the lower-right — clear of the centre pile-up, of
  // the top-right minimap (which would occlude the toolbar), and of the top-left draw/pan zones.
  const tx = cx + box.width * 0.28
  const ty = cy + box.height * 0.22
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(tx, ty, { steps: 6 })
  await page.mouse.up()
  await page.mouse.dblclick(tx, ty)
  const editor = page.locator('.entry-doc .ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()

  // The 🌐 URL-embed button uses a native window.prompt (a modal would blur+unmount the editor).
  page.once('dialog', (d) => d.accept('https://127.0.0.1/secret'))
  await page.getByRole('button', { name: '🌐' }).click()
  await page.waitForTimeout(700) // preview fetch (SSRF-blocked) + insert
  await page.mouse.click(box.x + 24, box.y + box.height - 24) // blur → preview

  // only this test inserts an embed → assert it globally
  const embed = page.locator('.link-embed')
  await expect(embed).toBeVisible()
  await expect(embed).toContainText('127.0.0.1')
})

test('document editor: Enter starts a paragraph; list and quote buttons work', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'editor is a desktop concern')
  // Any exception in the editor (e.g. two copies of prosemirror-model in the bundle) must fail
  // the test even if the DOM assertions happened to pass.
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await login(page)
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.getByRole('button', { name: '+ Dok' }).click()
  const doc = page.locator('.entry-doc').last()
  await expect(doc).toBeVisible()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + box.width * 0.28, cy + box.height * 0.22, { steps: 6 })
  await page.mouse.up()
  await doc.dblclick()
  const editor = doc.locator('.ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()

  await page.keyboard.type('first')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second')
  await expect(editor.locator('p')).toHaveText(['first', 'second'])

  await page.keyboard.press('Enter')
  await doc.locator('button', { hasText: /^•$/ }).click()
  await page.keyboard.type('item')
  await expect(editor.locator('ul > li')).toHaveText(['item'])

  // Leave the list (Enter on an empty item), then a numbered list and a quote.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await doc.locator('button', { hasText: /^1\.$/ }).click()
  await page.keyboard.type('one')
  await expect(editor.locator('ol > li')).toHaveText(['one'])
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await doc.locator('button', { hasText: /^❝$/ }).click()
  await page.keyboard.type('quoted')
  await expect(editor.locator('blockquote')).toHaveText('quoted')

  expect(pageErrors).toEqual([])
})
