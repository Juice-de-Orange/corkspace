import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts is the worker bootstrap (top-level poll loop, not imported by tests). The image
      // pipeline (process) + queue ARE exercised by the integration test. Conservative floor.
      exclude: ['src/index.ts'],
      reporter: ['text', 'json-summary'],
      // Ratcheted to just below the measured actuals (lines/stmts ~92, funcs 100, branch ~87).
      thresholds: { lines: 88, functions: 95, branches: 75, statements: 88 },
    },
  },
})
