import { expect, type Page, test } from '@playwright/test'
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

test('feedback: submit a bug with screenshot → appears in the admin Feedback tab', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'feedback dialog + dashboard are desktop')
  await login(page)

  // open the feedback dialog (it captures a screenshot first, then shows)
  await page.locator('[data-feedback-toggle]').click()
  const modal = page.locator('[data-feedback-modal]')
  await expect(modal).toBeVisible({ timeout: 20_000 })
  await modal.locator('[data-feedback-kind="bug"]').click()
  await modal.locator('[data-feedback-message]').fill('E2EBUGREPORTXYZ')
  // screenshot is attached by default; preview is shown
  await expect(modal.locator('[data-feedback-preview]')).toBeVisible()
  await modal.locator('[data-feedback-submit]').click()

  await expect(page.locator('[data-feedback-done]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-feedback-modal]')).toHaveCount(0, { timeout: 6000 }) // auto-closes

  // admin reviews it in the central /admin Feedback tab (feedback triage was consolidated there,
  // out of the in-board overlay). The default status filter is "Offen", so a fresh bug shows.
  await page.goto('/admin')
  await page.getByRole('tab', { name: 'Feedback' }).click()
  await expect(page.getByText('E2EBUGREPORTXYZ')).toBeVisible()
  await page.locator('[data-feedback-shot]').first().click()
  await expect(page.locator('.dashboard-feedback img').first()).toBeVisible()
})
