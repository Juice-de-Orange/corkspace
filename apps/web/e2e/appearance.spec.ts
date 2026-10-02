import { expect, type Page, test } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'
const adminBoardId = process.env.E2E_ADMIN_BOARD_ID ?? ''

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.locator('.position-readout')).toBeVisible()
}

test('board background is set in account settings, persists per-board, independent of theme', async ({
  page,
}) => {
  await login(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-bg', 'cork-photo') // default look

  // Background moved out of the board UI into Account settings.
  await page.goto('/account')
  await page.getByLabel('Hintergrund').selectOption('paper')
  await expect(html).toHaveAttribute('data-bg', 'paper')

  // Back on the board it is persisted (per-board setting).
  await page.goto(`/b/${adminBoardId}`)
  await expect(page.locator('.position-readout')).toBeVisible()
  await expect(html).toHaveAttribute('data-bg', 'paper')

  // Theme and background are independent axes (theme toggle lives in the board header).
  const themeBefore = await html.getAttribute('data-theme')
  await page.locator('[data-theme-toggle]').click()
  await expect(html).not.toHaveAttribute('data-theme', themeBefore ?? '')
  await expect(html).toHaveAttribute('data-bg', 'paper')
  await page.locator('[data-theme-toggle]').click() // restore the theme for later specs

  // Reset to the default so later visual assumptions hold.
  await page.goto('/account')
  await page.getByLabel('Hintergrund').selectOption('cork-photo')
  await expect(html).toHaveAttribute('data-bg', 'cork-photo')
})
