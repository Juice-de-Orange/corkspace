import { defineConfig, devices } from '@playwright/test'

/**
 * Web is served by `vite preview` (built dist). The DB + api are provisioned by
 * `scripts/e2e.ts` BEFORE Playwright runs, which sets VITE_API_PROXY so the preview
 * server proxies `/api` to the ephemeral api (hermetic E2E, see docs/TESTING.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Serial: all tests share one admin + one server-persisted camera, so concurrent runs would
  // race on that shared state. One worker keeps the small suite deterministic.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Browser-interaction tests (synthetic pointer drags for pan/draw/teleport) are inherently
  // timing-sensitive on a shared-state board; retries absorb transient races without weakening
  // assertions (a test must still pass within its retries). Trace is kept for the first retry.
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // The UI defaults to English and picks German from a `de*` browser language. The specs assert
    // the German strings, so the suite runs with a German locale; i18n.spec.ts covers English.
    locale: 'de-DE',
  },
  webServer: {
    command: 'pnpm run build && pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_PROXY: process.env.VITE_API_PROXY ?? 'http://localhost:3100',
    },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
})
