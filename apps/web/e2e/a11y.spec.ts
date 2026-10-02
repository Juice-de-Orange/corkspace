import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'

/** The documented bar (CLAUDE.md §10): zero CRITICAL axe violations on main views. */
async function expectNoCriticalA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const critical = results.violations.filter((v) => v.impact === 'critical')
  expect(
    critical,
    `critical a11y violations:\n${critical.map((v) => `${v.id}: ${v.help}`).join('\n')}`,
  ).toEqual([])
}

test('login page has no critical a11y violations', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await expectNoCriticalA11y(page)
})

test('board has no critical a11y violations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'scan the desktop board once')
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.locator('.position-readout')).toBeVisible()
  await expectNoCriticalA11y(page)
})
