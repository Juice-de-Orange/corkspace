import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** Perf harness (jsdom). Deterministic assertions: culling counts + zero entry re-renders
 *  on camera move (render-count instrumentation). fps/memory remain advisory (Playwright). */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['perf/**/*.perf.test.tsx', 'perf/**/*.perf.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
})
