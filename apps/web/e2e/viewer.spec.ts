import { expect, type Page, test } from '@playwright/test'

const email = process.env.E2E_VIEWER_EMAIL ?? 'viewer@example.com'
const password = process.env.E2E_VIEWER_PASSWORD ?? 'viewer-password-123'
const adminBoardId = process.env.E2E_ADMIN_BOARD_ID ?? ''

async function loginViewer(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
}

test('a viewer-member gets a read-only shared board: no create/draw toolbar', async ({ page }) => {
  await loginViewer(page)
  // Open the board the viewer was invited to (as a viewer member) — read-only there.
  await page.goto(`/b/${adminBoardId}`)
  await expect(page.locator('.position-readout')).toBeVisible()
  // the create toolbar (and its draw tools) is hidden for a non-editor
  await expect(page.getByRole('button', { name: '+ Notiz' })).toHaveCount(0)
  await expect(page.locator('[data-draw-tool="pen"]')).toHaveCount(0)
})

test('a viewer can edit their OWN board (create toolbar present)', async ({ page }) => {
  await loginViewer(page)
  // The landing board is the viewer's own board → they are the owner → editing is allowed.
  await expect(page.getByRole('button', { name: '+ Notiz' })).toBeVisible()
})
