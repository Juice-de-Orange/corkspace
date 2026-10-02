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
      // Gate the db LOGIC (client / migrate / reset-content — all exercised by the integration
      // tests, currently 100%). Excluded: CLIs (process entrypoints), the test-DB helper (test
      // infra), the barrel, and src/schema/** — declarative table defs whose only "functions" are
      // lazy `() => table.id` reference lambdas that drizzle-kit reads but the runtime never calls
      // (so functions-coverage there is meaningless). The schema IS exercised end-to-end by the
      // migrate up→down→up test.
      exclude: [
        'src/migrate-cli.ts',
        'src/reset-content-cli.ts',
        'src/testing/**',
        'src/index.ts',
        'src/schema/**',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
