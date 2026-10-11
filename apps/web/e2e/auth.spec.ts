import { expect, test } from '@playwright/test'

const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password-123'

test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('admin can log in and reach the authed shell', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByText('Abmelden')).toBeVisible()
})

test('signing in after the redirect from / reaches the board on the first attempt', async ({
  page,
}) => {
  // Start where a newcomer starts: at the root, which redirects to /login. The session store then
  // already holds "no session", and a client-side navigate('/') right after sign-in bounced back
  // to an empty login form.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByText('Abmelden')).toBeVisible()
})
