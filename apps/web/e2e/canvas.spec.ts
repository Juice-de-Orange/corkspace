import { expect, type Page, test } from '@playwright/test'
import { resetCamera } from './helpers'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'

async function loginAndOpenBoard(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
  await resetCamera(page)
}

async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.canvas-root').boundingBox()
  if (!box) {
    throw new Error('canvas not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('dragging empty space pans the board', async ({ page }) => {
  await loginAndOpenBoard(page)
  const readout = page.locator('.position-readout')
  const before = (await readout.textContent()) ?? ''
  const c = await canvasCenter(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x - 180, c.y - 140, { steps: 8 })
  await page.mouse.up()
  await expect(readout).not.toHaveText(before)
})

test('wheel zooms the board', async ({ page }) => {
  await loginAndOpenBoard(page)
  const readout = page.locator('.position-readout')
  const before = (await readout.textContent()) ?? ''
  const c = await canvasCenter(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.wheel(0, -300)
  await expect(readout).not.toHaveText(before)
})

test('reload restores the last camera position', async ({ page }) => {
  await loginAndOpenBoard(page)
  const readout = page.locator('.position-readout')
  const c = await canvasCenter(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x - 220, c.y - 160, { steps: 8 })
  await page.mouse.up()
  const after = (await readout.textContent()) ?? ''

  await page.waitForTimeout(1100) // allow the debounced save to flush
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await expect(readout).toHaveText(after)
})
