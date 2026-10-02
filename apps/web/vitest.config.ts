import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      // The web app is e2e-first: the canvas, routes and entry components are exercised by
      // Playwright, not unit tests, so global line coverage is intrinsically low (CLAUDE.md §8
      // sets "no hard global floor" for web). This is an anti-regression RATCHET, not a target —
      // it locks in the current floor so tests can't silently disappear. Phase 2 adds
      // `src/components/ui/**` (shared primitives that MUST be unit-tested) with a scoped, higher
      // threshold, and this floor is raised as unit coverage grows. See docs/adr/.
      thresholds: {
        statements: 5,
        lines: 5,
        functions: 38,
        branches: 48,
      },
    },
  },
})
