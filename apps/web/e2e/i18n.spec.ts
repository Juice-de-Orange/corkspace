import { expect, test } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'

/** The language toggle mirrors the theme toggle: a signia atom persisted to localStorage, applied to
 *  <html lang>. The suite runs with a German browser locale (playwright.config.ts), so this test flips
 *  to EN, verifies the strings + <html lang> change and survive a reload, then restores DE for the
 *  serially-run suite. */
test('language toggle flips DE↔EN, updates strings + <html lang>, and persists across reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'the language toggle lives in the desktop header nav',
  )

  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)

  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()

  // Toggle → English: <html lang> and the visible strings flip.
  await page.locator('[data-lang-toggle]').click()
  await expect(html).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abmelden' })).toHaveCount(0)

  // Persists across a reload (localStorage).
  await page.reload()
  await expect(html).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  // Restore DE so the rest of the (serial, shared-state) suite sees German again.
  await page.locator('[data-lang-toggle]').click()
  await expect(html).toHaveAttribute('lang', 'de')
})

test.describe('with an English browser', () => {
  test.use({ locale: 'en-US' })

  test('the UI defaults to English', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByLabel('Password')).toBeVisible()
  })
})
