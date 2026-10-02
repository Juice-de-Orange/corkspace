import { expect, type Page } from '@playwright/test'

/**
 * Reset the per-user persisted camera to the default so a test never inherits a flown/zoomed view
 * left by an earlier test (the camera is shared server-side per user, restored on every load).
 * Call at the end of a login helper. Without this, a jump/flight test that zooms in pollutes the
 * starting camera of later pan/edit tests.
 */
export async function resetCamera(page: Page): Promise<void> {
  await page.waitForTimeout(700) // let restore-last-position + its debounced save settle first
  await page.request.put('/api/me/camera', { data: { x: 0, y: 0, zoom: 1 } })
  await page.reload()
  await expect(page.locator('.position-readout')).toBeVisible()
  await page.waitForTimeout(300) // let the canvas runtime (pointer handlers) attach after reload
}

/**
 * Fill the themed prompt dialog (the useDialogs replacement for window.prompt): type `value` into
 * the modal's input and confirm with OK. Replaces the old `page.once('dialog', d => d.accept(...))`.
 */
export async function fillPrompt(page: Page, value: string): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const input = dialog.getByRole('textbox')
  await input.fill(value)
  await input.press('Enter') // the prompt form submits on Enter (OK label varies by dialog)
  await expect(dialog).toHaveCount(0)
}
