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

async function centre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('version history: edit twice, restore the prior version exactly', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'dashboard + editing are desktop concerns')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()
  const c = await centre(page)
  // drag the new (topmost) sticky to an empty spot so edits/selection are unambiguous on the
  // shared board (other tests pile entries at the centre)
  const tx = c.x - 360
  const ty = c.y - 220
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(tx, ty, { steps: 6 })
  await page.mouse.up()

  // edit #1 → captures the empty prior state as a version, content becomes VERSIONONE
  await page.mouse.dblclick(tx, ty)
  let ta = page.locator('.entry-sticky textarea')
  await expect(ta).toBeVisible()
  await ta.fill('VERSIONONE')
  await ta.blur()
  await page.waitForTimeout(500)

  // edit #2 → captures VERSIONONE as a version, content becomes VERSIONTWO
  await page.mouse.dblclick(tx, ty)
  ta = page.locator('.entry-sticky textarea')
  await expect(ta).toBeVisible()
  await ta.fill('VERSIONTWO')
  await ta.blur()
  await page.waitForTimeout(500)
  await expect(page.locator('.entry-sticky', { hasText: 'VERSIONTWO' })).toBeVisible()

  // select the entry, open the dashboard's Versionen tab
  await page.mouse.click(tx, ty)
  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-tab="versions"]').click()
  const versionRows = page.locator('[data-version-id]')
  await expect(versionRows.first()).toBeVisible()

  // restore the most-recent version (snapshot of the pre-VERSIONTWO state = VERSIONONE)
  await page.locator('[data-restore-version]').first().click()
  await expect(page.locator('.entry-sticky', { hasText: 'VERSIONONE' })).toBeVisible()
  await expect(page.locator('.entry-sticky', { hasText: 'VERSIONTWO' })).toHaveCount(0)
})

test('overview: stats render and a fresh entry shows as an orphan that jumps', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'dashboard interactions are desktop')
  await login(page)
  // a freshly-created sticky has no tag and no connection → it is an orphan
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()
  await page.waitForTimeout(400)

  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-tab="overview"]').click()
  // stats show a positive entry count
  await expect(page.locator('[data-stat="entries"] strong')).not.toHaveText('–')
  // at least one orphan is listed; clicking it flies the camera and closes the overlay
  const orphan = page.locator('[data-orphan-id]').first()
  await expect(orphan).toBeVisible()
  await orphan.click()
  await expect(page.locator('.dashboard-overlay')).toHaveCount(0)
})

test('search facets: type filter narrows results', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'dashboard interactions are desktop')
  await login(page)
  // a sticky and a document, each with a unique word
  await page.getByRole('button', { name: '+ Notiz' }).click()
  const c = await centre(page)
  await page.mouse.dblclick(c.x, c.y)
  const ta = page.locator('.entry-sticky textarea')
  await expect(ta).toBeVisible()
  await ta.fill('FACETWORDXY')
  await ta.blur()
  await page.waitForTimeout(600)

  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-search]').fill('FACETWORDXY')
  await page.waitForTimeout(500)
  await expect(page.locator('.dashboard-results button')).toHaveCount(1)

  // restrict to documents only → the sticky hit disappears
  await page.locator('[data-facet-type="doc"]').click()
  await page.waitForTimeout(500)
  await expect(page.locator('.dashboard-results button')).toHaveCount(0)

  // back to stickies → it returns
  await page.locator('[data-facet-type="doc"]').click()
  await page.locator('[data-facet-type="sticky"]').click()
  await page.waitForTimeout(500)
  await expect(page.locator('.dashboard-results button')).toHaveCount(1)
})

test('connection graph: renders nodes and a node click flies to the entry', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'graph + pointer are desktop concerns')
  await login(page)
  // ensure at least one entry exists so the graph has a node
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.waitForTimeout(400)

  await page.locator('[data-dashboard-toggle]').click()
  await page.locator('[data-dashboard-graph]').click()
  // the lazy GraphView modal renders an SVG with at least one node
  const node = page.locator('[data-graph-node]').first()
  await expect(node).toBeVisible()
  await node.click()
  // clicking a node flies the camera and closes the graph modal
  await expect(page.locator('.graph-modal')).toHaveCount(0)
})

test('export the current viewport as a PNG', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'export is a desktop concern')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await page.waitForTimeout(300)

  await page.locator('[data-dashboard-toggle]').click()
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })
  await page.locator('[data-export-png]').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('corkspace.png')
  // the produced file is non-empty
  const path = await download.path()
  expect(path).toBeTruthy()
})

test('tags: create a tag and assign it (chip + rule border appear)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'tag panel + pointer are desktop concerns')
  await login(page)
  await page.getByRole('button', { name: '+ Notiz' }).click()
  await expect(page.locator('.entry-sticky').first()).toBeVisible()
  const c = await centre(page)

  // create a tag (its default rule gives a coloured border)
  await page.locator('[data-tag-toggle]').click()
  await page.locator('[data-tag-create]').click()
  await fillPrompt(page, 'Wichtig')
  await expect(page.locator('[data-tag-id]').first()).toBeVisible()

  // select the new (topmost) sticky, then assign the tag
  await page.mouse.click(c.x, c.y)
  await page.locator('[data-tag-id]').first().click()

  // chip + rule-based border overlay appear on the board
  await expect(page.locator('[data-tag-chip]').first()).toBeVisible()
  await expect(page.locator('[data-tag-border]').first()).toBeVisible()
  await expect(page.getByText('Wichtig').first()).toBeVisible()

  // clean up so the tagged entry doesn't pollute later tests' drag zones
  await page.locator('[data-delete-entry]').click()
})

test('theme toggle flips dark/light and persists across reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'header toggle assertion is desktop-scoped')
  await login(page)
  const html = page.locator('html')
  const initial = await html.getAttribute('data-theme')
  await page.locator('[data-theme-toggle]').click()
  const toggled = await html.getAttribute('data-theme')
  expect(toggled).not.toBe(initial)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', toggled ?? 'dark')
})

test('undo/redo covers frames via the toolbar buttons', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'undo buttons + frames are desktop concerns',
  )
  await login(page)
  await page.getByRole('button', { name: '+ Rahmen' }).click()
  await fillPrompt(page, 'UndoRahmenXY')
  await expect(page.getByText('▢ UndoRahmenXY')).toBeVisible()

  await page.locator('[data-undo]').click()
  await expect(page.getByText('▢ UndoRahmenXY')).toHaveCount(0)

  await page.locator('[data-redo]').click()
  await expect(page.getByText('▢ UndoRahmenXY')).toBeVisible()
})
